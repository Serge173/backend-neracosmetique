import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Slide } from '../slides/entities/slide.entity';
import { ContactMessage } from '../contact/entities/contact-message.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Review } from '../reviews/entities/review.entity';
import { ProductImage } from '../products/entities/product-image.entity';
import { Product } from '../products/entities/product.entity';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { NewsletterSubscriber } from '../newsletter/entities/newsletter-subscriber.entity';
import { Cart } from '../cart/entities/cart.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Coupon } from '../coupons/entities/coupon.entity';
import { DeliveryZone } from '../orders/entities/delivery-zone.entity';
import { Category } from '../categories/entities/category.entity';
import { Brand } from '../products/entities/brand.entity';

function loadEnv(): void {
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

async function count(ds: DataSource, table: string): Promise<number> {
  const rows = await ds.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
  return rows[0].n;
}

async function main(): Promise<void> {
  loadEnv();

  const ds = new DataSource({
    type: 'postgres',
    ...(process.env.DATABASE_URL
      ? { url: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true } }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_DATABASE,
        }),
    entities: [
      Slide, ContactMessage, OrderItem, Review, ProductImage, Product, Order, User,
      NewsletterSubscriber, Cart, CartItem, Payment, Coupon, DeliveryZone, Category, Brand,
    ],
    synchronize: true,
  });

  await ds.initialize();
  console.log(
    `[db:init] Schema synchronise sur ${process.env.DATABASE_URL ? 'DATABASE_URL' : `${process.env.DB_DATABASE}@${process.env.DB_HOST}:${process.env.DB_PORT}`}`,
  );

  if ((await count(ds, 'categories')) === 0) {
    await ds.query(`
      INSERT INTO categories (name, slug, description, sort_order, is_active) VALUES
        ('Soin du visage', 'soin-du-visage', 'Crèmes, sérums, démaquillants', 1, true),
        ('Maquillage', 'maquillage', 'Fond de teint, rouge à lèvres, mascara', 2, true),
        ('Corps & Bain', 'corps-bain', 'Laits corporels, huiles, douche', 3, true),
        ('Cheveux', 'cheveux', 'Shampoings, après-shampoings, soins', 4, true),
        ('Parfums', 'parfums', 'Eaux de toilette et parfums', 5, true)
      ON CONFLICT (slug) DO NOTHING`);
    console.log('[db:init] Categories creees');
  }

  if ((await count(ds, 'brands')) === 0) {
    await ds.query(`
      INSERT INTO brands (name, slug) VALUES
        ('L''Oréal Paris', 'loreal-paris'),
        ('Garnier', 'garnier'),
        ('Nivea', 'nivea'),
        ('Bioderma', 'bioderma'),
        ('La Roche-Posay', 'la-roche-posay')
      ON CONFLICT (slug) DO NOTHING`);
    console.log('[db:init] Marques creees');
  }

  if ((await count(ds, 'delivery_zones')) === 0) {
    await ds.query(`
      INSERT INTO delivery_zones (name, description, price, estimated_days_min, estimated_days_max, is_active) VALUES
        ('Abidjan', 'Livraison à domicile en moins de 48h', 1500, 1, 2, true),
        ('Intérieur pays', 'Expédition (payée avant l''expédition)', 3000, 2, 5, true)`);
    console.log('[db:init] Zones de livraison creees');
  }

  if ((await count(ds, 'products')) === 0) {
    await ds.query(`
      INSERT INTO products (category_id, brand_id, name, slug, short_description, description, price, stock_quantity, skin_type, is_featured, is_new, is_active)
      SELECT c.id, b.id, v.name, v.slug, v.short_description, v.description, v.price, v.stock, v.skin_type, v.is_featured, v.is_new, true
      FROM (VALUES
        ('soin-du-visage', 'loreal-paris', 'Crème Hydratante 24h L''Oréal', 'creme-hydratante-24h-loreal', 'Hydratation intense 24h', 'Crème de jour hydratante pour une peau confortable toute la journée. Texture fondante, sans parfum.', 8500, 50, 'Tous types', true, true),
        ('soin-du-visage', 'garnier', 'Gel Pure Active Charbon Garnier', 'gel-pure-active-charbon-garnier', 'Purifiant au charbon', 'Gel nettoyant purifiant au charbon. Idéal pour les peaux mixtes à grasses.', 4500, 80, 'Mixte', true, false),
        ('soin-du-visage', 'nivea', 'Crème Soft Nivea', 'creme-soft-nivea', 'Douceur et hydratation', 'La classique Nivea pour le visage et le corps. Hydratation et douceur.', 3500, 120, 'Tous types', false, false),
        ('soin-du-visage', 'bioderma', 'Sensibio H2O Démaquillant Bioderma', 'sensibio-h2o-demaquillant-bioderma', 'Démaquillant micellaire', 'Eau micellaire démaquillante pour le visage et les yeux. Peaux sensibles.', 6500, 45, 'Sensible', true, true),
        ('maquillage', 'loreal-paris', 'Rouge à lèvres Color Riche L''Oréal', 'rouge-levres-color-riche-loreal', 'Rouge à lèvres satiné', 'Rouge à lèvres longue tenue, fini satiné. Large palette de couleurs.', 5500, 60, NULL, false, true),
        ('maquillage', 'garnier', 'Mascara Volume Panorama Garnier', 'mascara-volume-panorama-garnier', 'Volume et courbe', 'Mascara volume intense et courbe. Résultat spectaculaire.', 4200, 70, NULL, false, false),
        ('corps-bain', 'nivea', 'Lait Corps Nivea', 'lait-corps-nivea', 'Lait corporel hydratant', 'Lait corps pour une peau douce et hydratée. Absorption rapide.', 4000, 90, NULL, false, false),
        ('corps-bain', 'la-roche-posay', 'Lipikar Baume AP+ La Roche-Posay', 'lipikar-baume-ap-la-roche-posay', 'Corps très sec et irrité', 'Baume relipidant pour le corps. Peaux très sèches et irritées.', 9500, 35, 'Sèche', true, false),
        ('cheveux', 'garnier', 'Shampoing Fructis Garnier', 'shampoing-fructis-garnier', 'Fruits et vitamines', 'Shampoing nutritif aux fruits. Cheveux nourris et brillants.', 2800, 100, NULL, false, false),
        ('cheveux', 'loreal-paris', 'Elvital Full Restore 5 L''Oréal', 'elvital-full-restore-5-loreal', 'Réparation intense', 'Shampoing et après-shampoing réparation. Cheveux abîmés.', 5200, 55, NULL, false, true)
      ) AS v(category_slug, brand_slug, name, slug, short_description, description, price, stock, skin_type, is_featured, is_new)
      JOIN categories c ON c.slug = v.category_slug
      JOIN brands b ON b.slug = v.brand_slug
      ON CONFLICT (slug) DO NOTHING`);
    await ds.query(`
      INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
      SELECT p.id, 'https://images.unsplash.com/photo-' || v.photo || '?auto=format&fit=crop&w=900&h=900&q=85', p.name, 0, true
      FROM (VALUES
        ('creme-hydratante-24h-loreal', '1601049541289-9b1b7bbbfe19'),
        ('gel-pure-active-charbon-garnier', '1620916566398-39f1143ab7be'),
        ('creme-soft-nivea', '1625772452859-1c03d5bf1137'),
        ('sensibio-h2o-demaquillant-bioderma', '1631729371254-42c2892f0e6e'),
        ('rouge-levres-color-riche-loreal', '1586495777744-4413f21062fa'),
        ('mascara-volume-panorama-garnier', '1487412947147-5cebf100ffc2'),
        ('lait-corps-nivea', '1608248597279-f99d160bfcbc'),
        ('lipikar-baume-ap-la-roche-posay', '1556228578-8c89e6adf883'),
        ('shampoing-fructis-garnier', '1535585209827-a15fcdbc4c2d'),
        ('elvital-full-restore-5-loreal', '1527799820374-dcf8d9d4a388')
      ) AS v(slug, photo)
      JOIN products p ON p.slug = v.slug
      WHERE NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id)`);
    console.log('[db:init] Produits de demonstration crees');
  }

  const admins = await ds.query(`SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin'`);
  if (admins[0].n === 0) {
    const hash = await bcrypt.hash('Admin123!', 10);
    await ds.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, 'Admin', 'Nera', 'admin', true)
       ON CONFLICT (email) DO UPDATE SET role = 'admin', is_active = true`,
      ['admin@neracosmetique.ci', hash],
    );
    console.log('[db:init] Compte admin cree : admin@neracosmetique.ci / Admin123!');
  }

  await ds.destroy();
  console.log('[db:init] Base prete.');
}

main().catch((err) => {
  console.error('[db:init] Echec :', err.message || err);
  process.exit(1);
});
