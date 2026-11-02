import { Module } from '@nestjs/common';
import { AiModule } from './modules/ai/ai.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaModule } from './common/prisma/prisma.module';
import { ModelsModule } from './modules/models/models.module';
import { AgentSessionsModule } from './modules/agent-sessions/agent-sessions.module';
import { CanvasModule } from './modules/canvas/canvas.module';

@Module({
  imports: [
    PrismaModule,
    ModelsModule,
    PipelineModule,
    AiModule,
    AgentSessionsModule,
    CanvasModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
