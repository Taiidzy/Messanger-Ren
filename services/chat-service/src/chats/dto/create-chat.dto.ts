import { IsInt, IsPositive } from 'class-validator';

export class CreateChatDto {
  @IsInt({ message: 'ID собеседника должно быть целым числом' })
  @IsPositive({ message: 'ID собеседника должно быть положительным числом' })
  companion_id: number;
}