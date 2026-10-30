import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title: string;
}
