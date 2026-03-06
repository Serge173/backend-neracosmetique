/**
 * Script pour créer le compte administrateur
 * Usage: node scripts/create-admin.js
 */
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const ADMIN_EMAIL = 'admin@neracosmetique.ci';
const ADMIN_PASSWORD = 'Admin123!';
const ADMIN_FIRST_NAME = 'Admin';
const ADMIN_LAST_NAME = 'Nera';

async function createAdmin() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'nera_app',
    password: process.env.DB_PASSWORD || 'nera_app_secure',
    database: process.env.DB_NAME || 'nera_cosmetique',
  });

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const id = uuidv4();

  await connection.execute(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active)
     VALUES (?, ?, ?, ?, ?, 'admin', 1)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'admin'`,
    [id, ADMIN_EMAIL, passwordHash, ADMIN_FIRST_NAME, ADMIN_LAST_NAME]
  );

  console.log('\n=== Compte admin créé ===');
  console.log('Email   :', ADMIN_EMAIL);
  console.log('Mot de passe :', ADMIN_PASSWORD);
  console.log('Connexion : http://localhost:4200/compte/connexion');
  console.log('Dashboard : http://localhost:4200/admin');
  console.log('========================\n');

  await connection.end();
}

createAdmin().catch((err) => {
  console.error('Erreur:', err.message);
  process.exit(1);
});
