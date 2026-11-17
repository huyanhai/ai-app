import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ModelsModule } from '../models/models.module';
import { CanvasModule } from '../canvas/canvas.module';

@Module({
  imports: [ModelsModule, CanvasModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
