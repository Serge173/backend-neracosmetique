/** Montant de la remise en F CFA entiers (pas de centimes), jamais supérieur au sous-total. */
export function computeCouponDiscount(type: string, rawValue: unknown, subtotal: number): number {
  const value = Number(rawValue);
  const base = Math.max(0, Number(subtotal) || 0);
  if (!Number.isFinite(value) || value <= 0 || base <= 0) return 0;
  const discount = type === 'percent' ? (base * Math.min(value, 100)) / 100 : value;
  return Math.min(Math.round(discount), Math.round(base));
}
