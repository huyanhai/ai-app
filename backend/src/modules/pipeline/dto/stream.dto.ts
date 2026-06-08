import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsOptional,
  IsObject,
  IsNumber,
} from 'class-validator';
import { HumanMessage } from 'langchain';

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

  @IsString()
  @IsOptional()
  firstFrameUrl?: string;

  @IsString()
  @IsOptional()
  lastFrameUrl?: string;
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
  @IsArray()
  @IsNotEmpty()
  message: HumanMessage['content'][0][];

  @IsObject()
  @IsOptional()
  config?: ConfigDto;

  @IsArray()
  @IsOptional()
  textList?: TextListDTO[];
}
