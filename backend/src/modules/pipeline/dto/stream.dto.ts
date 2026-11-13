import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsOptional,
  IsObject,
  IsNumber,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { ContentBlock } from 'langchain';

export class ConfigDto {
  @IsString()
  @IsNotEmpty()
  ratio: string;

  @IsNumber()
  @IsOptional()
  duration?: number;

  @IsString()
  @IsOptional()
  videoMode?: 'textToVideo' | 'imageToVideo' | 'firstAndLastFrameToVideo';
  edit?: boolean;
  outpaint?: boolean;

  @IsString()
  @IsOptional()
  preset?: string;

  @IsString()
  @IsOptional()
  firstFrameUrl?: string;

  @IsString()
  @IsOptional()
  lastFrameUrl?: string;

  @IsBoolean()
  @IsOptional()
  extractLastFrame?: boolean;

  @IsBoolean()
  @IsOptional()
  promptExtend?: boolean;

  @IsNumber()
  @IsOptional()
  count?: number;

  @IsString()
  @IsOptional()
  resolution?: string;
}

export class TextListDTO {
  @IsString()
  @IsNotEmpty()
  action: string;

  @IsString()
  @IsNotEmpty()
  action_input: string;

  @IsObject()
  @IsOptional()
  supplementary: { style: string; ratio: string };
}

export class StreamDto {
  @IsIn(['sceneReference'])
  @IsOptional()
  assetKind?: 'sceneReference';

  @IsArray()
  @IsNotEmpty()
  message: ContentBlock[];

  @IsObject()
  @IsOptional()
  config?: ConfigDto;

  @IsString()
  @IsOptional()
  modelId?: string;

  @IsArray()
  @IsOptional()
  textList?: TextListDTO[];
}
