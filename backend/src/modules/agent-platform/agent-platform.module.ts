import { Module } from '@nestjs/common';
import { ModelsModule } from '../models/models.module';
import { CanvasModule } from '../canvas/canvas.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { CanvasService } from '../canvas/canvas.service';
import { AgentFilesService } from '../agent-sessions/agent-files.service';
import { GenerationService } from '../generation/generation.service';
import { AgentPlatformService } from './agent-platform.service';
import { AgentProxyController } from './agent-proxy.controller';
import { AgentProxyService } from './agent-proxy.service';
import { ModelPlatformService } from './model-platform.service';
import { PlatformAuthGuard } from './platform-auth.guard';
import { PlatformController } from './platform.controller';
import { AgentAssetController } from './agent-asset.controller';
import { AgentAssetService } from './agent-asset.service';
import { AgentSkillController } from './agent-skill.controller';
import { AgentSkillService } from './agent-skill.service';

@Module({
  imports: [ModelsModule, CanvasModule, PipelineModule],
  controllers: [AgentProxyController, AgentSkillController, AgentAssetController, PlatformController],
  providers: [
    CanvasService,
    AgentFilesService,
    GenerationService,
    AgentPlatformService,
    AgentProxyService,
    ModelPlatformService,
    PlatformAuthGuard,
    AgentAssetService,
    AgentSkillService,
  ],
  exports: [AgentPlatformService, AgentProxyService],
})
export class AgentPlatformModule {}
