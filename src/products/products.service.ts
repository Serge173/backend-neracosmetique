import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { Category } from '../categories/entities/category.entity';

const LEN = {
  name: 255,
  slug: 255,
  shortDescription: 500,
  skinType: 120,
  imageUrl: 500,
  imageAlt: 255,
  text: 65535,
} as const;

function truncate(s: string | null | undefined, max: number): string {
  if (s == null || typeof s !== 'string') return '';
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max);
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private productImageRepository: Repository<ProductImage>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async findAll(filters: any): Promise<{ products: Product[]; total: number; page: number; limit: number; totalPages: number }> {
    const query = this.productRepository.createQueryBuilder('product')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.brand', 'brand');
    if (filters.forAdmin) {
      query.where('1=1');
    } else {
      query.where('product.isActive = :isActive', { isActive: true });
    }

    if (filters.category) {
      query.andWhere('product.categoryId = :categoryId', { categoryId: filters.category });
    }
    if (filters.brand) {
      query.andWhere('product.brandId = :brandId', { brandId: filters.brand });
    }
    if (filters.q && String(filters.q).trim()) {
      const searchTerm = '%' + String(filters.q).trim().replace(/%/g, '\\%') + '%';
      query.andWhere('(product.name LIKE :searchTerm OR product.slug LIKE :searchTerm)', { searchTerm });
    }
    if (filters.minPrice) {
      query.andWhere('product.price >= :minPrice', { minPrice: filters.minPrice });
    }
    if (filters.maxPrice) {
      query.andWhere('product.price <= :maxPrice', { maxPrice: filters.maxPrice });
    }

    const sort = (filters.sort as string) || 'newest';
    if (sort === 'newest') {
      query.orderBy('product.createdAt', 'DESC');
    } else if (sort === 'price_asc') {
      query.orderBy('product.price', 'ASC');
    } else if (sort === 'price_desc') {
      query.orderBy('product.price', 'DESC');
    } else {
      query.orderBy('product.createdAt', 'DESC');
    }

    const page = filters.page || 1;
    const limit = filters.limit || 12;
    const skip = (page - 1) * limit;

    const [products, total] = await query.skip(skip).take(limit).getManyAndCount();
    products.forEach((p) => this.sanitizeProductImages(p));

    return {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['images', 'category', 'brand'],
    });
    if (!product) throw new NotFoundException('Produit introuvable');
    this.sanitizeProductImages(product);
    return product;
  }

  async findBySlug(slug: string): Promise<Product> {
    const slugTrim = typeof slug === 'string' ? slug.trim() : '';
    if (!slugTrim) throw new BadRequestException('Slug invalide');
    const product = await this.productRepository.findOne({
      where: { slug: slugTrim },
      relations: ['images', 'category', 'brand'],
    });
    if (!product) throw new NotFoundException('Produit introuvable');
    this.sanitizeProductImages(product);
    return product;
  }

  async findFeatured(): Promise<Product[]> {
    const products = await this.productRepository.find({
      where: { isFeatured: true, isActive: true },
      relations: ['images'],
      take: 8,
    });
    products.forEach((p) => this.sanitizeProductImages(p));
    return products;
  }

  async findNew(): Promise<Product[]> {
    const products = await this.productRepository.find({
      where: { isNew: true, isActive: true },
      relations: ['images'],
      take: 8,
      order: { createdAt: 'DESC' },
    });
    products.forEach((p) => this.sanitizeProductImages(p));
    return products;
  }

  /** Remplace les URLs Bing / trop longues par un placeholder pour éviter Tracking Prevention et erreurs DB. */
  private sanitizeProductImages(product: Product): void {
    if (!product.images?.length) return;
    const safePlaceholder = 'https://via.placeholder.com/400?text=Produit';
    for (const img of product.images) {
      if (!img.url || img.url.length > 500 || /bing\.com|blogspot\.com/i.test(img.url)) {
        img.url = safePlaceholder;
      }
    }
  }

  private slugify(name: string): string {
    const s = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return s.length > LEN.slug ? s.slice(0, LEN.slug) : s;
  }

  private async ensureCategoryExists(categoryId: number): Promise<void> {
    const cat = await this.categoryRepository.findOne({ where: { id: categoryId } });
    if (!cat) {
      throw new BadRequestException('Catégorie invalide ou introuvable.');
    }
  }

  async create(dto: {
    name: string;
    slug?: string;
    shortDescription?: string;
    description?: string;
    ingredients?: string;
    usageInstructions?: string;
    price: number;
    promoPrice?: number;
    stockQuantity?: number;
    skinType?: string;
    categoryId: number;
    brandId?: number;
    isFeatured?: boolean;
    isNew?: boolean;
    imageUrl?: string;
  }): Promise<Product> {
    const name = truncate(dto.name, LEN.name);
    if (!name) {
      throw new BadRequestException('Le nom du produit est obligatoire.');
    }
    const categoryId = Number(dto.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new BadRequestException('Veuillez choisir une catégorie valide.');
    }
    await this.ensureCategoryExists(categoryId);

    const price = Number(dto.price);
    if (Number.isNaN(price) || price < 0) {
      throw new BadRequestException('Le prix doit être un nombre positif ou nul.');
    }
    const promoPrice = dto.promoPrice != null ? Number(dto.promoPrice) : undefined;
    if (promoPrice !== undefined && (Number.isNaN(promoPrice) || promoPrice < 0)) {
      throw new BadRequestException('Le prix promo doit être un nombre positif ou nul.');
    }
    const stockQuantity = Math.max(0, Math.floor(Number(dto.stockQuantity) || 0));

    let slug = truncate(dto.slug, LEN.slug) || this.slugify(name);
    const existing = await this.productRepository.findOne({ where: { slug } });
    const finalSlug = existing ? `${slug}-${Date.now()}`.slice(0, LEN.slug) : slug;

    const product = this.productRepository.create({
      name,
      slug: finalSlug,
      shortDescription: truncate(dto.shortDescription, LEN.shortDescription) || null,
      description: truncate(dto.description, LEN.text) || null,
      ingredients: truncate(dto.ingredients, LEN.text) || null,
      usageInstructions: truncate(dto.usageInstructions, LEN.text) || null,
      price,
      promoPrice: promoPrice ?? null,
      stockQuantity,
      skinType: truncate(dto.skinType, LEN.skinType) || null,
      categoryId,
      brandId: dto.brandId != null ? Number(dto.brandId) : null,
      isFeatured: !!dto.isFeatured,
      isNew: !!dto.isNew,
      isActive: true,
    });

    const saved = await this.productRepository.save(product);

    const imageUrl = truncate(dto.imageUrl, LEN.imageUrl);
    if (imageUrl) {
      await this.productImageRepository.save(
        this.productImageRepository.create({
          productId: saved.id,
          url: imageUrl,
          alt: truncate(name, LEN.imageAlt),
          sortOrder: 0,
          isPrimary: true,
        }),
      );
    }

    return this.findOne(saved.id);
  }

  async update(id: number, dto: Partial<{
    name: string;
    shortDescription: string;
    description: string;
    ingredients: string;
    usageInstructions: string;
    price: number;
    promoPrice: number;
    stockQuantity: number;
    skinType: string;
    categoryId: number;
    brandId: number;
    isFeatured: boolean;
    isNew: boolean;
    isActive: boolean;
    imageUrl: string;
  }>): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id }, relations: ['images'] });
    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }

    if (dto.name !== undefined) {
      const name = truncate(dto.name, LEN.name);
      if (!name) throw new BadRequestException('Le nom du produit ne peut pas être vide.');
      product.name = name;
    }
    if (dto.shortDescription !== undefined) product.shortDescription = truncate(dto.shortDescription, LEN.shortDescription) || null;
    if (dto.description !== undefined) product.description = truncate(dto.description, LEN.text) || null;
    if (dto.ingredients !== undefined) product.ingredients = truncate(dto.ingredients, LEN.text) || null;
    if (dto.usageInstructions !== undefined) product.usageInstructions = truncate(dto.usageInstructions, LEN.text) || null;
    if (dto.price !== undefined) {
      const price = Number(dto.price);
      if (Number.isNaN(price) || price < 0) throw new BadRequestException('Le prix doit être un nombre positif ou nul.');
      product.price = price;
    }
    if (dto.promoPrice !== undefined) {
      const v = Number(dto.promoPrice);
      product.promoPrice = Number.isNaN(v) || v < 0 ? null : v;
    }
    if (dto.stockQuantity !== undefined) product.stockQuantity = Math.max(0, Math.floor(Number(dto.stockQuantity) || 0));
    if (dto.skinType !== undefined) product.skinType = truncate(dto.skinType, LEN.skinType) || null;
    if (dto.categoryId !== undefined) {
      const categoryId = Number(dto.categoryId);
      if (!Number.isInteger(categoryId) || categoryId <= 0) throw new BadRequestException('Catégorie invalide.');
      await this.ensureCategoryExists(categoryId);
      product.categoryId = categoryId;
    }
    if (dto.brandId !== undefined) product.brandId = dto.brandId != null ? Number(dto.brandId) : null;
    if (dto.isFeatured !== undefined) product.isFeatured = !!dto.isFeatured;
    if (dto.isNew !== undefined) product.isNew = !!dto.isNew;
    if (dto.isActive !== undefined) product.isActive = !!dto.isActive;

    await this.productRepository.save(product);

    const imageUrl = dto.imageUrl != null ? truncate(dto.imageUrl, LEN.imageUrl) : '';
    if (imageUrl) {
      const primary = product.images?.find((i: ProductImage) => i.isPrimary);
      if (primary) {
        primary.url = imageUrl;
        primary.alt = truncate(product.name, LEN.imageAlt);
        await this.productImageRepository.save(primary);
      } else {
        await this.productImageRepository.save(
          this.productImageRepository.create({
            productId: id,
            url: imageUrl,
            alt: truncate(product.name, LEN.imageAlt),
            sortOrder: 0,
            isPrimary: true,
          }),
        );
      }
    }
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }
    product.isActive = false;
    await this.productRepository.save(product);
  }
}
