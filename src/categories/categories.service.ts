import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async findAll(): Promise<Category[]> {
    return this.categoryRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  /** Liste des catégories actives avec le nombre de produits actifs par catégorie (pour la boutique). */
  async findAllWithProductCount(): Promise<{ id: number; name: string; slug: string; productCount: number }[]> {
    const categories = await this.categoryRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    const counts = await this.productRepository
      .createQueryBuilder('product')
      .select('product.categoryId', 'categoryId')
      .addSelect('COUNT(*)', 'count')
      .where('product.isActive = :active', { active: true })
      .groupBy('product.categoryId')
      .getRawMany<{ categoryId: number; count: string }>();
    const countByCategoryId: Record<number, number> = {};
    counts.forEach((row) => {
      countByCategoryId[row.categoryId] = parseInt(String(row.count), 10) || 0;
    });
    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      productCount: countByCategoryId[cat.id] ?? 0,
    }));
  }

  /** Liste toutes les catégories (y compris inactives) pour l’admin. */
  async findAllForAdmin(): Promise<Category[]> {
    return this.categoryRepository.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Category> {
    return this.categoryRepository.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Category> {
    return this.categoryRepository.findOne({ where: { slug, isActive: true } });
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async update(id: number, data: { name?: string; parentId?: number; description?: string; sortOrder?: number; isActive?: boolean }): Promise<Category> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Catégorie non trouvée');
    }
    if (data.name !== undefined) {
      category.name = data.name;
      const baseSlug = this.slugify(data.name);
      const existing = await this.categoryRepository.findOne({ where: { slug: baseSlug } });
      category.slug = existing && existing.id !== id ? `${baseSlug}-${Date.now()}` : baseSlug;
    }
    if (data.parentId !== undefined) category.parentId = data.parentId;
    if (data.description !== undefined) category.description = data.description;
    if (data.sortOrder !== undefined) category.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) category.isActive = data.isActive;
    return this.categoryRepository.save(category);
  }

  async create(data: {
    name: string;
    parentId?: number;
    description?: string;
    imageUrl?: string;
    sortOrder?: number;
    isActive?: boolean;
  }): Promise<Category> {
    const baseSlug = this.slugify(data.name);
    const existing = await this.categoryRepository.findOne({ where: { slug: baseSlug } });
    const slug = existing ? `${baseSlug}-${Date.now()}` : baseSlug;

    const category = this.categoryRepository.create({
      name: data.name,
      slug,
      parentId: data.parentId ?? null,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
    });
    return this.categoryRepository.save(category);
  }

  /** Supprime une catégorie. Impossible si des produits y sont rattachés. */
  async remove(id: number): Promise<void> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Catégorie non trouvée');
    }
    const productCount = await this.productRepository.count({ where: { categoryId: id } });
    if (productCount > 0) {
      throw new BadRequestException(
        `Impossible de supprimer : ${productCount} produit(s) utilisent encore cette catégorie. Réassignez-les ou supprimez-les d'abord.`,
      );
    }
    await this.categoryRepository.remove(category);
  }
}
