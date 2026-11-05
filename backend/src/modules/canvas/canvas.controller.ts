import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
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
  list() {
    return this.canvas.list();
  }

  @Post()
  create(@Body() body: { title?: string }) {
    return this.canvas.create(body.title);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.canvas.get(id);
  }

  @Put(':id')
  save(@Param('id') id: string, @Body() body: CanvasSnapshot) {
    return this.canvas.save(id, body);
  }

  @Get(':id/generations')
  generations(@Param('id') id: string) {
    return this.canvas.generations(id);
  }

  @Post(':id/generations')
  createGeneration(@Param('id') id: string, @Body() body: GenerationInput) {
    return this.canvas.createGeneration(id, body);
  }
}
