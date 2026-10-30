import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { streamDto } from '../../ai/dto/stream.dto';

export class AgentSubjectDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsIn(['subject', 'image', 'video', 'audio', 'text'])
  @IsOptional()
  kind?: 'subject' | 'image' | 'video' | 'audio' | 'text';

  @IsString()
  @IsOptional()
  url?: string;
}

export class AgentStreamDto extends streamDto {
  @IsArray()
  @IsOptional()
  skillIds?: string[];

  @IsArray()
  @IsOptional()
  subjects?: AgentSubjectDto[];

  @IsIn(['agent', 'chat'])
  @IsOptional()
  mode?: 'agent' | 'chat';
}
