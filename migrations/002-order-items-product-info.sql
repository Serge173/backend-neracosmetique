-- Infos produit dans order_items (nom exact, description, marque) pour éviter la confusion à la livraison
-- Exécuter une seule fois sur la base (PostgreSQL)

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS product_short_description TEXT,
  ADD COLUMN IF NOT EXISTS product_brand_name VARCHAR(100);
