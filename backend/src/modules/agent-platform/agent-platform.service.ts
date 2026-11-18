import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '@/common/prisma/prisma.service';
import { createCanvasTools, CanvasToolContext } from '@/common/llm/tools/canvas-tools';
import { ModelsService } from '../models/models.service';
import { AgentCanvasService } from '../canvas/agent-canvas.service';
import { CanvasService } from '../canvas/canvas.service';
import { ImageStorageService } from '../canvas/image-storage.service';
import { AgentFilesService } from '../agent-sessions/agent-files.service';
import { GenerationService } from '../generation/generation.service';
import { ChunkStatus } from '@/common/utils/ai-stream-utils';
import { AgentAssetService } from './agent-asset.service';
import { AgentSkillService } from './agent-skill.service';
import { RunContext, ToolDeclaration } from './platform.types';
import { harnessInfo, systemPrompt, toolDeclarations } from './tool-definitions';

type JsonObject = Record<string, any>;
type ModelCall = {
  id: string;
  runId: string;
  status: 'pending' | 'settled';
  input_tokens: number;
  output_tokens: number;
  error?: string;
};

const text = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value);
const requiredString = (value: unknown, name: string) => {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`缺少 ${name}`);
  return value;
};
const nodeKind = (type: string): 'image' | 'video' | 'audio' | undefined =>
  ({ imageNode: 'image', videoNode: 'video', audioNode: 'audio' })[type] as 'image' | 'video' | 'audio' | undefined;
const mediaType = (kind: string) => kind === 'music' ? 'audio' : kind;
const referenceLabel = (node: JsonObject) => String(node.data?.title || '')
  .replace(/\s*(?:·\s*)?(?:角色|道具)?三视图.*$/, '')
  .replace(/\s*(?:·\s*)?场景参考图.*$/, '')
  .trim();
const contextTokens = (params: JsonObject) => {
  const value = Number(params?.contextWindow ?? params?.context_window ?? 128000);
  return value > 0 && value <= 1024 ? value * 1024 : value;
};

@Injectable()
export class AgentPlatformService {
  private readonly contexts = new Map<string, CanvasToolContext>();
  private readonly idempotency = new Map<string, { fingerprint: string; result: Promise<unknown> }>();
  private readonly executions = new Map<string, JsonObject>();
  private readonly taskNodes = new Map<string, string>();
  private readonly calls = new Map<string, ModelCall>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly modelsService: ModelsService,
    private readonly canvas: AgentCanvasService,
    private readonly canvases: CanvasService,
    private readonly images: ImageStorageService,
    private readonly files: AgentFilesService,
    private readonly assets: AgentAssetService,
    private readonly skills: AgentSkillService,
    private readonly generation: GenerationService,
  ) {}

  async models(category = 'text') {
    const models = await this.modelsService.list();
    return models.filter((model) => model.enabled && (!category || model.category === category)).map((model) => ({
      key: model.id,
      name: model.name,
      vision: model.params?.supportVision === true,
      video: false,
      context_window: contextTokens(model.params || {}),
      max_tokens: Number(model.params?.maxTokens ?? model.params?.max_tokens ?? 8192),
      kind: model.category,
      description: model.description || '',
    }));
  }

  async checkCanvas(body: JsonObject) {
    requiredString(body.user_id, 'user_id');
    const canvasId = requiredString(body.canvas_id, 'canvas_id');
    if (!await this.canvases.get(canvasId)) throw new NotFoundException('画布不存在');
    return null;
  }

  async checkMessage(body: JsonObject) {
    await this.checkCanvas(body);
    const state = await this.canvas.getState(body.canvas_id);
    const nodeIds = new Set(state.nodes.map((node) => node.id));
    const selection = Array.isArray(body.selection)
      ? [...new Set(body.selection.filter((id) => typeof id === 'string' && nodeIds.has(id)))]
      : [];
    const message = typeof body.message === 'string' ? body.message : '';
    const [models, skills] = await Promise.all([this.modelsService.list(), this.skills.names()]);
    const refs = [...message.matchAll(/@\[([^\]]+)]\((node|model|skill):([^)]+)\)/g)];
    for (const ref of refs) {
      const [, name, kind, id] = ref;
      const valid = kind === 'node'
        ? nodeIds.has(id)
        : kind === 'model'
          ? models.some((model) => model.enabled && (model.id === id || model.name === id))
          : skills.has(id);
      if (!valid) throw new BadRequestException(`引用「${name}」已不存在或不可用`);
    }
    return { selection };
  }

  async checkAttachments(body: JsonObject) {
    requiredString(body.user_id, 'user_id');
    if (!Array.isArray(body.asset_ids)) throw new BadRequestException('asset_ids 必须是数组');
    const ids = [...new Set(body.asset_ids.map((id) => requiredString(id, 'asset_id')))];
    if (ids.length > 12) throw new BadRequestException('一条消息最多 12 个附件');
    const attachments = [] as JsonObject[];
    let images = 0;
    let documents = 0;
    for (const id of ids) {
      const asset = await this.assets.get(id);
      if (asset) {
        if (asset.text !== undefined) {
          if (++documents > 3) throw new BadRequestException('一条消息最多 3 个文本文件');
          attachments.push({
            asset_id: asset.id, kind: 'document', name: asset.name, mime_type: asset.mime_type,
            byte_size: asset.byte_size, url: asset.url, text: asset.text,
          });
        } else {
          if (++images > 9) throw new BadRequestException('一条消息最多 9 张图片');
          attachments.push({
            asset_id: asset.id, kind: 'image', name: asset.name, mime_type: asset.mime_type,
            byte_size: asset.byte_size, width: asset.width, height: asset.height, url: asset.url,
            image: { mime_type: asset.mime_type, url: asset.url },
          });
        }
        continue;
      }
      const record = await this.prisma.generationRecord.findUnique({ where: { id } });
      if (record) {
        if (record.nodeType !== 'imageNode') throw new BadRequestException(`附件 ${id} 不是图片`);
        if (++images > 9) throw new BadRequestException('一条消息最多 9 张图片');
        attachments.push({
          asset_id: record.id, kind: 'image', name: record.title, mime_type: this.mime(record.url),
          url: record.url, image: { mime_type: this.mime(record.url), url: record.url },
        });
        continue;
      }
      const separator = id.indexOf('/');
      if (separator < 1) throw new BadRequestException(`附件不存在：${id}`);
      const sessionId = id.slice(0, separator);
      const storedName = id.slice(separator + 1);
      const messages = await this.prisma.agentMessage.findMany({
        where: { sessionId, attachments: { contains: storedName } },
        select: { attachments: true },
      });
      const stored = messages.flatMap((message) => JSON.parse(message.attachments || '[]'))
        .find((item) => item.storedName === storedName);
      if (!stored) throw new BadRequestException(`附件不存在：${id}`);
      const [file] = await this.files.load(sessionId, [stored]);
      const buffer = Buffer.from(file.content, 'base64');
      if (file.type.startsWith('image/')) {
        if (++images > 9 || buffer.byteLength > 5 * 1024 * 1024) {
          throw new BadRequestException('图片最多 9 张，且单张不能超过 5MB');
        }
        attachments.push({
          asset_id: id, kind: 'image', name: stored.name, mime_type: stored.type,
          byte_size: buffer.byteLength, url: stored.url,
          image: { mime_type: stored.type, data: file.content },
        });
      } else {
        if (++documents > 3 || buffer.byteLength > 200_000) {
          throw new BadRequestException('文本附件最多 3 个，且每个不能超过 200KB');
        }
        attachments.push({
          asset_id: id, kind: 'document', name: stored.name, mime_type: stored.type,
          byte_size: buffer.byteLength, url: stored.url,
          text: buffer.toString('utf8').replace(/^\uFEFF/, ''),
        });
      }
    }
    return { attachments };
  }

  async prepare(rc: RunContext, body: JsonObject) {
    await this.checkCanvas({ user_id: rc.user_id, canvas_id: rc.canvas_id });
    const runtime = await this.modelsService.runtime(rc.model_key, 'text');
    const params = JSON.parse(runtime.params || '{}');
    let first_message: string | undefined;
    if (body.message) {
      const state = await this.canvas.getState(rc.canvas_id);
      first_message = `${requiredString(body.message, 'message')}\n\n<画布上下文>\n${JSON.stringify({
        canvas_id: rc.canvas_id, selection: rc.selection || [], nodes: state.nodes, edges: state.edges,
      })}\n最多 ${Number(body.max_steps) > 0 ? Number(body.max_steps) : 80} 步工具调用。\n</画布上下文>`;
    }
    return {
      model: {
        name: runtime.name,
        context_window: contextTokens(params),
        max_tokens: Number(params.maxTokens ?? params.max_tokens ?? 8192),
        vision: params.supportVision === true,
      },
      system_prompt: systemPrompt,
      tools: toolDeclarations.filter((tool) => params.supportVision === true || !tool.name.startsWith('canvas_inspect')),
      disabled_tools: [],
      ...(first_message ? { first_message } : {}),
      harness: harnessInfo(),
    };
  }

  async tool(rc: RunContext, name: string, body: JsonObject, idemKey?: string) {
    const declaration = toolDeclarations.find((item) => item.name === name);
    if (!declaration) throw new NotFoundException('工具不存在');
    if (['generate_media', 'canvas_delete', 'ask_user'].includes(name)) {
      return this.toolResult(declaration, '该工具需要先创建审批', true);
    }
    const fingerprint = createHash('sha256').update(JSON.stringify(body.args ?? {})).digest('hex');
    const key = idemKey ? `${rc.run_id}:${name}:${idemKey}` : '';
    if (key) {
      if (!/^[A-Za-z0-9._:-]{1,64}$/.test(idemKey)) throw new BadRequestException('幂等键不合法');
      const previous = this.idempotency.get(key);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new BadRequestException('同一幂等键不能用于不同参数');
        return previous.result;
      }
    }
    const result = this.executeTool(rc, declaration, body.tool_call_id || randomUUID(), body.args ?? {});
    if (key) this.idempotency.set(key, { fingerprint, result });
    return result;
  }

  async undo(rc: RunContext) {
    return this.prisma.$transaction(async (transaction) => {
      const state = await transaction.canvasState.findUnique({ where: { id: rc.canvas_id } });
      if (!state) throw new NotFoundException('画布不存在');
      const past = JSON.parse(state.past || '[]') as JsonObject[];
      let index = -1;
      for (let itemIndex = past.length - 1; itemIndex >= 0; itemIndex--) {
        if (past[itemIndex].agentRunId === rc.run_id) { index = itemIndex; break; }
      }
      if (index < 0) return { reverted: 0, skipped: [], revision: 0 };
      const snapshot = past[index];
      const currentNodes = JSON.parse(state.nodes) as JsonObject[];
      const currentEdges = JSON.parse(state.edges) as JsonObject[];
      const restoredNodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
      const restoredEdges = Array.isArray(snapshot.edges) ? snapshot.edges : [];
      const changed = (before: JsonObject[], after: JsonObject[]) => {
        const beforeById = new Map(before.map((item) => [item.id, item]));
        const afterById = new Map(after.map((item) => [item.id, item]));
        return [...new Set([...beforeById.keys(), ...afterById.keys()])]
          .filter((id) => JSON.stringify(beforeById.get(id)) !== JSON.stringify(afterById.get(id))).length;
      };
      const nextPast = past.filter((_, itemIndex) => itemIndex !== index);
      const revision = state.revision + 1;
      await transaction.canvasState.update({
        where: { id: rc.canvas_id },
        data: {
          nodes: JSON.stringify(restoredNodes), edges: JSON.stringify(restoredEdges),
          past: JSON.stringify(nextPast), future: '[]', revision,
        },
      });
      return {
        reverted: changed(currentNodes, restoredNodes) + changed(currentEdges, restoredEdges),
        skipped: [], revision,
      };
    });
  }

  async taskStates(body: JsonObject) {
    requiredString(body.user_id, 'user_id');
    if (!Array.isArray(body.task_ids) || !body.task_ids.length || body.task_ids.length > 50) {
      throw new BadRequestException('task_ids 需要 1 到 50 项');
    }
    const items = [] as JsonObject[];
    for (const rawId of body.task_ids) {
      const taskId = requiredString(rawId, 'task_id');
      try {
        const job = await this.generation.get(taskId);
        items.push({
          task_id: job.id, node_id: this.taskNodes.get(taskId), kind: job.kind,
          status: job.status, error: job.error || undefined,
          progress: job.status === 'succeeded' ? 100 : undefined,
          outputs: job.urls.map((url) => ({ media_type: mediaType(job.kind), text: url })),
        });
      } catch (error) {
        if (error instanceof NotFoundException) items.push({ task_id: taskId, status: 'missing' });
        else throw error;
      }
    }
    return { items };
  }

  receiveEvents(events: unknown) {
    if (!Array.isArray(events) || !events.length || events.length > 200) {
      throw new BadRequestException('events 必须是 1 到 200 条');
    }
    events.forEach((event, index) => {
      for (const field of ['user_id', 'session_id', 'canvas_id', 'type', 'created_at']) {
        if (typeof event?.[field] !== 'string' || !event[field]) {
          throw new BadRequestException(`第 ${index + 1} 条事件缺少 ${field}`);
        }
      }
      if (!Number.isSafeInteger(event.seq) || event.seq < 0 || event.type.length > 64 || !Number.isFinite(Date.parse(event.created_at))) {
        throw new BadRequestException(`第 ${index + 1} 条事件格式无效`);
      }
    });
    return null;
  }

  endRun(rc: RunContext) {
    this.contexts.delete(rc.run_id);
    for (const key of this.idempotency.keys()) if (key.startsWith(`${rc.run_id}:`)) this.idempotency.delete(key);
    for (const key of this.executions.keys()) if (key.startsWith(`${rc.run_id}:`)) this.executions.delete(key);
    return null;
  }

  usage(rc: RunContext, callId?: string) {
    const calls = [...this.calls.values()].filter((call) => call.runId === rc.run_id);
    const latest = calls.filter((call) => call.status === 'settled').at(-1);
    const call = callId ? this.calls.get(`${rc.run_id}:${callId}`) : undefined;
    if (callId && !call) throw new NotFoundException('模型调用不存在');
    return {
      spent_credits: 0,
      context_tokens: latest ? latest.input_tokens + latest.output_tokens : 0,
      ...(call ? { call: {
        id: call.id, status: call.status, credits: 0, charged: 0, estimated: false,
        input_tokens: call.input_tokens, output_tokens: call.output_tokens, error: call.error,
      } } : {}),
    };
  }

  beginModelCall(rc: RunContext) {
    const id = randomUUID();
    this.calls.set(`${rc.run_id}:${id}`, { id, runId: rc.run_id, status: 'pending', input_tokens: 0, output_tokens: 0 });
    if (this.calls.size > 1000) {
      const oldest = this.calls.keys().next().value;
      if (oldest) this.calls.delete(oldest);
    }
    return id;
  }

  settleModelCall(rc: RunContext, id: string, usage: JsonObject = {}, error?: string) {
    const call = this.calls.get(`${rc.run_id}:${id}`);
    if (!call) return;
    call.status = 'settled';
    call.input_tokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
    call.output_tokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
    call.error = error;
  }

  async propose(rc: RunContext, kind: string, args: JsonObject): Promise<JsonObject> {
    await this.checkCanvas({ user_id: rc.user_id, canvas_id: rc.canvas_id });
    try {
      if (kind === 'delete') return await this.proposeDelete(rc.canvas_id, args);
      if (kind === 'generate') return await this.proposeGenerate(rc.canvas_id, args);
      if (kind === 'ask') return await this.proposeAsk(args);
      throw new BadRequestException('审批种类不对');
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        return { is_error: true, quote_credits: 0, content: error.message, terminate: false };
      }
      throw error;
    }
  }

  resolve(kind: string, payload: JsonObject, decision: JsonObject) {
    if (!['generate', 'delete', 'ask'].includes(kind)) throw new BadRequestException('审批种类不对');
    if (!payload || typeof payload !== 'object') throw new BadRequestException('审批内容无效');
    if (!['approve', 'reject'].includes(decision?.decision)) throw new BadRequestException('审批决定无效');
    if (decision.decision === 'reject') {
      return {
        status: 'rejected', quote_credits: 0,
        decision: { decision: 'reject', ...(decision.answer ? { answer: decision.answer } : {}) },
      };
    }
    if (kind === 'ask') return this.resolveAsk(payload, decision);
    const source: JsonObject[] = kind === 'generate' ? payload.items : payload.node_ids;
    if (!Array.isArray(source) || !source.length) throw new BadRequestException('审批内容为空');
    const choices = new Map<number, JsonObject>((decision.items || []).map((item) => [item.index, item]));
    const selected = source.filter((_, index) => choices.get(index)?.approve !== false);
    if (!selected.length) throw new BadRequestException('至少需要批准一项');
    const partial = selected.length !== source.length || (kind === 'generate' && selected.some((item, index) => {
      const choice = choices.get(source.indexOf(item));
      return choice?.count !== undefined && choice.count < item.count;
    }));
    if (kind === 'delete') {
      return {
        status: partial ? 'partially_approved' : 'approved',
        decision: { decision: 'approve', node_ids: selected },
        quote_credits: 0, node_ids: selected, edge_ids: payload.edge_ids || [],
      };
    }
    const items = selected.map((item) => {
      const index = source.indexOf(item);
      const count = choices.get(index)?.count ?? item.count ?? 1;
      if (!Number.isInteger(count) || count < 1 || count > (item.count || 1)) {
        throw new BadRequestException('批准的生成数量不能超过申请数量');
      }
      return { ...item, count };
    });
    return { status: partial ? 'partially_approved' : 'approved', decision, quote_credits: 0, items };
  }

  async execute(rc: RunContext, kind: string, approvalId: string, outcome: JsonObject): Promise<JsonObject> {
    requiredString(approvalId, 'approval_id');
    if (!['approved', 'partially_approved', 'rejected'].includes(outcome?.status)) {
      throw new BadRequestException('审批状态不对');
    }
    const key = `${rc.run_id}:${kind}:${approvalId}`;
    if (this.executions.has(key)) return this.executions.get(key);
    if (outcome.status === 'rejected' || kind === 'ask') {
      const result = { status: 'none', outcome_text: this.outcomeText(kind, outcome) };
      this.executions.set(key, result);
      return result;
    }
    let result: JsonObject;
    if (kind === 'delete') result = await this.executeDelete(rc, outcome);
    else if (kind === 'generate') result = await this.executeGenerate(rc, outcome);
    else throw new BadRequestException('审批种类不对');
    this.executions.set(key, result);
    return result;
  }

  private async executeTool(rc: RunContext, declaration: ToolDeclaration, callId: string, args: JsonObject) {
    try {
      let data: unknown;
      if (declaration.name === 'model_list') data = { models: await this.models(args.kind || '') };
      else if (declaration.name === 'task_get') data = await this.taskStates({ user_id: rc.user_id, task_ids: args.task_ids });
      else data = await this.executeCanvasTool(rc, declaration.name, args);
      const extra = data && typeof data === 'object' ? {
        ...((data as JsonObject).node_ids ? { node_ids: (data as JsonObject).node_ids } : {}),
        ...((data as JsonObject).created !== undefined ? { created: (data as JsonObject).created } : {}),
        ...((data as JsonObject).updated !== undefined ? { updated: (data as JsonObject).updated } : {}),
        ...((data as JsonObject).changes ? { summary: `应用 ${(data as JsonObject).changes} 项操作` } : {}),
        ...(declaration.name === 'task_get' && Array.isArray((data as JsonObject).items) ? { task_states: (data as JsonObject).items } : {}),
      } : {};
      return this.toolResult(declaration, text(data), false, data, callId, extra);
    } catch (error) {
      return this.toolResult(declaration, error instanceof Error ? error.message : String(error), true, undefined, callId);
    }
  }

  private async executeCanvasTool(rc: RunContext, name: string, args: JsonObject) {
    let context = this.contexts.get(rc.run_id);
    if (!context) {
      context = { canvasId: rc.canvas_id, runId: rc.run_id };
      this.contexts.set(rc.run_id, context);
    }
    if (name === 'canvas_get_state' || name === 'canvas_apply_ops' || name === 'canvas_arrange') {
      if (name === 'canvas_get_state') {
        const state = await this.canvas.getState(rc.canvas_id, args.nodeIds || []);
        context.revision = state.revision;
        return state;
      }
      if (name === 'canvas_apply_ops') {
        const normalized = this.normalizeCanvasOperations(args);
        const result = await this.canvas.applyOps(rc.canvas_id, rc.run_id, normalized.operations, context.revision);
        context.revision = result.revision;
        return {
          ok: true, revision: result.revision, changes: result.changed, id_map: normalized.idMap,
          created: normalized.created, updated: normalized.updated, node_ids: normalized.nodeIds,
        };
      }
      const { layout, ...options } = args;
      const result = await this.canvas.arrange(rc.canvas_id, rc.run_id, {
        ...options, mode: layout || options.mode,
      }, context.revision);
      context.revision = result.revision;
      return result;
    }
    const runtime = await this.modelsService.runtime(rc.model_key, 'text');
    const tools = createCanvasTools(runtime, this.canvas, this.images, context);
    const tool = tools.find((item) => item.name === name);
    if (!tool) throw new BadRequestException('工具不存在');
    return tool.invoke(args);
  }

  private normalizeCanvasOperations(args: JsonObject) {
    const input = args.ops ?? args.operations;
    const idMap: Record<string, string> = {};
    if (!Array.isArray(input)) return { operations: input, idMap, created: [], updated: [], nodeIds: [] };
    const resolve = (value: unknown) => typeof value === 'string' ? idMap[value] || value : value;
    const types: Record<string, string> = {
      script: 'textNode', image: 'imageNode', video: 'videoNode', audio: 'audioNode', character: 'subjectNode', group: 'group',
    };
    const created = new Set<string>();
    const updated = new Set<string>();
    const nodeIds = new Set<string>();
    const operations = input.map((raw) => {
      if (raw.action) {
        const id = raw.id || raw.node?.id;
        if (raw.action === 'create_node' && typeof id === 'string') created.add(id);
        if (raw.action === 'update_node' && typeof id === 'string' && !created.has(id)) updated.add(id);
        if (typeof id === 'string') nodeIds.add(id);
        return raw;
      }
      const data: JsonObject = {
        ...(raw.label !== undefined ? { title: raw.label } : {}),
        ...(raw.prompt !== undefined ? { text: raw.prompt } : {}),
        ...(raw.character ? { name: raw.character.name, description: raw.character.description } : {}),
      };
      const config = {
        ...(raw.params && typeof raw.params === 'object' ? raw.params : {}),
        ...(raw.model ? { model: raw.model } : {}),
        ...(raw.mode ? { mode: raw.mode, ...(raw.kind === 'video' ? { videoMode: raw.mode } : {}) } : {}),
        ...(raw.character?.look ? { look: raw.character.look } : {}),
        ...(raw.character?.voicePrompt ? { voicePrompt: raw.character.voicePrompt } : {}),
      };
      if (Object.keys(config).length) data.config = config;
      if (raw.op === 'create_node') {
        const id = randomUUID();
        if (raw.tempId) idMap[String(raw.tempId)] = id;
        created.add(id);
        nodeIds.add(id);
        return {
          action: 'create_node',
          node: {
            id, type: types[raw.kind] || raw.type, position: raw.position, data,
            ...(raw.parentId ? { parentId: resolve(raw.parentId) } : {}),
            ...(raw.kind === 'group' && raw.width ? { width: raw.width } : {}),
            ...(raw.kind === 'group' && raw.height ? { height: raw.height } : {}),
          },
        };
      }
      const id = resolve(raw.id);
      if (typeof id === 'string') nodeIds.add(id);
      if (raw.op === 'update_node' || raw.op === 'move') {
        if (!created.has(String(id))) updated.add(String(id));
        return {
          action: 'update_node', id,
          ...(raw.op === 'move' || raw.position ? { position: raw.position } : {}),
          ...(raw.op === 'update_node' && Object.keys(data).length ? { data } : {}),
        };
      }
      if (raw.op === 'connect') {
        return { action: 'connect', source: resolve(raw.source), target: resolve(raw.target) };
      }
      if (raw.op === 'delete_node') return { action: 'delete_node', id };
      return { action: raw.op, id };
    });
    return { operations, idMap, created: [...created], updated: [...updated], nodeIds: [...nodeIds] };
  }

  private toolResult(declaration: ToolDeclaration, content: string, isError: boolean, data?: unknown, callId: string = randomUUID(), extra: JsonObject = {}) {
    return {
      ...(data !== undefined ? { data } : {}), content, is_error: isError, terminate: false,
      tool_end: {
        id: callId, name: declaration.name, is_error: isError,
        summary: isError ? content.slice(0, 120) : `${declaration.verb}完成`,
        label: declaration.label, verb: declaration.verb,
        ...extra,
      },
    };
  }

  private async proposeDelete(canvasId: string, args: JsonObject) {
    if (!Array.isArray(args.nodeIds) && !Array.isArray(args.node_ids)) throw new BadRequestException('请选择要删除的节点');
    const nodeIds = args.nodeIds || args.node_ids;
    const state = await this.canvas.getState(canvasId);
    return this.deleteProposal(state, nodeIds, args.reason);
  }

  private async deleteProposal(state: JsonObject, nodeIds: string[], reason = '') {
    const nodes = new Map<string, JsonObject>(state.nodes.map((node) => [node.id, node]));
    if (!nodeIds.length || nodeIds.some((id) => !nodes.has(id))) throw new BadRequestException('包含已不存在的节点');
    const selected = new Set(nodeIds);
    const edgeIds = state.edges.filter((edge) => selected.has(edge.source) || selected.has(edge.target)).map((edge) => edge.id);
    const payload = {
      reason: String(reason || '').slice(0, 200), node_ids: nodeIds,
      labels: nodeIds.map((id) => nodes.get(id).data?.title || nodes.get(id).type),
      outputs: nodeIds.map((id) => Boolean(nodes.get(id).data?.url)), edge_ids: edgeIds,
    };
    return {
      is_error: false, payload, quote_credits: 0, summary: `申请删除 ${nodeIds.length} 个节点`,
      content: '已提交删除申请，等待用户决定。', terminate: true,
    };
  }

  private async proposeGenerate(canvasId: string, args: JsonObject) {
    if (!Array.isArray(args.items) || !args.items.length || args.items.length > 8) {
      throw new BadRequestException('items 需要 1 到 8 项');
    }
    const items = [] as JsonObject[];
    for (const input of args.items) {
      const nodeId = requiredString(input.node_id || input.nodeId, 'node_id');
      const state = await this.canvas.getState(canvasId, [nodeId]);
      const node = state.nodes[0] as JsonObject;
      if (!node) throw new BadRequestException(`节点不存在：${nodeId}`);
      const kind = nodeKind(node.type);
      if (!kind) throw new BadRequestException('只能为图片、视频或音频节点申请生成');
      if (node.data?.url) throw new BadRequestException('节点已有产物，请新建节点后重试');
      const config = node.data?.config || {};
      const modelKey = input.model_key || input.modelKey || config.model || node.data?.model;
      const runtime = await this.modelsService.runtime(modelKey, kind);
      const count = input.count ?? config.count ?? 1;
      if (!Number.isInteger(count) || count < 1 || count > 4) throw new BadRequestException('每项生成数量为 1 到 4');
      items.push({
        node_id: nodeId, label: node.data?.title || node.type,
        model_key: runtime.id, model_name: runtime.name, price: 0, count,
      });
    }
    return {
      is_error: false,
      payload: { reason: String(args.reason || '').slice(0, 200), items, wait: args.wait !== false },
      quote_credits: 0, summary: `申请生成 ${items.length} 项`,
      content: '已提交生成申请，等待用户决定。', terminate: true,
    };
  }

  private async proposeAsk(args: JsonObject) {
    const input = Array.isArray(args.questions) && args.questions.length ? args.questions : [args];
    if (input.length > 5) throw new BadRequestException('一张卡最多 5 个问题');
    const ids = new Set<string>();
    const questions = [] as JsonObject[];
    for (let index = 0; index < input.length; index++) {
      const question = input[index];
      const prompt = requiredString(question.question, `第 ${index + 1} 题 question`).trim();
      const id = String(question.id || index + 1);
      if (ids.has(id)) throw new BadRequestException('问题 id 不能重复');
      ids.add(id);
      const kind = question.kind || 'text';
      if (!['text', 'choice', 'model', 'url', 'number'].includes(kind)) throw new BadRequestException('问题类型无效');
      const options = (question.options || []).map((option) => ({
        label: String(typeof option === 'string' ? option : option.label || '').trim(),
        follow: String(typeof option === 'string' ? '' : option.follow || '').trim(),
      })).filter((option) => option.label);
      const models = kind === 'model' ? await this.models(question.modelKind || question.model_kind || 'image') : undefined;
      questions.push({
        id, question: prompt, kind, required: question.required !== false,
        options, multi: question.multi === true, allow_custom: question.allowCustom === true,
        placeholder: question.placeholder || '', model_kind: question.modelKind || question.model_kind, models,
      });
    }
    const first = questions[0];
    return {
      is_error: false,
      payload: {
        question: questions.length > 1 ? `还差 ${questions.length} 件事要你定` : first.question,
        kind: first.kind, options: first.options.map((option) => option.label), models: first.models, questions,
      },
      quote_credits: 0, summary: `向用户提问：${first.question.slice(0, 40)}`,
      content: '已向用户提问，等待回答。', terminate: true,
    };
  }

  private resolveAsk(payload: JsonObject, decision: JsonObject) {
    const questions = payload.questions || [{ id: '1', question: payload.question, required: true }];
    const supplied = new Map((decision.answers || []).map((answer) => [answer.id, answer.value]));
    if (decision.answer !== undefined && !supplied.has(questions[0].id)) supplied.set(questions[0].id, decision.answer);
    const answers = questions.map((question) => {
      const value = supplied.get(question.id);
      if (question.required !== false && (value === undefined || value === '' || (Array.isArray(value) && !value.length))) {
        throw new BadRequestException(`请回答：${question.question}`);
      }
      return { id: question.id, question: question.question, value: value ?? '', answer: Array.isArray(value) ? value.join('、') : String(value ?? '') };
    });
    return { status: 'approved', decision: { decision: 'approve', answers }, quote_credits: 0 };
  }

  private async executeDelete(rc: RunContext, outcome: JsonObject) {
    try {
      const result = await this.canvas.deleteNodes(rc.canvas_id, rc.run_id, outcome.node_ids || []);
      const extraEdges = (outcome.edge_ids || []).filter((id) => !result.changed || id);
      if (extraEdges.length) {
        const state = await this.canvas.getState(rc.canvas_id);
        const remaining = extraEdges.filter((id) => state.edges.some((edge) => edge.id === id));
        if (remaining.length) await this.canvas.applyOps(rc.canvas_id, rc.run_id, remaining.map((id) => ({ action: 'disconnect', id })));
      }
      return { status: 'executed', result, outcome_text: `已删除 ${outcome.node_ids.length} 个节点。` };
    } catch (error) {
      return { status: 'failed', result: { error: error instanceof Error ? error.message : String(error) }, outcome_text: '删除失败，请重新读取画布后重试。' };
    }
  }

  private async executeGenerate(rc: RunContext, outcome: JsonObject) {
    const tasks = [] as JsonObject[];
    const failed = [] as JsonObject[];
    for (const item of outcome.items || []) {
      for (let index = 0; index < item.count; index++) {
        try {
          const state = await this.canvas.getState(rc.canvas_id);
          const node = state.nodes.find((itemNode) => itemNode.id === item.node_id) as JsonObject;
          if (!node || node.data?.url) throw new BadRequestException('节点已不存在或已有产物');
          const kind = nodeKind(node.type);
          if (!kind) throw new BadRequestException('节点类型不支持生成');
          const runtime = await this.modelsService.runtime(item.model_key, kind);
          const config = { ...(node.data?.config || {}) };
          const basePrompt = node.data?.draftText || node.data?.text || node.data?.description || node.data?.prompt || node.data?.title;
          if (!basePrompt) throw new BadRequestException('节点缺少生成提示词');
          const nodes = new Map<string, JsonObject>(state.nodes.map((stateNode): [string, JsonObject] => [stateNode.id, stateNode]));
          const connectedReferences = state.edges
            .filter((edge) => edge.target === item.node_id && !['continuity', 'sceneMembership'].includes(edge.data?.kind))
            .map((edge) => nodes.get(edge.source))
            .filter((reference): reference is JsonObject => reference?.type === 'imageNode' && typeof reference.data?.url === 'string' && reference.data.url);
          const connectedIds = new Set(connectedReferences.map((reference) => reference.id));
          const characterIds = new Set<string>(node.data?.production?.characterIds || []);
          const isStoryboard = ['storyboard', 'storyboardPreviz'].includes(node.data?.production?.kind) ||
            /分镜|故事板/.test(String(node.data?.title || ''));
          const inferredByIdentity = new Map<string, JsonObject>();
          if (isStoryboard) {
            for (const reference of state.nodes as JsonObject[]) {
              if (connectedIds.has(reference.id) || reference.type !== 'imageNode' || !reference.data?.url) continue;
              const label = referenceLabel(reference);
              const characterId = reference.data?.production?.characterId;
              if (!characterIds.has(characterId) && (!label || !String(basePrompt).includes(label))) continue;
              inferredByIdentity.set(characterId || label, reference);
            }
          }
          const inferredReferences = [...inferredByIdentity.values()];
          if (inferredReferences.length) {
            await this.canvas.applyOps(rc.canvas_id, rc.run_id, inferredReferences.map((reference) => ({
              action: 'connect', source: reference.id, target: item.node_id,
            })));
          }
          const configuredReferenceUrl = config.referenceUrl || config.image || undefined;
          const referencesByUrl = new Map<string, JsonObject>();
          for (const reference of [...connectedReferences, ...inferredReferences]) {
            const url = reference.data.url as string;
            if (!referencesByUrl.has(url)) referencesByUrl.set(url, reference);
          }
          const references = [...referencesByUrl.values()];
          const referenceUrls = [
            ...referencesByUrl.keys(),
            ...(typeof configuredReferenceUrl === 'string' && configuredReferenceUrl ? [configuredReferenceUrl] : []),
          ].filter((url, index, urls) => urls.indexOf(url) === index);
          const referenceUrl = referenceUrls[0];
          const prompt = [
            String(basePrompt),
            ...(isStoryboard && references.length ? [
              '分镜参考要求：将参考图中的角色放入本镜场景，严格保持各角色的脸型、体型、配色、服装和辨识特征。角色三视图仅用于提取身份外观，禁止复制三视图排版，禁止生成角色设定表、白底或多格拼图；场景图只参考环境与美术风格，不得替换或融合角色身份。',
            ] : []),
            ...(references.length ? [`参考图映射（编号与后续图片一一对应，禁止互换身份或混合物体结构）：\n${references
              .map((reference, index) => `图片${index + 1}＝${reference.data?.title ?? reference.id}`)
              .join('\n')}`] : []),
          ].join('\n\n');
          const job = await this.generation.create({
            kind, prompt: String(prompt), modelId: runtime.id, modelName: runtime.name,
            config: { ...config, ...(referenceUrls.length ? { referenceUrls } : {}) },
            ...(referenceUrl ? { referenceUrl } : {}),
          });
          this.taskNodes.set(job.id, item.node_id);
          await this.updateTaskNode(rc, item.node_id, job.id, 'running');
          tasks.push({ node_id: item.node_id, task_id: job.id, credits: 0 });
          void this.runGeneration(rc, job.id, item.node_id, kind);
        } catch (error) {
          failed.push({ node_id: item.node_id, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
    const result = { tasks, failed };
    if (!tasks.length) return { status: 'failed', result, outcome_text: '生成任务提交失败。' };
    return {
      status: 'executed', result,
      outcome_text: `已提交 ${tasks.length} 个生成任务${failed.length ? `，${failed.length} 个失败` : ''}。`,
    };
  }

  private async runGeneration(rc: RunContext, taskId: string, nodeId: string, kind: string) {
    try {
      for await (const _event of this.generation.run(taskId)) { /* consume the real generation stream */ }
      const job = await this.generation.get(taskId);
      await this.updateTaskNode(rc, nodeId, taskId, job.status, job.urls[0], job.error || undefined);
      if (job.status === 'succeeded') {
        await this.prisma.generationRecord.createMany({
          data: job.urls.map((url) => ({
            nodeId, nodeType: kind === 'image' ? 'imageNode' : kind === 'video' ? 'videoNode' : 'audioNode',
            title: `Agent ${kind} ${taskId.slice(0, 8)}`, model: job.modelName, url, canvasId: rc.canvas_id,
          })),
        });
      }
    } catch (error) {
      await this.updateTaskNode(rc, nodeId, taskId, 'failed', undefined, error instanceof Error ? error.message : String(error));
    }
  }

  private async updateTaskNode(rc: RunContext, nodeId: string, taskId: string, status: string, url?: string, error?: string) {
    const state = await this.canvas.getState(rc.canvas_id, [nodeId]);
    const node = state.nodes[0] as JsonObject;
    if (!node) return;
    await this.canvas.applyOps(rc.canvas_id, rc.run_id, [{
      action: 'update_node', id: nodeId,
      data: {
        ...(url ? { url } : {}),
        status: status === 'succeeded' ? ChunkStatus.SUCCESS : status === 'failed' ? ChunkStatus.FAILED : ChunkStatus.PROCESSING,
        ...(error ? { error } : {}),
        config: { ...(node.data?.config || {}), taskId, status, ...(error ? { error } : {}) },
      },
    }]);
  }

  private outcomeText(kind: string, outcome: JsonObject) {
    if (outcome.status === 'rejected') return `用户拒绝了${kind === 'generate' ? '生成' : kind === 'delete' ? '删除' : '提问'}${outcome.decision?.answer ? `：${outcome.decision.answer}` : '。'}`;
    return (outcome.decision?.answers || []).map((answer) => `${answer.question}：${answer.answer || '未回答'}`).join('\n') || '用户已回答。';
  }

  private mime(url: string) {
    const extension = url.split('?')[0].split('.').at(-1)?.toLowerCase();
    return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' })[extension] || 'image/png';
  }
}
