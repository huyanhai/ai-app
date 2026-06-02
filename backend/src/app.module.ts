import { Module } from '@nestjs/common';
import { AiModule } from './modules/ai/ai.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';

@Module({
  imports: [AiModule, PipelineModule],
})
export class AppModule {}
