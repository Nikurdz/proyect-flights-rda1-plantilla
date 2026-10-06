import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../../auth/roles.guard';
import { Vuelo } from '../../entities/vuelo.entity';
import { VuelosCoreModule } from '../../vuelos-core.module';
import { OrdenesModule } from '../ordenes/ordenes.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [VuelosCoreModule, OrdenesModule, TypeOrmModule.forFeature([Vuelo])],
  controllers: [AdminController],
  providers: [AdminService, RolesGuard],
})
export class AdminModule {}
