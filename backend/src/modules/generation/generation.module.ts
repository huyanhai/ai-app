import { Module } from '@nestjs/common';
import { PipelineModule } from '../pipeline/pipeline.module';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';

@Module({
  imports: [PipelineModule],
  controllers: [GenerationController],
  providers: [GenerationService],
})
export class GenerationModule {}
