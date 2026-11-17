import {
  BadRequestException,
  Body, Controller, Delete, Get, Headers, Param, Post, Query, Req, Res,
  UseFilters, UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AgentPlatformService } from './agent-platform.service';
import { ModelPlatformService } from './model-platform.service';
import { PlatformAuthGuard } from './platform-auth.guard';
import { PlatformFilter } from './platform.filter';
import { decodeRunContext, idKey, ok } from './platform.types';
import { encodeAgentId } from './id-codec';

@Controller('internal/platform/v1')
@UseGuards(PlatformAuthGuard)
@UseFilters(PlatformFilter)
export class PlatformController {
  constructor(
    private readonly platform: AgentPlatformService,
    private readonly model: ModelPlatformService,
  ) {}

  @Get('agent/models')
  async models() { return ok(await this.platform.models()); }

  @Get('ids/:n')
  encodeId(@Param('n') id: string) { return ok({ encoded: encodeAgentId(id, idKey()) }); }

  @Post('canvases/check')
  async checkCanvas(@Body() body: Record<string, unknown>) { return ok(await this.platform.checkCanvas(body)); }

  @Post('messages/check')
  async checkMessage(@Body() body: Record<string, unknown>) { return ok(await this.platform.checkMessage(body)); }

  @Post('attachments/check')
  async checkAttachments(@Body() body: Record<string, unknown>) { return ok(await this.platform.checkAttachments(body)); }

  @Post('runs/prepare')
  async prepare(@Headers('x-agent-context') context: string, @Body() body: Record<string, unknown>) {
    return ok(await this.platform.prepare(decodeRunContext(context), body));
  }

  @Post('tools/:name')
  async tool(
    @Headers('x-agent-context') context: string,
    @Headers('x-idempotency-key') idemKey: string,
    @Param('name') name: string,
    @Body() body: Record<string, unknown>,
  ) {
    return ok(await this.platform.tool(decodeRunContext(context), name, body, idemKey));
  }

  @Post('runs/:runId/undo')
  async undo(@Headers('x-agent-context') context: string, @Param('runId') runId: string) {
    const rc = decodeRunContext(context);
    if (rc.run_id !== runId) throw new BadRequestException('路径 run_id 与运行上下文不一致');
    return ok(await this.platform.undo(rc));
  }

  @Delete('runs/:runId')
  end(@Headers('x-agent-context') context: string, @Param('runId') runId: string) {
    const rc = decodeRunContext(context);
    if (rc.run_id !== runId) throw new BadRequestException('路径 run_id 与运行上下文不一致');
    return ok(this.platform.endRun(rc));
  }

  @Post('runs/:runId/end')
  endAlias(@Headers('x-agent-context') context: string, @Param('runId') runId: string) {
    return this.end(context, runId);
  }

  @Get('runs/:runId/usage')
  usage(
    @Headers('x-agent-context') context: string,
    @Param('runId') runId: string,
    @Query('call_id') callId?: string,
  ) {
    const rc = decodeRunContext(context);
    if (rc.run_id !== runId) throw new BadRequestException('路径 run_id 与运行上下文不一致');
    return ok(this.platform.usage(rc, callId));
  }

  @Post(['tasks/status', 'tasks/states'])
  async tasks(@Body() body: Record<string, unknown>) { return ok(await this.platform.taskStates(body)); }

  @Post('events')
  events(@Body('events') events: unknown) { return ok(this.platform.receiveEvents(events)); }

  @Post('approvals/propose')
  async propose(@Headers('x-agent-context') context: string, @Body() body: Record<string, any>) {
    return ok(await this.platform.propose(decodeRunContext(context), body.kind, body.args || {}));
  }

  @Post('approvals/resolve')
  resolve(@Headers('x-agent-context') context: string, @Body() body: Record<string, any>) {
    decodeRunContext(context);
    return ok(this.platform.resolve(body.kind, body.payload, body.decision));
  }

  @Post('approvals/execute')
  async execute(@Headers('x-agent-context') context: string, @Body() body: Record<string, any>) {
    return ok(await this.platform.execute(
      decodeRunContext(context), body.kind, body.approval_id, body.outcome,
    ));
  }

  @Post('model/chat/completions')
  chat(
    @Headers('x-agent-context') context: string,
    @Body() body: Record<string, any>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.model.chatCompletions(decodeRunContext(context), body, req, res);
  }
}
