import { Controller, Get } from '@nestjs/common';
import { AgentSessionsService } from './agent-sessions.service';

@Controller('agent')
export class AgentToolsController {
  constructor(private readonly sessions: AgentSessionsService) {}

  @Get('skills')
  skills() {
    return this.sessions.listSkills();
  }
}
