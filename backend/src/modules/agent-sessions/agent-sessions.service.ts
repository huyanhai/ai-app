import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import type { FileUploadDto } from '../ai/dto/stream.dto';
import { AgentFilesService, StoredAttachment } from './agent-files.service';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import type { AgentSubjectDto } from './dto/agent-stream.dto';

@Injectable()
export class AgentSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly files: AgentFilesService,
  ) {}

  list() {
    return this.prisma.agentSession.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  create() {
    return this.prisma.agentSession.create({
      data: { id: crypto.randomUUID(), title: '新会话' },
    });
  }

  async detail(id: string) {
    const session = await this.prisma.agentSession.findUnique({
      where: { id },
      include: {
        messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!session) throw new NotFoundException('会话不存在');
    return {
      ...session,
      messages: session.messages.map((message) => ({
        ...message,
        attachments: message.attachments
          ? (JSON.parse(message.attachments) as StoredAttachment[])
          : [],
        subjects: message.subjects
          ? (JSON.parse(message.subjects) as AgentSubjectDto[])
          : [],
      })),
    };
  }

  async rename(id: string, title: string) {
    await this.detail(id);
    return this.prisma.agentSession.update({
      where: { id },
      data: { title: title.trim() },
    });
  }

  async remove(id: string) {
    await this.detail(id);
    await this.prisma.agentSession.delete({ where: { id } });
    await this.files.removeSession(id);
  }

  filePath(sessionId: string, storedName: string) {
    return this.files.path(sessionId, storedName);
  }

  async listSkills() {
    const root = join(process.cwd(), 'src/common/llm/skills');
    const entries = await readdir(root, { withFileTypes: true });
    const skills = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const source = await readFile(
          join(root, entry.name, 'SKILL.md'),
          'utf8',
        );
        const name = source.match(/^name:\s*(.+)$/m)?.[1]?.trim();
        const description = source
          .match(/^description:\s*(.+)$/m)?.[1]
          ?.trim();
        if (name && description) {
          skills.push({ id: entry.name, name, description });
        }
      } catch {
        // Ignore incomplete skill directories.
      }
    }
    return skills;
  }

  async *stream(
    sessionId: string,
    message: string,
    modelId: string | undefined,
    files: FileUploadDto[] | undefined,
    signal?: AbortSignal,
    skillIds: string[] = [],
    subjects: AgentSubjectDto[] = [],
    mode: 'agent' | 'chat' = 'agent',
  ) {
    const session = await this.detail(sessionId);
    const history = await Promise.all(
      session.messages.map(async (item) => ({
        role: item.role as 'user' | 'assistant',
        content: item.content,
        files:
          item.role === 'user'
            ? await this.files.load(sessionId, item.attachments)
            : undefined,
        subjects: item.subjects,
      })),
    );
    if (skillIds.length) {
      const available = new Set(
        (await this.listSkills()).map((skill) => skill.id),
      );
      if (skillIds.some((id) => !available.has(id))) {
        throw new NotFoundException('所选技能不存在');
      }
    }
    const attachments = await this.files.save(sessionId, files);
    const title =
      session.messages.length === 0
        ? message.trim().replace(/\s+/g, ' ').slice(0, 30) || '新会话'
        : session.title;

    await this.prisma.$transaction([
      this.prisma.agentMessage.create({
        data: {
          sessionId,
          role: 'user',
          content: message,
          attachments: JSON.stringify(attachments),
          subjects: JSON.stringify(subjects),
          mode,
        },
      }),
      this.prisma.agentSession.update({
        where: { id: sessionId },
        data: { title },
      }),
    ]);

    let assistantContent = '';
    try {
      for await (const event of this.ai.stream(
        message,
        files,
        signal,
        modelId,
        history,
        { skillIds, subjects, mode },
      )) {
        if (event.type === 'msg_chunk') {
          assistantContent += String(event.content ?? '');
        }
        yield event;
      }
    } finally {
      if (assistantContent.trim()) {
        await this.prisma.$transaction([
          this.prisma.agentMessage.create({
            data: {
              sessionId,
              role: 'assistant',
              content: assistantContent,
              mode,
            },
          }),
          this.prisma.agentSession.update({
            where: { id: sessionId },
            data: { updatedAt: new Date() },
          }),
        ]);
      }
    }
  }
}
