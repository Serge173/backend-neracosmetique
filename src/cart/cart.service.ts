import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { ProductsService } from '../products/products.service';

export interface CartItemData {
  id: number;
  productId: number;
  productName: string;
  productSlug: string;
  productImage?: string;
  price: number;
  quantity: number;
}

export interface CartData {
  items: CartItemData[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
}

const emptyCartData = (): CartData => ({
  items: [],
  subtotal: 0,
  shipping: 0,
  discount: 0,
  total: 0,
});

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private cartItemRepository: Repository<CartItem>,
    private productsService: ProductsService,
  ) {}

  async getCart(userId: string | null): Promise<CartData> {
    if (!userId) return emptyCartData();
    const cart = await this.cartRepository.findOne({
      where: { userId },
      relations: ['items', 'items.product', 'items.product.images'],
    });
    if (!cart || !cart.items?.length) return emptyCartData();
    return this.toCartData(cart);
  }

  async addItem(userId: string, productId: number, quantity: number): Promise<CartData> {
    const product = await this.productsService.findOne(productId);
    if (!product) throw new NotFoundException('Product not found');

    let cart = await this.cartRepository.findOne({ where: { userId }, relations: ['items'] });
    if (!cart) {
      cart = this.cartRepository.create({ id: uuidv4(), userId });
      await this.cartRepository.save(cart);
    }

    let item = await this.cartItemRepository.findOne({ where: { cartId: cart.id, productId } });
    if (item) {
      item.quantity += quantity;
      await this.cartItemRepository.save(item);
    } else {
      item = this.cartItemRepository.create({ cartId: cart.id, productId, quantity });
      await this.cartItemRepository.save(item);
    }

    const fullCart = await this.cartRepository.findOne({
      where: { id: cart.id },
      relations: ['items', 'items.product', 'items.product.images'],
    });
    return this.toCartData(fullCart!);
  }

  async updateItemQuantity(userId: string, itemId: number, quantity: number): Promise<CartData> {
    const item = await this.cartItemRepository.findOne({
      where: { id: itemId },
      relations: ['cart'],
    });
    if (!item || item.cart.userId !== userId) throw new NotFoundException('Item not found');
    if (quantity <= 0) {
      await this.cartItemRepository.remove(item);
    } else {
      item.quantity = quantity;
      await this.cartItemRepository.save(item);
    }
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: number): Promise<CartData> {
    const item = await this.cartItemRepository.findOne({
      where: { id: itemId },
      relations: ['cart'],
    });
    if (!item || item.cart.userId !== userId) throw new NotFoundException('Item not found');
    await this.cartItemRepository.remove(item);
    return this.getCart(userId);
  }

  async clearCart(userId: string): Promise<CartData> {
    const cart = await this.cartRepository.findOne({ where: { userId }, relations: ['items'] });
    if (cart?.items?.length) {
      await this.cartItemRepository.remove(cart.items);
    }
    return this.getCart(userId);
  }

  private toCartData(cart: Cart): CartData {
    const items: CartItemData[] = (cart.items || []).map((i) => {
      const p = i.product;
      const price = p ? Number(p.promoPrice ?? p.price) : 0;
      const productImage = p?.images?.length
        ? (p.images.find((img: { isPrimary: boolean }) => img.isPrimary)?.url ?? p.images[0]?.url)
        : undefined;
      return {
        id: i.id,
        productId: i.productId,
        productName: p?.name ?? 'Produit',
        productSlug: p?.slug ?? '',
        productImage,
        price,
        quantity: i.quantity,
      };
    });
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return {
      items,
      subtotal,
      shipping: 0,
      discount: 0,
      total: subtotal,
    };
  }
}
