import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  ABOUT_LIMITS,
  AboutContent,
  DEFAULT_ABOUT,
  DEFAULT_LEGAL,
  DEFAULT_SETTINGS,
  LEGAL_LIMITS,
  LegalContent,
  PAGES,
  SETTINGS_SPEC,
  SiteSettings,
} from './site.defaults';

const SETTINGS_KEY = 'settings';
const pageKey = (slug: string) => `page:${slug}`;

function clean(value: unknown, max: number, multiline = false): string {
  const raw = typeof value === 'string' ? value : value == null ? '' : String(value);
  const normalized = raw.replace(/\r\n?/g, '\n');
  const stripped = multiline
    ? normalized.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n')
    : normalized.replace(/[\u0000-\u001f\u007f]/g, ' ');
  return stripped.trim().substring(0, max);
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

@Injectable()
export class SiteService implements OnModuleInit {
  private readonly logger = new Logger(SiteService.name);

  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS site_content (
          key VARCHAR(80) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL
        )`);
    } catch (err: any) {
      this.logger.error('Failed to ensure site_content table', err?.message ?? String(err));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Informations de la boutique                                         */
  /* ------------------------------------------------------------------ */

  async getSettings(): Promise<SiteSettings & { updatedAt: string | null }> {
    const row = await this.read(SETTINGS_KEY);
    const stored = (row?.data ?? {}) as Partial<SiteSettings>;
    const settings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(SETTINGS_SPEC)) {
      if (typeof stored[key] === 'string') settings[key] = stored[key];
    }
    return { ...settings, updatedAt: row?.updated_at ?? null };
  }

  async updateSettings(body: Record<string, unknown>, userId: string) {
    if (!body || typeof body !== 'object') throw new BadRequestException('Données invalides');
    const current = await this.getSettings();
    const next: SiteSettings = { ...DEFAULT_SETTINGS };
    for (const [key, spec] of Object.entries(SETTINGS_SPEC)) {
      const value = key in body ? clean(body[key], spec.max, spec.kind === 'multiline') : current[key];
      next[key] = this.validateSetting(key, spec.kind, value);
    }
    if (!next.storeName) throw new BadRequestException('Le nom de la boutique est obligatoire');
    await this.write(SETTINGS_KEY, next, userId);
    return this.getSettings();
  }

  private validateSetting(key: string, kind: string, value: string): string {
    if (!value) return '';
    if (kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new BadRequestException('Adresse e-mail invalide');
    }
    if (kind === 'phone') {
      const digits = value.replace(/\D/g, '');
      if (!/^[+0-9 ().-]+$/.test(value) || digits.length < 8 || digits.length > 15) {
        throw new BadRequestException(key === 'whatsapp' ? 'Numéro WhatsApp invalide' : 'Numéro de téléphone invalide');
      }
    }
    if (kind === 'url' && !isHttpsUrl(value)) {
      throw new BadRequestException(`Lien invalide pour « ${key} » : il doit commencer par https://`);
    }
    return value;
  }

  /* ------------------------------------------------------------------ */
  /* Pages                                                               */
  /* ------------------------------------------------------------------ */

  async listPages() {
    const rows: { key: string; updated_at: string }[] = await this.dataSource.query(
      `select key, updated_at from site_content where key like 'page:%'`,
    );
    const updated = new Map(rows.map((r) => [r.key, r.updated_at]));
    return Object.entries(PAGES).map(([slug, meta]) => ({
      slug,
      kind: meta.kind,
      label: meta.label,
      customized: updated.has(pageKey(slug)),
      updatedAt: updated.get(pageKey(slug)) ?? null,
    }));
  }

  async getPage(slug: string) {
    const meta = this.pageMeta(slug);
    const row = await this.read(pageKey(slug));
    const fallback = meta.kind === 'about' ? DEFAULT_ABOUT : DEFAULT_LEGAL[slug];
    const content = row?.data ? this.normalize(slug, row.data, false) : fallback;
    return { slug, kind: meta.kind, label: meta.label, content, updatedAt: row?.updated_at ?? null };
  }

  async updatePage(slug: string, body: unknown, userId: string) {
    this.pageMeta(slug);
    const content = this.normalize(slug, (body as { content?: unknown })?.content ?? body, true);
    await this.write(pageKey(slug), content, userId);
    return this.getPage(slug);
  }

  async resetPage(slug: string) {
    this.pageMeta(slug);
    await this.dataSource.query(`delete from site_content where key = $1`, [pageKey(slug)]);
    return this.getPage(slug);
  }

  private pageMeta(slug: string) {
    const meta = PAGES[slug];
    if (!meta) throw new NotFoundException('Page introuvable');
    return meta;
  }

  private normalize(slug: string, input: unknown, strict: boolean): AboutContent | LegalContent {
    const data = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    return PAGES[slug].kind === 'about' ? this.normalizeAbout(data, strict) : this.normalizeLegal(data, strict);
  }

  private normalizeAbout(data: Record<string, unknown>, strict: boolean): AboutContent {
    const out = {} as AboutContent;
    for (const [key, max] of Object.entries(ABOUT_LIMITS)) {
      const multiline = ['storyBody', 'storyLead', 'missionText', 'visionText', 'heroTagline', 'ctaText'].includes(key);
      out[key] = clean(data[key], max, multiline);
    }
    if (out.imageUrl && !isHttpsUrl(out.imageUrl) && !/^\/assets\/[\w./-]+$/.test(out.imageUrl)) {
      if (strict) throw new BadRequestException("Lien de l'image invalide");
      out.imageUrl = DEFAULT_ABOUT.imageUrl;
    }
    const list = Array.isArray(data.commitments) ? data.commitments.slice(0, 8) : [];
    out.commitments = list
      .map((c: any) => ({ title: clean(c?.title, 120), text: clean(c?.text, 600, true) }))
      .filter((c) => c.title || c.text);
    if (strict && !out.heroTitle) throw new BadRequestException('Le titre principal est obligatoire');
    return out;
  }

  private normalizeLegal(data: Record<string, unknown>, strict: boolean): LegalContent {
    const title = clean(data.title, LEGAL_LIMITS.title);
    const intro = clean(data.intro, LEGAL_LIMITS.intro, true);
    const list = Array.isArray(data.sections) ? data.sections : [];
    if (strict && list.length > LEGAL_LIMITS.sections) {
      throw new BadRequestException(`${LEGAL_LIMITS.sections} sections maximum`);
    }
    const sections = list
      .slice(0, LEGAL_LIMITS.sections)
      .map((s: any) => ({ heading: clean(s?.heading, LEGAL_LIMITS.heading), body: clean(s?.body, LEGAL_LIMITS.body, true) }))
      .filter((s) => s.heading || s.body);
    if (strict && !title) throw new BadRequestException('Le titre de la page est obligatoire');
    return { title, intro, sections };
  }

  /* ------------------------------------------------------------------ */

  private async read(key: string): Promise<{ data: unknown; updated_at: string } | null> {
    const rows = await this.dataSource.query(`select data, updated_at from site_content where key = $1`, [key]);
    return rows[0] ?? null;
  }

  private async write(key: string, data: unknown, userId: string): Promise<void> {
    await this.dataSource.query(
      `insert into site_content (key, data, updated_at, updated_by) values ($1, $2::jsonb, now(), $3)
       on conflict (key) do update set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by`,
      [key, JSON.stringify(data), userId ?? null],
    );
  }
}
