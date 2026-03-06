/**
 * Insère 10 produits cosmétiques pour les tests
 * Usage: node scripts/seed-products.js
 */
const mysql = require('mysql2/promise');

const products = [
  { categoryId: 1, brandId: 1, name: 'Crème Hydratante 24h L\'Oréal', slug: 'creme-hydratante-24h-loreal', shortDesc: 'Hydratation intense 24h', desc: 'Crème de jour hydratante.', price: 8500, stock: 50, skinType: 'Tous types', featured: 1, isNew: 1 },
  { categoryId: 1, brandId: 2, name: 'Gel Pure Active Charbon Garnier', slug: 'gel-pure-active-charbon-garnier', shortDesc: 'Purifiant au charbon', desc: 'Gel nettoyant purifiant.', price: 4500, stock: 80, skinType: 'Mixte', featured: 1, isNew: 0 },
  { categoryId: 1, brandId: 3, name: 'Crème Soft Nivea', slug: 'creme-soft-nivea', shortDesc: 'Douceur et hydratation', desc: 'La classique Nivea.', price: 3500, stock: 120, skinType: 'Tous types', featured: 0, isNew: 0 },
  { categoryId: 1, brandId: 4, name: 'Sensibio H2O Démaquillant Bioderma', slug: 'sensibio-h2o-demacquillant-bioderma', shortDesc: 'Démaquillant micellaire', desc: 'Eau micellaire peaux sensibles.', price: 6500, stock: 45, skinType: 'Sensible', featured: 1, isNew: 1 },
  { categoryId: 2, brandId: 1, name: 'Rouge à lèvres Color Riche L\'Oréal', slug: 'rouge-levres-color-riche-loreal', shortDesc: 'Rouge satiné', desc: 'Longue tenue.', price: 5500, stock: 60, skinType: null, featured: 0, isNew: 1 },
  { categoryId: 2, brandId: 2, name: 'Mascara Volume Panorama Garnier', slug: 'mascara-volume-panorama-garnier', shortDesc: 'Volume et courbe', desc: 'Mascara volume intense.', price: 4200, stock: 70, skinType: null, featured: 0, isNew: 0 },
  { categoryId: 3, brandId: 3, name: 'Lait Corps Nivea', slug: 'lait-corps-nivea', shortDesc: 'Lait corporel', desc: 'Peau douce et hydratée.', price: 4000, stock: 90, skinType: null, featured: 0, isNew: 0 },
  { categoryId: 3, brandId: 5, name: 'Lipikar Baume AP+ La Roche-Posay', slug: 'lipikar-baume-ap-la-roche-posay', shortDesc: 'Corps très sec', desc: 'Baume relipidant.', price: 9500, stock: 35, skinType: 'Sèche', featured: 1, isNew: 0 },
  { categoryId: 4, brandId: 2, name: 'Shampoing Fructis Garnier', slug: 'shampoing-fructis-garnier', shortDesc: 'Fruits et vitamines', desc: 'Cheveux nourris.', price: 2800, stock: 100, skinType: null, featured: 0, isNew: 0 },
  { categoryId: 4, brandId: 1, name: 'Elvital Full Restore 5 L\'Oréal', slug: 'elvital-full-restore-5-loreal', shortDesc: 'Réparation intense', desc: 'Cheveux abîmés.', price: 5200, stock: 55, skinType: null, featured: 0, isNew: 1 },
];

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'nera_app',
    password: process.env.DB_PASSWORD || 'nera_app_secure',
    database: process.env.DB_NAME || 'nera_cosmetique',
  });

  for (const p of products) {
    try {
      await conn.execute(
        `INSERT INTO products (category_id, brand_id, name, slug, short_description, description, price, stock_quantity, skin_type, is_featured, is_new, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE stock_quantity = VALUES(stock_quantity), price = VALUES(price)`,
        [p.categoryId, p.brandId, p.name, p.slug, p.shortDesc, p.desc, p.price, p.stock, p.skinType, p.featured, p.isNew]
      );
      const [[row]] = await conn.query('SELECT id FROM products WHERE slug = ?', [p.slug]);
      const productId = row?.id;
      if (productId) {
        await conn.execute(
          `INSERT IGNORE INTO product_images (product_id, url, alt, sort_order, is_primary) VALUES (?, ?, ?, 0, 1)`,
          [productId, 'https://via.placeholder.com/400?text=Produit', p.name]
        );
      }
    } catch (e) {
      console.error(p.slug, e.message);
    }
  }

  console.log('10 produits cosmétiques insérés (ou déjà présents).');
  await conn.end();
}

run().catch(console.error);
