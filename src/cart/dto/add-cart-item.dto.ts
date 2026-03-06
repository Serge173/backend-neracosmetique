import { IsInt, Min } from 'class-validator';

export class AddCartItemDto {
  @IsInt()
  productId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}
