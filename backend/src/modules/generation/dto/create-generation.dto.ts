import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateGenerationDto {
  @IsIn(['image', 'video', 'music', 'audio'])
  kind: 'image' | 'video' | 'music' | 'audio';

  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsString()
  @IsNotEmpty()
  modelId: string;

  @IsString()
  @IsNotEmpty()
  modelName: string;

  @IsObject()
  config: Record<string, unknown>;

  @IsString()
  @IsOptional()
  referenceUrl?: string;
}
