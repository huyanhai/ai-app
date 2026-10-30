import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AgentSessionsService } from './agent-sessions.service';
import { UpdateSessionDto } from './dto/update-session.dto';
import { AgentStreamDto } from './dto/agent-stream.dto';

@Controller('agent/sessions')
export class AgentSessionsController {
  constructor(private readonly sessions: AgentSessionsService) {}

  @Get()
  list() {
    return this.sessions.list();
  }

  @Post()
  create() {
    return this.sessions.create();
  }

  @Get(':id/files/:fileName')
  async download(
    @Param('id') id: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    await this.sessions.detail(id);
    res.sendFile(this.sessions.filePath(id, fileName));
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.sessions.detail(id);
  }

  @Patch(':id')
  rename(@Param('id') id: string, @Body() body: UpdateSessionDto) {
    return this.sessions.rename(id, body.title);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sessions.remove(id);
  }

  @Post(':id/messages/stream')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async stream(
    @Param('id') id: string,
    @Body() body: AgentStreamDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const abortController = new AbortController();
    const abortStream = () => abortController.abort();
    req.on('aborted', abortStream);
    req.on('close', abortStream);
    res.on('close', abortStream);

    try {
      for await (const event of this.sessions.stream(
        id,
        body.message,
        body.modelId,
        body.files,
        abortController.signal,
        body.skillIds,
        body.subjects,
        body.mode,
      )) {
        if (abortController.signal.aborted || res.writableEnded) break;
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
