import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Brand } from './entities/brand.entity';

@Controller('brands')
export class BrandsController {
  constructor(
    @InjectRepository(Brand)
    private brandRepository: Repository<Brand>,
  ) {}

  @Get()
  async findAll() {
    return this.brandRepository.find({ order: { name: 'ASC' } });
  }
}
