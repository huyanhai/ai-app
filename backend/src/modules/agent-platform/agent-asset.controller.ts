import {
  Controller, Get, NotFoundException, Param, Post, Res, UploadedFile,
  UseFilters, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AgentAssetService, AgentUpload } from './agent-asset.service';
import { PlatformFilter } from './platform.filter';
import { ok } from './platform.types';

@Controller('agent/assets')
@UseFilters(PlatformFilter)
export class AgentAssetController {
  constructor(private readonly assets: AgentAssetService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async upload(@UploadedFile() file: AgentUpload) {
    const asset = await this.assets.upload(file);
    return ok({
      id: asset.id, url: asset.url, width: asset.width, height: asset.height, mime_type: asset.mime_type,
    });
  }

  @Get(':id/content')
  async content(@Param('id') id: string, @Res() res: Response) {
    const asset = await this.assets.get(id);
    if (!asset || asset.text === undefined) throw new NotFoundException('附件不存在');
    res.type(asset.mime_type).send(asset.text);
  }
}
