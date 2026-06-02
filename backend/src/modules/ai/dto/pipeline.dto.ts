import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class PipelineDto {
  @IsString()
  @IsNotEmpty()
  idea: string;

  @IsString()
  @IsOptional()
  userRequirement?: string;
}
