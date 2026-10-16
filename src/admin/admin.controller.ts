import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, Req, BadRequestException, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { ProductsService } from '../products/products.service';
import { OrdersService } from '../orders/orders.service';
import { CategoriesService } from '../categories/categories.service';
import { BrandsService } from '../products/brands.service';
import { UsersService } from '../users/users.service';
import { ContactService } from '../contact/contact.service';
import { SlidesService } from '../slides/slides.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import { Request } from 'express';
import { put } from '@vercel/blob';

interface UploadedFileDto {
  buffer: Buffer;
  originalname?: string;
}

function detectImageType(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: '.jpg', mime: 'image/jpeg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: '.png', mime: 'image/png' };
  }
  const head6 = buf.subarray(0, 6).toString('ascii');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return { ext: '.gif', mime: 'image/gif' };
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { ext: '.webp', mime: 'image/webp' };
  }
  return null;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private adminService: AdminService,
    private productsService: ProductsService,
    private ordersService: OrdersService,
    private categoriesService: CategoriesService,
    private brandsService: BrandsService,
    private usersService: UsersService,
    private contactService: ContactService,
    private slidesService: SlidesService,
  ) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('orders')
  getOrders() {
    return this.ordersService.findAllForAdmin();
  }

  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch('orders/:id/status')
  updateOrderStatus(@Param('id') id: string, @Body() body: { status: string }) {
    const status = body.status as 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    return this.ordersService.updateStatus(id, status);
  }

  @Get('products')
  async getProducts(@Query() query: any) {
    try {
      return await this.productsService.findAll({ ...query, limit: 100, forAdmin: true });
    } catch (err) {
      this.logger.error('GET /admin/products failed', err instanceof Error ? err.stack : String(err));
      throw err;
    }
  }

  @Post('upload/image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 4 * 1024 * 1024, files: 1 } }))
  async uploadImage(@UploadedFile() file: UploadedFileDto, @Req() req: Request): Promise<{ url: string }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Aucun fichier envoyé');
    }
    const detected = detectImageType(file.buffer);
    if (!detected) {
      throw new BadRequestException('Format image accepté : JPG, PNG, GIF, WebP (4 Mo max)');
    }
    const filename = `${uuidv4()}${detected.ext}`;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`products/${filename}`, file.buffer, {
        access: 'public',
        contentType: detected.mime,
        addRandomSuffix: false,
        cacheControlMaxAge: 31536000,
      });
      return { url: blob.url };
    }
    if (process.env.VERCEL) {
      throw new BadRequestException('Stockage des images non configuré (BLOB_READ_WRITE_TOKEN manquant)');
    }

    const dir = join(process.cwd(), 'uploads', 'products');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(join(dir, filename), file.buffer);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return { url: `${baseUrl}/uploads/products/${filename}` };
  }

  @Post('products')
  createProduct(@Body() body: any) {
    return this.productsService.create(body);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() body: any) {
    return this.productsService.update(+id, body);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.productsService.remove(+id);
  }

  @Get('users')
  getUsers() {
    return this.usersService.findAll();
  }

  @Post('users')
  createUser(@Body() body: { email: string; firstName: string; lastName: string; phone?: string; role?: 'customer' | 'admin'; password: string; isActive?: boolean }) {
    return this.usersService.createFromAdmin(body);
  }

  @Patch('users/:id/status')
  updateUserStatus(@Param('id') id: string, @Body() body: { isActive?: boolean; role?: 'customer' | 'admin' }) {
    const data: any = {};
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
    if (body.role === 'customer' || body.role === 'admin') data.role = body.role;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification fournie');
    }
    return this.usersService.update(id, data);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Get('categories')
  getCategories() {
    return this.categoriesService.findAllForAdmin();
  }

  @Post('categories')
  createCategory(@Body() body: { name: string; parentId?: number; description?: string }) {
    return this.categoriesService.create({
      name: body.name,
      parentId: body.parentId ?? undefined,
      description: body.description ?? undefined,
    });
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() body: { name?: string; parentId?: number; description?: string; isActive?: boolean }) {
    return this.categoriesService.update(+id, body);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.categoriesService.remove(+id);
  }

  @Get('brands')
  getBrands() {
    return this.brandsService.findAll();
  }

  @Post('brands')
  createBrand(@Body() body: { name: string; slug?: string; logoUrl?: string }) {
    return this.brandsService.create(body);
  }

  @Patch('brands/:id')
  updateBrand(@Param('id') id: string, @Body() body: { name?: string; slug?: string; logoUrl?: string }) {
    return this.brandsService.update(+id, body);
  }

  @Delete('brands/:id')
  deleteBrand(@Param('id') id: string) {
    return this.brandsService.remove(+id);
  }

  @Get('slides')
  getSlides() {
    return this.slidesService.findAll();
  }

  @Post('slides')
  createSlide(@Body() body: { title: string; description?: string; imageUrl?: string; link?: string; linkLabel?: string; sortOrder?: number; isActive?: boolean }) {
    return this.slidesService.create(body);
  }

  @Patch('slides/:id')
  updateSlide(@Param('id') id: string, @Body() body: Partial<{ title: string; description: string; imageUrl: string; link: string; linkLabel: string; sortOrder: number; isActive: boolean }>) {
    return this.slidesService.update(+id, body);
  }

  @Delete('slides/:id')
  deleteSlide(@Param('id') id: string) {
    return this.slidesService.remove(+id);
  }

  @Get('messages')
  getMessages() {
    return this.contactService.findAllForAdmin();
  }

  @Patch('messages/:id/read')
  markMessageRead(@Param('id') id: string) {
    return this.contactService.markAsRead(+id);
  }

  @Patch('messages/:id/reply')
  replyToMessage(@Param('id') id: string, @Body() body: { response: string }) {
    if (!body.response || !body.response.trim()) {
      throw new BadRequestException('La réponse ne peut pas être vide');
    }
    return this.contactService.reply(+id, body.response.trim());
  }
}
