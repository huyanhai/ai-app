import { BadRequestException } from '@nestjs/common';

export type RunContext = {
  run_id: string;
  user_id: string;
  session_id: string;
  canvas_id: string;
  mode?: string;
  model_key?: string;
  selection?: string[];
  budget_credits?: number;
  spent_extra?: number;
};

export type ToolDeclaration = {
  name: string;
  label: string;
  verb: string;
  description: string;
  parameters: Record<string, unknown>;
  executor: 'server';
  scriptable: boolean;
};

export const ok = (data: unknown = null) => ({ code: 0, msg: 'success', data });

export function decodeRunContext(header?: string): RunContext {
  if (!header || header.length > 16 * 1024) {
    throw new BadRequestException('缺少或过大的 X-Agent-Context');
  }
  let value: RunContext;
  try {
    value = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestException('X-Agent-Context 必须是运行上下文 JSON 的 base64url');
  }
  for (const field of ['run_id', 'user_id', 'session_id', 'canvas_id'] as const) {
    if (typeof value?.[field] !== 'string' || !value[field].trim()) {
      throw new BadRequestException(`运行上下文缺少 ${field}`);
    }
  }
  if (value.selection && (!Array.isArray(value.selection) || value.selection.some((id) => typeof id !== 'string'))) {
    throw new BadRequestException('运行上下文的 selection 必须是字符串数组');
  }
  return value;
}

export const serviceToken = () => {
  const token = process.env.AGENT_SERVICE_TOKEN ||
    (process.env.NODE_ENV === 'production' ? '' : 'development-only-agent-token-0123456789abcdef');
  if (token.length < 32) throw new Error('AGENT_SERVICE_TOKEN 至少需要 32 个字符');
  return token;
};

export const idKey = () => {
  const key = process.env.AGENT_ID_KEY || process.env.APP_SERVER_ID_KEY ||
    (process.env.NODE_ENV === 'production' ? '' : 'development-only');
  if (!key) throw new Error('生产环境必须配置 AGENT_ID_KEY');
  return key;
};
