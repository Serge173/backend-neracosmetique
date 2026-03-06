import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, Req, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { ProductsService } from '../products/products.service';
import { OrdersService } from '../orders/orders.service';
import { CategoriesService } from '../categories/categories.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import { Request } from 'express';

interface UploadedFileDto {
  buffer: Buffer;
  originalname?: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private productsService: ProductsService,
    private ordersService: OrdersService,
    private categoriesService: CategoriesService,
    private usersService: UsersService,
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
  getProducts(@Query() query: any) {
    return this.productsService.findAll({ ...query, limit: 100, forAdmin: true });
  }

  @Post('upload/image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadImage(@UploadedFile() file: UploadedFileDto, @Req() req: Request): { url: string } {
    if (!file?.buffer) {
      throw new BadRequestException('Aucun fichier envoyé');
    }
    const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = (file.originalname && file.originalname.includes('.')) ? '.' + file.originalname.split('.').pop()!.toLowerCase() : '.jpg';
    if (!allowedExt.includes(ext)) {
      throw new BadRequestException('Format image accepté : JPG, PNG, GIF, WebP');
    }
    const dir = join(process.cwd(), 'uploads', 'products');
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${uuidv4()}${ext}`;
    const filepath = join(dir, filename);
    fs.writeFileSync(filepath, file.buffer);
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
}
