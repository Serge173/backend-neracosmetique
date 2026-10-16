/**
 * Insère les zones de livraison par défaut (PostgreSQL).
 * Usage: node scripts/seed-delivery-zones-pg.js
 */
const { Client } = require('pg');

async function run() {
  const client = new Client(
    process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          user: process.env.DB_USERNAME || 'nera_app',
          password: process.env.DB_PASSWORD || 'nera_app_secure',
          database: process.env.DB_DATABASE || 'nera_cosmetique',
        }
  );

  await client.connect();

  await client.query(`
    INSERT INTO delivery_zones (id, name, description, price, min_order_free_delivery, estimated_days_min, estimated_days_max, is_active, created_at, updated_at)
    VALUES
      (1, 'Abidjan', 'Livraison à Abidjan', 2000, 25000, 1, 3, true, NOW(), NOW()),
      (2, 'Intérieur du pays', 'Livraison hors Abidjan', 3500, 50000, 2, 5, true, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      price = EXCLUDED.price,
      updated_at = NOW();
  `);
  await client.query(`SELECT setval(pg_get_serial_sequence('delivery_zones', 'id'), (SELECT COALESCE(MAX(id), 1) FROM delivery_zones));`);

  console.log('Zones de livraison créées (id 1 et 2).');
  await client.end();
}

run().catch((err) => {
  console.error('Erreur:', err.message);
  process.exit(1);
});
