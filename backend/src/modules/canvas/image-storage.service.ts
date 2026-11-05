import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { BadRequestException, Injectable } from '@nestjs/common';
import ImageKit from '@imagekit/nodejs';

const ffmpegPath = require('ffmpeg-static') as string | null;

const DATA_URL = /^data:(image\/(?:png|jpe?g|webp|gif)|video\/(?:webm|mp4|quicktime));base64,([A-Za-z0-9+/=\r\n]+)$/;

@Injectable()
export class ImageStorageService {
  async extractLastFrame(videoUrl: string) {
    if (!ffmpegPath) throw new Error('FFmpeg is not configured');
    const directory = await mkdtemp(join(tmpdir(), 'canvas-frame-'));
    const output = join(directory, 'last-frame.jpg');
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(ffmpegPath, [
          '-nostdin', '-hide_banner', '-loglevel', 'error',
          '-sseof', '-0.1', '-i', videoUrl,
          '-frames:v', '1', '-q:v', '2', output,
        ]);
        let error = '';
        child.stderr?.on('data', (chunk) => { error += chunk.toString(); });
        child.on('error', reject);
        child.on('close', (code) => code === 0
          ? resolve()
          : reject(new Error(error.trim() || `FFmpeg exited with code ${code}`)));
      });
      const frame = await readFile(output);
      return await this.upload(`data:image/jpeg;base64,${frame.toString('base64')}`);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  async upload(dataUrl: string) {
    const match = DATA_URL.exec(dataUrl);
    if (!match) throw new BadRequestException('Invalid media data URL');
    const privateKey = process.env.UPLOAD_IMAGE_PRIVATE_KEY;
    if (!privateKey) throw new Error('ImageKit is not configured');

    const mimeType = match[1] === 'video/webm' ? 'video/mp4' : match[1];
    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'video/quicktime' ? 'mov' : mimeType.split('/')[1];
    const file = match[1] === 'video/webm' ? await this.transcodeWebm(match[2]) : match[2];
    const client = new ImageKit({ privateKey });
    const result = await client.files.upload({
      file,
      fileName: `${randomUUID()}.${extension}`,
      folder: '/canvas',
    });
    if (!result.url) throw new Error('ImageKit did not return an asset URL');
    return result.url;
  }

  private async transcodeWebm(data: string) {
    if (!ffmpegPath) throw new Error('FFmpeg is not configured');
    const directory = await mkdtemp(join(tmpdir(), 'canvas-video-'));
    const input = join(directory, 'input.webm');
    const output = join(directory, 'output.mp4');
    try {
      await writeFile(input, Buffer.from(data, 'base64'));
      await new Promise<void>((resolve, reject) => {
        const child = spawn(ffmpegPath, [
          '-nostdin', '-hide_banner', '-loglevel', 'error', '-i', input,
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
          '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', output,
        ]);
        let error = '';
        child.stderr?.on('data', (chunk) => { error += chunk.toString(); });
        child.on('error', reject);
        child.on('close', (code) => code === 0
          ? resolve()
          : reject(new Error(`WebM 转码失败${error ? `：${error.trim()}` : ''}`)));
      });
      return (await readFile(output)).toString('base64');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
