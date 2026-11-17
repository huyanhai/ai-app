import { All, Controller, Delete, Patch, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AgentProxyService } from './agent-proxy.service';

@Controller()
export class AgentProxyController {
  constructor(private readonly proxy: AgentProxyService) {}

  @All(['agent/models', 'canvas/:id/agent/sessions', 'agent/canvas/:id/agent/sessions'])
  sessionsAndModels(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res);
  }

  @All([
    'agent/sessions/:sid/events',
    'agent/sessions/:sid/history',
    'agent/sessions/:sid/runs',
    'agent/sessions/:sid/watches',
    'agent/sessions/:sid/watches/cancel',
    'agent/runs/:rid/interject',
    'agent/runs/:rid/cancel',
    'agent/runs/:rid/resume',
    'agent/runs/:rid/undo',
    'agent/runs/:rid/feedback',
    'agent/approvals/:aid/decision',
  ])
  durable(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res);
  }

  @Patch('agent/sessions/:sid')
  rename(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res);
  }

  @Delete('agent/sessions/:sid')
  remove(@Req() req: Request, @Res() res: Response) {
    return this.proxy.forward(req, res);
  }
}
