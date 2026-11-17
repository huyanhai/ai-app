import { createCipheriv, createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

const MAX_U64 = (1n << 64n) - 1n;
const DECIMAL = /^[1-9][0-9]{0,19}$/;

export function encodeAgentId(id: string, key: string) {
  if (!key) throw new BadRequestException('AGENT_ID_KEY 未配置');
  if (!DECIMAL.test(id)) throw new BadRequestException('id 必须是正整数的十进制字符串');
  const value = BigInt(id);
  if (value > MAX_U64) throw new BadRequestException('id 超出 64 位无符号整数范围');
  const plain = Buffer.alloc(16);
  plain.writeBigUInt64BE(value, 0);
  plain.write('vcanvas!', 8, 'latin1');
  const aesKey = createHash('sha256')
    .update(`video-canvas/idcodec/${key}`)
    .digest()
    .subarray(0, 16);
  const cipher = createCipheriv('aes-128-ecb', aesKey, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(plain), cipher.final()]).toString('hex');
}
