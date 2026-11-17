import { Controller, Get } from '@nestjs/common';
import { AgentSkillService } from './agent-skill.service';

@Controller('agent/skills')
export class AgentSkillController {
  constructor(private readonly skills: AgentSkillService) {}

  @Get()
  list() {
    return this.skills.list();
  }
}
