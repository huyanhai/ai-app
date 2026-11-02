import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { CanvasService, CanvasSnapshot, GenerationInput } from './canvas.service';
import { ImageStorageService } from './image-storage.service';

@Controller('canvas')
export class CanvasController {
  constructor(
    private readonly canvas: CanvasService,
    private readonly images: ImageStorageService,
  ) {}

  @Post('assets')
  async uploadAsset(@Body() body: { dataUrl: string }) {
    return { url: await this.images.upload(body.dataUrl) };
  }

  @Get()
  get() {
    return this.canvas.get();
  }

  @Put()
  save(@Body() body: CanvasSnapshot) {
    return this.canvas.save(body);
  }

  @Get('generations')
  generations() {
    return this.canvas.generations();
  }

  @Post('generations')
  createGeneration(@Body() body: GenerationInput) {
    return this.canvas.createGeneration(body);
  }
}
