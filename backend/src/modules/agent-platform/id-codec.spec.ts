import { BadRequestException } from '@nestjs/common';
import { encodeAgentId } from './id-codec';

describe('encodeAgentId', () => {
  it('matches the Agent AES-128-ECB contract', () => {
    expect(encodeAgentId('1', 'video-canvas-dev-id-key')).toBe('71da229e1ac86a205e9bc8ab63f2bea7');
    expect(encodeAgentId('9007199254740993', 'test-key')).toMatch(/^[0-9a-f]{32}$/);
  });

  it('rejects UUIDs, zero and missing keys instead of returning fake IDs', () => {
    expect(() => encodeAgentId('canvas-uuid', 'test-key')).toThrow(BadRequestException);
    expect(() => encodeAgentId('0', 'test-key')).toThrow(BadRequestException);
    expect(() => encodeAgentId('1', '')).toThrow(BadRequestException);
  });
});
