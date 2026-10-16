import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Brand } from './entities/brand.entity';

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(Brand)
    private brandRepository: Repository<Brand>,
  ) {}

  async findAll(): Promise<Brand[]> {
    return this.brandRepository.find({ order: { name: 'ASC' } });
  }

  async create(dto: { name: string; slug?: string; logoUrl?: string }): Promise<Brand> {
    const name = String(dto.name ?? '').trim();
    if (!name) throw new BadRequestException('Le nom de la marque est obligatoire.');
    const slug = (dto.slug?.trim() || this.slugify(name)).slice(0, 255);
    const existing = await this.brandRepository.findOne({ where: { slug } });
    if (existing) throw new BadRequestException('Une marque avec ce slug existe déjà.');
    const brand = this.brandRepository.create({ name, slug, logoUrl: dto.logoUrl?.trim() || null });
    return this.brandRepository.save(brand);
  }

  async update(id: number, dto: { name?: string; slug?: string; logoUrl?: string }): Promise<Brand> {
    const brand = await this.brandRepository.findOne({ where: { id } });
    if (!brand) throw new NotFoundException('Marque introuvable');
    if (dto.name !== undefined) {
      const name = String(dto.name).trim();
      if (!name) throw new BadRequestException('Le nom ne peut pas être vide.');
      brand.name = name;
    }
    if (dto.slug !== undefined) {
      const slug = String(dto.slug).trim().slice(0, 255);
      if (slug) {
        const existing = await this.brandRepository.findOne({ where: { slug } });
        if (existing && existing.id !== id) throw new BadRequestException('Ce slug est déjà utilisé.');
        brand.slug = slug;
      }
    }
    if (dto.logoUrl !== undefined) brand.logoUrl = dto.logoUrl?.trim() || null;
    return this.brandRepository.save(brand);
  }

  async remove(id: number): Promise<void> {
    const brand = await this.brandRepository.findOne({ where: { id } });
    if (!brand) throw new NotFoundException('Marque introuvable');
    try {
      await this.brandRepository.remove(brand);
    } catch (err: any) {
      // Contrainte d'intégrité (produits liés à cette marque)
      if (err && typeof err === 'object' && (err as any).code === '23503') {
        throw new BadRequestException(
          'Impossible de supprimer cette marque car des produits y sont encore associés. Veuillez d\'abord modifier ou supprimer ces produits.'
        );
      }
      throw err;
    }
  }

  private slugify(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'marque';
  }
}
