import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentAssetService } from './agent-asset.service';

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

describe('AgentAssetService', () => {
  let directory: string;
  const oldDirectory = process.env.AGENT_ASSET_DIR;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'agent-assets-'));
    process.env.AGENT_ASSET_DIR = directory;
  });
  afterEach(async () => {
    process.env.AGENT_ASSET_DIR = oldDirectory;
    await rm(directory, { recursive: true, force: true });
  });

  it('uploads a real image and persists metadata needed by attachments/check', async () => {
    const images = { upload: jest.fn(async () => 'https://cdn.example/image.png') };
    const service = new AgentAssetService(images as any);
    const asset = await service.upload({ originalname: 'pixel.png', mimetype: 'image/png', size: pixel.length, buffer: pixel });
    expect(images.upload).toHaveBeenCalledWith(`data:image/png;base64,${pixel.toString('base64')}`);
    expect(asset).toMatchObject({
      url: 'https://cdn.example/image.png', width: 1, height: 1, mime_type: 'image/png', name: 'pixel.png',
    });
    expect(asset.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await service.get(asset.id)).toEqual(asset);
  });

  it('stores Markdown as a readable document attachment', async () => {
    const service = new AgentAssetService({ upload: jest.fn() } as any);
    const asset = await service.upload({
      originalname: 'notes.md', mimetype: 'text/markdown', size: 7, buffer: Buffer.from('# title'),
    });
    expect(asset).toMatchObject({ text: '# title', width: null, height: null });
    expect(asset.url).toBe(`/agent/assets/${asset.id}/content`);
  });
});
