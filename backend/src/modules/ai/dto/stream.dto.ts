import { IsNotEmpty, IsString, IsArray, IsOptional } from "class-validator";

export class FileUploadDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  content: string; // Base64 encoding

  @IsString()
  @IsNotEmpty()
  type: string;    // MIME type
}

export class streamDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsArray()
  @IsOptional()
  files?: FileUploadDto[];
}