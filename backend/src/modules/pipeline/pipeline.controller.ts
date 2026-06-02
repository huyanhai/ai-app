import { Body, Controller, Header, Post, Req, Res } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { streamDto } from '../ai/dto/stream.dto';
import { Request, Response } from 'express';

@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Post('text')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async text(
    @Body() body: streamDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const generator = this.pipelineService.text(body.message);
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
    @Body() body: streamDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const generator = this.pipelineService.image(body.message);
    for await (const event of generator) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
  }
}
