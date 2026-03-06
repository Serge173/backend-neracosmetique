import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('delivery_zones')
export class DeliveryZone {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ name: 'min_order_free_delivery', type: 'decimal', precision: 12, scale: 2, nullable: true })
  minOrderFreeDelivery: number;

  @Column({ name: 'estimated_days_min', nullable: true })
  estimatedDaysMin: number;

  @Column({ name: 'estimated_days_max', nullable: true })
  estimatedDaysMax: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
