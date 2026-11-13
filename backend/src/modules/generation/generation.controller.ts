import { Body, Controller, Get, Header, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { GenerationService } from './generation.service';
import { CreateGenerationDto } from './dto/create-generation.dto';

@Controller('generations')
export class GenerationController {
  constructor(private readonly generation: GenerationService) {}

  @Post()
  create(@Body() body: CreateGenerationDto) {
    return this.generation.create(body);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.generation.get(id);
  }

  @Post(':id/run')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  async run(@Param('id') id: string, @Res() res: Response) {
    const generator = this.generation.run(id);
    for await (const event of generator) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
  }
}
