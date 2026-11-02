import { Module } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { PipelineController } from './pipeline.controller';
import { ModelsModule } from '../models/models.module';
import { CanvasModule } from '../canvas/canvas.module';

@Module({
  imports: [ModelsModule, CanvasModule],
  controllers: [PipelineController],
  providers: [PipelineService],
})
export class PipelineModule {}
