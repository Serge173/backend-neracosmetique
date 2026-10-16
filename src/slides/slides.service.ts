import { Injectable, OnModuleInit, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Slide } from './entities/slide.entity';

@Injectable()
export class SlidesService implements OnModuleInit {
  private readonly logger = new Logger(SlidesService.name);

  constructor(
    @InjectRepository(Slide)
    private slideRepository: Repository<Slide>,
  ) {}

  async onModuleInit(): Promise<void> {
    // Crée la table slides si elle n'existe pas encore (en dev local, car synchronize est désactivé)
    try {
      await this.slideRepository.query(`
        CREATE TABLE IF NOT EXISTS slides (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT NULL,
          image_url VARCHAR(500) NULL,
          link VARCHAR(255) NULL,
          link_label VARCHAR(100) NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      this.logger.log('slides table is present.');

      await this.slideRepository.query(`
        ALTER TABLE slides
          ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN NOT NULL DEFAULT FALSE
      `);

      const outdatedImages: [string, string][] = [
        ['photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1600&q=90', 'photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=2400&q=85'],
        ['photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=90', 'photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=2400&q=85'],
        ['photo-1522336572468-97b06e8ef143?auto=format&fit=crop&w=1600&q=90', 'photo-1629198688000-71f23e745b6e?auto=format&fit=crop&w=2400&q=85'],
      ];
      for (const [oldPath, newPath] of outdatedImages) {
        await this.slideRepository.query(
          `UPDATE slides SET image_url = $2 WHERE image_url = $1`,
          [`https://images.unsplash.com/${oldPath}`, `https://images.unsplash.com/${newPath}`],
        );
      }
      await this.slideRepository.query(
        `UPDATE slides SET description = $2 WHERE description = $1`,
        [
          'Abidjan et intérieur du pays, paiement à la livraison ou Mobile Money sécurisé.',
          'Abidjan et intérieur du pays, paiement en espèces à la livraison.',
        ],
      );

      const count = await this.slideRepository.count();
      if (count === 0) {
        await this.slideRepository.save([
          this.slideRepository.create({
            title: 'Bienvenue sur Nera Cosmétique',
            description: 'Votre boutique beauté, soins et maquillage importés de France pour sublimer toutes les peaux.',
            imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=2400&q=85',
            link: '/boutique',
            linkLabel: 'Découvrir la boutique',
            isActive: true,
            isPermanent: true,
            sortOrder: 1,
          }),
          this.slideRepository.create({
            title: 'Rituels de beauté premium',
            description: 'Des routines complètes pour le visage et le corps, sélectionnées avec exigence.',
            imageUrl: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=2400&q=85',
            link: '/boutique',
            linkLabel: 'Voir nos rituels',
            isActive: true,
            sortOrder: 2,
          }),
          this.slideRepository.create({
            title: 'Livraison rapide en Côte d’Ivoire',
            description: 'Abidjan et intérieur du pays, paiement en espèces à la livraison.',
            imageUrl: 'https://images.unsplash.com/photo-1629198688000-71f23e745b6e?auto=format&fit=crop&w=2400&q=85',
            link: '/boutique',
            linkLabel: 'Commander maintenant',
            isActive: true,
            sortOrder: 3,
          }),
        ]);
        this.logger.log('Inserted default slides for homepage.');
      }
    } catch (err: any) {
      this.logger.error('Failed to ensure slides table exists', err?.message ?? String(err));
    }
  }

  async getPublicSlides(): Promise<Slide[]> {
    return this.slideRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async findAll(): Promise<Slide[]> {
    return this.slideRepository.find({
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async create(dto: { title: string; description?: string; imageUrl?: string; link?: string; linkLabel?: string; sortOrder?: number; isActive?: boolean }): Promise<Slide> {
    const title = String(dto.title ?? '').trim();
    if (!title) {
      throw new BadRequestException('Le titre du slide est obligatoire.');
    }
    const slide = this.slideRepository.create({
      title,
      description: dto.description?.trim() || null,
      imageUrl: dto.imageUrl?.trim() || null,
      link: dto.link?.trim() || null,
      linkLabel: dto.linkLabel?.trim() || null,
      sortOrder: Number.isFinite(dto.sortOrder) ? Number(dto.sortOrder) : 0,
      isActive: dto.isActive !== false,
      isPermanent: false,
    });
    return this.slideRepository.save(slide);
  }

  async update(id: number, dto: Partial<{ title: string; description: string; imageUrl: string; link: string; linkLabel: string; sortOrder: number; isActive: boolean }>): Promise<Slide> {
    const slide = await this.slideRepository.findOne({ where: { id } });
    if (!slide) {
      throw new NotFoundException('Slide introuvable');
    }
    if (dto.title !== undefined) {
      const t = String(dto.title).trim();
      if (!t) throw new BadRequestException('Le titre ne peut pas être vide.');
      slide.title = t;
    }
    if (dto.description !== undefined) {
      slide.description = dto.description?.trim() || null;
    }
    if (dto.imageUrl !== undefined) {
      slide.imageUrl = dto.imageUrl?.trim() || null;
    }
    if (dto.link !== undefined) {
      slide.link = dto.link?.trim() || null;
    }
    if (dto.linkLabel !== undefined) {
      slide.linkLabel = dto.linkLabel?.trim() || null;
    }
    if (dto.sortOrder !== undefined && Number.isFinite(dto.sortOrder)) {
      slide.sortOrder = Number(dto.sortOrder);
    }
    if (dto.isActive !== undefined) {
      if (slide.isPermanent && dto.isActive === false) {
        throw new BadRequestException('Le slide de bienvenue permanent ne peut pas être désactivé.');
      }
      slide.isActive = !!dto.isActive;
    }
    return this.slideRepository.save(slide);
  }

  async remove(id: number): Promise<void> {
    const slide = await this.slideRepository.findOne({ where: { id } });
    if (!slide) {
      throw new NotFoundException('Slide introuvable');
    }
    if (slide.isPermanent) {
      throw new BadRequestException('Le slide de bienvenue permanent ne peut pas être supprimé.');
    }
    await this.slideRepository.remove(slide);
  }
}

