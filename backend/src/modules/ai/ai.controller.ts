import { Controller, Post, Body, Res, Header, Req } from '@nestjs/common';
import { AiService } from './ai.service';
import { Request, Response } from 'express';
import { streamDto } from './dto/stream.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('stream')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async stream(
    @Body() body: streamDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const abortController = new AbortController();
    const abortStream = () => abortController.abort();

    req.on('aborted', abortStream);
    req.on('close', abortStream);
    res.on('close', abortStream);

    const generator = this.aiService.stream(
      body.message,
      body.files,
      abortController.signal,
    );

    try {
      for await (const event of generator) {
        if (abortController.signal.aborted || res.writableEnded) {
          break;
        }
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } finally {
      req.off('aborted', abortStream);
      req.off('close', abortStream);
      res.off('close', abortStream);
    }

    res.end();
  }
}
