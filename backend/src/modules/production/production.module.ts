import { Module } from '@nestjs/common';
import { ModelsModule } from '../models/models.module';
import { CanvasModule } from '../canvas/canvas.module';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { ProductionPlanner } from './production.planner';

@Module({
  imports: [ModelsModule, CanvasModule],
  controllers: [ProductionController],
  providers: [ProductionService, ProductionPlanner],
})
export class ProductionModule {}
