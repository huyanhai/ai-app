import { Module } from '@nestjs/common';
import { CanvasController } from './canvas.controller';
import { CanvasService } from './canvas.service';
import { ImageStorageService } from './image-storage.service';

@Module({
  controllers: [CanvasController],
  providers: [CanvasService, ImageStorageService],
  exports: [ImageStorageService],
})
export class CanvasModule {}
