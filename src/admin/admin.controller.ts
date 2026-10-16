import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query, UseGuards, UseInterceptors, UploadedFile, Req, BadRequestException, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { AdminInsightsService } from './admin-insights.service';
import { ProductsService } from '../products/products.service';
import { OrdersService } from '../orders/orders.service';
import { CategoriesService } from '../categories/categories.service';
import { BrandsService } from '../products/brands.service';
import { UsersService } from '../users/users.service';
import { ContactService } from '../contact/contact.service';
import { SlidesService } from '../slides/slides.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Request } from 'express';
import { storeImage, UploadedImageFile } from '../common/image-storage';

const ORDER_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

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
    private insightsService: AdminInsightsService,
  ) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('dashboard')
  getDashboard(@Query('days') days?: string, @Query('top') top?: string) {
    return this.insightsService.getDashboard(days, top);
  }

  @Get('summary')
  getSummary() {
    return this.insightsService.getSummary();
  }

  @Get('search')
  search(@Query('q') q?: string) {
    return this.insightsService.search(q);
  }

  @Get('customers')
  getCustomers(@Query('search') search?: string) {
    return this.insightsService.getCustomers(search);
  }

  @Get('customers/:id')
  getCustomer(@Param('id') id: string) {
    return this.insightsService.getCustomer(id);
  }

  @Get('coupons')
  getCoupons() {
    return this.insightsService.getCoupons();
  }

  @Post('coupons')
  createCoupon(@Body() body: any) {
    return this.insightsService.createCoupon(body ?? {});
  }

  @Patch('coupons/:id')
  updateCoupon(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.insightsService.updateCoupon(id, body ?? {});
  }

  @Delete('coupons/:id')
  deleteCoupon(@Param('id', ParseIntPipe) id: number) {
    return this.insightsService.deleteCoupon(id);
  }

  @Get('reviews')
  getReviews(@Query('status') status?: string) {
    return this.insightsService.getReviews(status);
  }

  @Patch('reviews/:id')
  updateReview(@Param('id', ParseIntPipe) id: number, @Body() body: { isApproved?: unknown }) {
    return this.insightsService.setReviewApproval(id, body?.isApproved);
  }

  @Delete('reviews/:id')
  deleteReview(@Param('id', ParseIntPipe) id: number) {
    return this.insightsService.deleteReview(id);
  }

  @Get('newsletter')
  getNewsletter() {
    return this.insightsService.getNewsletter();
  }

  @Delete('newsletter/:id')
  deleteSubscriber(@Param('id', ParseIntPipe) id: number) {
    return this.insightsService.deleteSubscriber(id);
  }

  @Get('delivery-zones')
  getDeliveryZones() {
    return this.insightsService.getDeliveryZones();
  }

  @Post('delivery-zones')
  createDeliveryZone(@Body() body: any) {
    return this.insightsService.createDeliveryZone(body ?? {});
  }

  @Patch('delivery-zones/:id')
  updateDeliveryZone(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.insightsService.updateDeliveryZone(id, body ?? {});
  }

  @Delete('delivery-zones/:id')
  deleteDeliveryZone(@Param('id', ParseIntPipe) id: number) {
    return this.insightsService.deleteDeliveryZone(id);
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
    if (!ORDER_STATUSES.includes(body?.status as OrderStatus)) {
      throw new BadRequestException('Statut de commande invalide');
    }
    return this.ordersService.updateStatus(id, body.status as OrderStatus);
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
  async uploadImage(@UploadedFile() file: UploadedImageFile, @Req() req: Request, @Query('folder') folder?: string): Promise<{ url: string }> {
    const target = folder === 'pages' ? 'pages' : 'products';
    const url = await storeImage(file, target, `${req.protocol}://${req.get('host')}`, '4 Mo');
    return { url };
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
  updateUserStatus(@Req() req: Request, @Param('id') id: string, @Body() body: { isActive?: boolean; role?: 'customer' | 'admin' }) {
    const data: any = {};
    if (typeof body?.isActive === 'boolean') data.isActive = body.isActive;
    if (body?.role === 'customer' || body?.role === 'admin') data.role = body.role;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification fournie');
    }
    if (this.isSelf(req, id) && (data.isActive === false || data.role === 'customer')) {
      throw new BadRequestException('Vous ne pouvez pas désactiver ou rétrograder votre propre compte');
    }
    return this.usersService.update(id, data);
  }

  @Delete('users/:id')
  deleteUser(@Req() req: Request, @Param('id') id: string) {
    if (this.isSelf(req, id)) {
      throw new BadRequestException('Vous ne pouvez pas supprimer votre propre compte');
    }
    return this.usersService.remove(id);
  }

  private isSelf(req: Request, id: string): boolean {
    const user = (req as Request & { user?: { sub?: string; id?: string } }).user;
    return !!user && (user.sub === id || user.id === id);
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
