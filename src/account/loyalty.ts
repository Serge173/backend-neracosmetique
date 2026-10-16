/** Règles du programme de fidélité (montants en F CFA). */
export const LOYALTY = {
  /** 1 point par tranche de 1 000 F CFA d'articles livrés (hors livraison, après réduction). */
  amountPerPoint: 1000,
  /** Valeur d'un point lors de la conversion en bon d'achat. */
  pointValue: 10,
  minRedeem: 100,
  redeemStep: 100,
  voucherValidityDays: 90,
} as const;

export const LOYALTY_TIERS = [
  { key: 'member', label: 'Membre Nera', min: 0 },
  { key: 'loyal', label: 'Client fidèle', min: 50 },
  { key: 'privilege', label: 'Client privilège', min: 200 },
  { key: 'vip', label: 'Client VIP', min: 500 },
] as const;

export function pointsForAmount(amount: number): number {
  return Math.max(0, Math.floor((Number(amount) || 0) / LOYALTY.amountPerPoint));
}

export function tierFor(lifetimePoints: number) {
  let index = 0;
  LOYALTY_TIERS.forEach((t, i) => {
    if (lifetimePoints >= t.min) index = i;
  });
  const current = LOYALTY_TIERS[index];
  const next = LOYALTY_TIERS[index + 1] ?? null;
  const progress = next ? Math.min(100, Math.round(((lifetimePoints - current.min) / (next.min - current.min)) * 100)) : 100;
  return {
    key: current.key,
    label: current.label,
    next: next ? { key: next.key, label: next.label, min: next.min, missing: next.min - lifetimePoints } : null,
    progress,
  };
}
