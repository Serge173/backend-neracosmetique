# Mises à jour base de données (synchronize: false)

Si votre base existe déjà, exécutez les requêtes SQL suivantes pour les nouvelles fonctionnalités.

## 1. Table `contact_messages` (formulaire contact)

```sql
CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  message TEXT NOT NULL,
  read TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 2. Table `newsletter_subscribers` (newsletter)

```sql
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 3. Colonnes réinitialisation mot de passe sur `users`

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS reset_token_expires DATETIME NULL;
```

*(Sous MySQL 8.0, si `IF NOT EXISTS` n’est pas supporté pour les colonnes, exécutez une seule fois et ignorez l’erreur si les colonnes existent déjà.)*

## 4. Table `coupons`

La table `coupons` doit exister (entité déjà présente). Structure attendue :

- `id`, `code` (unique), `type` (enum 'percent' | 'fixed'), `value`, `min_order_amount`, `max_uses`, `used_count`, `valid_from`, `valid_to`, `is_active`, `created_at`, `updated_at`

Si elle n’existe pas, la créer via TypeORM en mettant temporairement `synchronize: true` une fois, ou en créant la table manuellement selon l’entité `coupons/entities/coupon.entity.ts`.
