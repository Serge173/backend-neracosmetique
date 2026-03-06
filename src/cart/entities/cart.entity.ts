import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { CartItem } from './cart-item.entity';

@Entity('cart')
export class Cart {
  @PrimaryColumn('char', { length: 36 })
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ name: 'session_id', nullable: true })
  sessionId: string | null;

  @OneToMany(() => CartItem, (item) => item.cart, { cascade: true })
  items: CartItem[];
}
