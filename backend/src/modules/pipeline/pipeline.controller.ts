import { Body, Controller, Header, Post, Req, Res } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { Request, Response } from 'express';
import { StreamDto } from './dto/stream.dto';

@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

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
}
