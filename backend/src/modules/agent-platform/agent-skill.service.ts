import { Injectable } from '@nestjs/common';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

@Injectable()
export class AgentSkillService {
  async list() {
    try {
      const entries = await readdir(this.root(), { withFileTypes: true });
      const skills = [] as Array<{
        id: string;
        name: string;
        title: string;
        description: string;
        source: 'builtin' | 'imported';
      }>;
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
          const source = await readFile(join(this.root(), entry.name, 'SKILL.md'), 'utf8');
          const title = source.match(/^name:\s*(.+)$/m)?.[1]?.trim();
          const description = source.match(/^description:\s*(.+)$/m)?.[1]?.trim();
          if (!title || !description) continue;
          skills.push({
            id: entry.name,
            name: entry.name,
            title,
            description,
            source: 'builtin',
          });
        } catch {
          // Ignore incomplete skill directories, matching the legacy catalog.
        }
      }
      return skills;
    } catch {
      return [];
    }
  }

  async names() {
    return new Set((await this.list()).map((skill) => skill.name));
  }

  private root() {
    return join(process.cwd(), 'src/common/llm/skills');
  }
}
