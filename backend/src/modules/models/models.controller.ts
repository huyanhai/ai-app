import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ModelInput, ModelsService } from './models.service';

@Controller('models')
export class ModelsController {
  constructor(private readonly models: ModelsService) {}

  @Get()
  list() {
    return this.models.list();
  }

  @Post()
  create(@Body() body: ModelInput) {
    return this.models.create(body);
  }

  @Post('import')
  import(
    @Body() body: { models: ModelInput[]; defaults: Record<string, string> },
  ) {
    return this.models.import(body.models ?? [], body.defaults ?? {});
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: ModelInput) {
    return this.models.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.models.remove(id);
  }

  @Post(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.models.toggle(id);
  }

  @Post(':id/default')
  setDefault(@Param('id') id: string) {
    return this.models.setDefault(id);
  }
}
