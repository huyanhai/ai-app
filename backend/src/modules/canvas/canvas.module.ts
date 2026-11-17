import { Module } from '@nestjs/common';
import { CanvasController } from './canvas.controller';
import { CanvasService } from './canvas.service';
import { ImageStorageService } from './image-storage.service';
import { AgentCanvasService } from './agent-canvas.service';

@Module({
  controllers: [CanvasController],
  providers: [CanvasService, ImageStorageService, AgentCanvasService],
  exports: [ImageStorageService, AgentCanvasService],
})
export class CanvasModule {}
