import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ProductionService } from './production.service';
import { ProductionStreamEvent } from './production.types';
import {
  ConfirmProductionDto,
  ConfirmStageDto,
  CreateProductionDto,
  StartMediaPhaseDto,
  ReviseStageDto,
  RetryProductionNodeDto,
} from './dto/production.dto';

@Controller('productions')
export class ProductionController {
  constructor(private readonly productions: ProductionService) {}

  private async stream(
    res: Response,
    work: (emit: (event: ProductionStreamEvent) => void) => Promise<unknown>,
  ) {
    try {
      await work((event) => res.write(`data: ${JSON.stringify(event)}\n\n`));
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  @Post('plan/stream')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  createStream(@Body() body: CreateProductionDto, @Res() res: Response) {
    return this.stream(res, (emit) => this.productions.create(body, emit));
  }

  @Post('plan')
  create(@Body() body: CreateProductionDto) {
    return this.productions.create(body);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.productions.get(id);
  }

  @Post(':id/confirm')
  confirm(@Param('id') id: string, @Body() body: ConfirmProductionDto) {
    return this.productions.confirm(id, body);
  }

  @Post(':id/confirm-stage')
  confirmStage(@Param('id') id: string, @Body() body: ConfirmStageDto) {
    return this.productions.confirmStage(id, body);
  }

  @Post(':id/confirm-stage/stream')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  confirmStageStream(
    @Param('id') id: string,
    @Body() body: ConfirmStageDto,
    @Res() res: Response,
  ) {
    return this.stream(res, (emit) =>
      this.productions.confirmStage(id, body, emit),
    );
  }

  @Post(':id/media-phase')
  startMediaPhase(@Param('id') id: string, @Body() body: StartMediaPhaseDto) {
    return this.productions.startMediaPhase(id, body);
  }

  @Post(':id/revise-stage')
  reviseStage(@Param('id') id: string, @Body() body: ReviseStageDto) {
    return this.productions.reviseStage(id, body);
  }

  @Post(':id/revise-stage/stream')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  reviseStageStream(
    @Param('id') id: string,
    @Body() body: ReviseStageDto,
    @Res() res: Response,
  ) {
    return this.stream(res, (emit) =>
      this.productions.reviseStage(id, body, emit),
    );
  }

  @Post(':id/pause')
  pause(@Param('id') id: string) {
    return this.productions.pause(id);
  }

  @Post(':id/nodes/:nodeId/retry')
  retry(
    @Param('id') id: string,
    @Param('nodeId') nodeId: string,
    @Body() body: RetryProductionNodeDto,
  ) {
    return this.productions.retry(id, nodeId, body);
  }
}
