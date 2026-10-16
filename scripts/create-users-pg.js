/**
 * Crée le compte admin et un compte client de test (PostgreSQL).
 * Usage: node scripts/create-users-pg.js
 * Depuis le dossier backend, avec .env configuré (DB_* ou DATABASE_URL).
 */
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

const ADMIN_EMAIL = 'admin@neracosmetique.ci';
const ADMIN_PASSWORD = 'Admin123!';
const CLIENT_EMAIL = 'client@neracosmetique.ci';
const CLIENT_PASSWORD = 'Client123!';

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

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const clientHash = await bcrypt.hash(CLIENT_PASSWORD, 10);

  await client.query(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, 'admin', true)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'`,
    [uuidv4(), ADMIN_EMAIL, adminHash, 'Admin', 'Nera']
  );

  await client.query(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, 'customer', true)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'customer'`,
    [uuidv4(), CLIENT_EMAIL, clientHash, 'Client', 'Test']
  );

  console.log('\n=== Comptes créés / mis à jour ===\n');
  console.log('--- ADMIN ---');
  console.log('  Email      :', ADMIN_EMAIL);
  console.log('  Mot de passe :', ADMIN_PASSWORD);
  console.log('  Connexion  : http://localhost:4200/compte/connexion');
  console.log('  Dashboard  : http://localhost:4200/admin\n');
  console.log('--- CLIENT (utilisateur) ---');
  console.log('  Email      :', CLIENT_EMAIL);
  console.log('  Mot de passe :', CLIENT_PASSWORD);
  console.log('  Connexion  : http://localhost:4200/compte/connexion\n');
  console.log('========================\n');

  await client.end();
}

run().catch((err) => {
  console.error('Erreur:', err.message);
  process.exit(1);
});
