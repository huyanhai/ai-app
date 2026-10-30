import { Body, Controller, Header, Post, Req, Res } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { Request, Response } from 'express';
import { StreamDto } from './dto/stream.dto';
import { ChatDto } from './dto/chat.dto';

@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Post('chat')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async chat(@Body() body: ChatDto, @Res() res: Response) {
    // 客户端断开时中止模型请求（req 的 close 在读完请求体后就会触发，这里监听 res）
    const abortController = new AbortController();
    const abort = () => !res.writableEnded && abortController.abort();
    res.on('close', abort);

    try {
      const generator = this.pipelineService.chat(body, abortController.signal);
      for await (const event of generator) {
        if (abortController.signal.aborted) break;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } finally {
      res.off('close', abort);
      res.end();
    }
  }

  @Post('text')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async text(
    @Body() body: StreamDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const generator = this.pipelineService.text(body);
    for await (const event of generator) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
  }

  @Post('story')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async story(
    @Body() body: StreamDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const generator = this.pipelineService.story(body);
    for await (const event of generator) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
  }

  @Post('image')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async image(
    @Body() body: StreamDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const generator = this.pipelineService.image(body);
    for await (const event of generator) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
  }

  @Post('video')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async video(
    @Body() body: StreamDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const generator = this.pipelineService.video(body);
    for await (const event of generator) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
  }

  @Post('audio')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async audio(@Body() body: StreamDto, @Res() res: Response) {
    const generator = this.pipelineService.audio(body);
    for await (const event of generator) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
  }
}
