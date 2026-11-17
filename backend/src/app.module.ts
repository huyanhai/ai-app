import { Module } from '@nestjs/common';
import { AiModule } from './modules/ai/ai.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaModule } from './common/prisma/prisma.module';
import { ModelsModule } from './modules/models/models.module';
import { AgentSessionsModule } from './modules/agent-sessions/agent-sessions.module';
import { CanvasModule } from './modules/canvas/canvas.module';
import { ProductionModule } from './modules/production/production.module';
import { GenerationModule } from './modules/generation/generation.module';
import { AgentPlatformModule } from './modules/agent-platform/agent-platform.module';

@Module({
  imports: [
    PrismaModule,
    ModelsModule,
    PipelineModule,
    AiModule,
    AgentPlatformModule,
    AgentSessionsModule,
    CanvasModule,
    ProductionModule,
    GenerationModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
