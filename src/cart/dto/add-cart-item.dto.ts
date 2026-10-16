import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddCartItemDto {
  @Type(() => Number)
  @IsInt()
  productId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}
