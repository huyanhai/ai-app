import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProductionDto {
  @IsString()
  @IsNotEmpty()
  idea: string;

  @IsString()
  @IsOptional()
  modelId?: string;

  @IsString()
  @IsOptional()
  style?: string;
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
    | 'script'
    | 'characters'
    | 'storyboard'
    | 'imagePrompts'
    | 'videoPrompts';

  @IsString()
  @IsNotEmpty()
  feedback: string;
}

export class RetryProductionNodeDto {
  @IsBoolean()
  @IsOptional()
  independent?: boolean;
}
