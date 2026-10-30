import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AgentSessionsController } from './agent-sessions.controller';
import { AgentSessionsService } from './agent-sessions.service';
import { AgentFilesService } from './agent-files.service';
import { AgentToolsController } from './agent-tools.controller';

@Module({
  imports: [AiModule],
  controllers: [AgentSessionsController, AgentToolsController],
  providers: [AgentSessionsService, AgentFilesService],
})
export class AgentSessionsModule {}
