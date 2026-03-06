-- Migration: limiter les colonnes produits / images pour éviter "Data too long" et rester cohérent avec l'API.
-- Exécuter une seule fois sur la base nera_cosmetique (ex: mysql -u user -p nera_cosmetique < migrations/001-product-column-lengths.sql).

-- Images produit : URL peut être longue (ex. URLs d'upload), alt texte court
ALTER TABLE product_images
  MODIFY COLUMN url VARCHAR(500) NOT NULL,
  MODIFY COLUMN alt VARCHAR(255) DEFAULT NULL;

-- Produit : nom et slug déjà souvent en 255, skin_type limité à 120
ALTER TABLE products
  MODIFY COLUMN name VARCHAR(255) NOT NULL,
  MODIFY COLUMN slug VARCHAR(255) NOT NULL,
  MODIFY COLUMN skin_type VARCHAR(120) DEFAULT NULL;
