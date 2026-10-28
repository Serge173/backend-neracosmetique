import { BadRequestException } from '@nestjs/common';

/** Règles du programme de fidélité (montants en F CFA). */
export const LOYALTY = {
  /** 1 point par tranche de 1 000 F CFA d'articles livrés (hors livraison, après réduction). */
  amountPerPoint: 1000,
  /** Valeur d'un point par défaut ; l'admin peut la modifier (voir readLoyaltySettings). */
  pointValue: 50,
  /** Points offerts à la création du compte client. */
  welcomeBonus: 10,
  minRedeem: 1,
  redeemStep: 1,
  voucherValidityDays: 90,
} as const;

export interface LoyaltySettings {
  pointValue: number;
  redeemEnabled: boolean;
}

const SETTINGS_KEY = 'loyalty';
const MAX_POINT_VALUE = 100000;
type Queryable = { query: (sql: string, params?: unknown[]) => Promise<any> };

/** Réglages modifiables depuis l'admin (valeur d'un point, conversion bloquée ou non). */
export async function readLoyaltySettings(db: Queryable): Promise<LoyaltySettings> {
  const defaults: LoyaltySettings = { pointValue: LOYALTY.pointValue, redeemEnabled: true };
  try {
    const [row] = await db.query(`select data from site_content where key = $1`, [SETTINGS_KEY]);
    const data = row?.data ?? {};
    const pointValue = Number(data.pointValue);
    return {
      pointValue: Number.isInteger(pointValue) && pointValue >= 1 && pointValue <= MAX_POINT_VALUE ? pointValue : defaults.pointValue,
      redeemEnabled: typeof data.redeemEnabled === 'boolean' ? data.redeemEnabled : defaults.redeemEnabled,
    };
  } catch {
    return defaults;
  }
}

export async function writeLoyaltySettings(db: Queryable, body: any, userId: string | null): Promise<LoyaltySettings> {
  const current = await readLoyaltySettings(db);
  const next = { ...current };
  if (body?.pointValue !== undefined) {
    const v = Number(body.pointValue);
    if (!Number.isInteger(v) || v < 1 || v > MAX_POINT_VALUE) {
      throw new BadRequestException(`La valeur d'un point doit être un nombre entier entre 1 et ${MAX_POINT_VALUE.toLocaleString('fr-FR')} F CFA.`);
    }
    next.pointValue = v;
  }
  if (body?.redeemEnabled !== undefined) {
    if (typeof body.redeemEnabled !== 'boolean') throw new BadRequestException('Valeur invalide pour le blocage de la conversion.');
    next.redeemEnabled = body.redeemEnabled;
  }
  await db.query(
    `insert into site_content (key, data, updated_at, updated_by) values ($1, $2::jsonb, now(), $3)
     on conflict (key) do update set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by`,
    [SETTINGS_KEY, JSON.stringify(next), userId],
  );
  return next;
}

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
