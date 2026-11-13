import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { FileUploadDto } from '@/modules/ai/dto/stream.dto';

export class CreateProductionDto {
  @IsString()
  @IsOptional()
  canvasId?: string;

  @IsString()
  @IsNotEmpty()
  idea: string;

  @IsString()
  @IsOptional()
  ideaState?: string;

  @IsString()
  @IsOptional()
  modelId?: string;

  @IsString()
  @IsOptional()
  style?: string;

  @IsArray()
  @IsOptional()
  files?: FileUploadDto[];
}

export class ConfirmProductionDto {
  @IsArray()
  nodes: Record<string, any>[];

  @IsArray()
  edges: Record<string, any>[];
}

export class ConfirmStageDto extends ConfirmProductionDto {
  @IsString()
  @IsOptional()
  mediaMode?: 'auto' | 'manual';

  @IsBoolean()
  @IsOptional()
  continuity?: boolean;
}

export class StartMediaPhaseDto {
  @IsString()
  phase: 'references' | 'storyboards' | 'videos';
}

export class ReviseStageDto extends ConfirmProductionDto {
  @IsString()
  stage:
    | 'requirements'
    | 'story'
    | 'script'
    | 'characters'
    | 'storyboard'
    | 'imagePrompts'
    | 'videoPrompts';

  @IsString()
  @IsNotEmpty()
  feedback: string;

  @IsArray()
  @IsOptional()
  files?: FileUploadDto[];
}

export class RetryProductionNodeDto {
  @IsBoolean()
  @IsOptional()
  independent?: boolean;
}
