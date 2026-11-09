import { Get, Header, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import { ConciliacionQueryDto } from './booking-conciliacion.dto';
import { BookingConciliacionService } from './booking-conciliacion.service';

const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN } = HttpStatus;

/**
 * Reconciliation of what Booking sold with the invoices Booking issues (ADMIN, read only). We issue no invoice for these
 * sales: each one is shown as an invoice line, with the credit note derived from its cancellation. Not a fiscal document.
 */
@ProblemController('admin/facturacion-booking', 'E-commerce · Back-office')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class BookingConciliacionController {
  constructor(private readonly conciliacion: BookingConciliacionService) {}

  @Get('resumen')
  @ApiOperation({
    summary: 'Resumen de las ventas de Booking por día (ADMIN)',
    description:
      'Por día de Ecuador y del periodo: ventas, base, IVA, total, cancelaciones, reembolsos, penalidades, equipaje, cambios de fecha, neto y cuántas ventas tienen el IVA descuadrado. Filtros: desde/hasta (días de Ecuador) y socio.',
  })
  @ApiResponse({ status: 200, description: 'Totales del periodo y de cada día.' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  resumen(@Query() query: ConciliacionQueryDto) {
    return this.conciliacion.resumen(query);
  }

  // Declared before the list so the path is not taken for a filter.
  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="facturacion-booking.csv"')
  @ApiOperation({ summary: 'Exportar la conciliación de Booking en CSV (ADMIN)', description: 'Mismos filtros que la lista; hasta 5000 ventas, las más antiguas primero.' })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'CSV separado por comas, UTF-8 con BOM.' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  exportCsv(@Query() query: ConciliacionQueryDto) {
    return this.conciliacion.exportCsv(query);
  }

  @Get()
  @ApiOperation({
    summary: 'Ventas de Booking como líneas de factura (ADMIN)',
    description:
      'Cada venta con su base, IVA, IVA esperado (15 % de la base) e IVA según Booking (15 % incluido en el total), la alerta si no cuadra, la nota de crédito derivada de una cancelación (reembolso y penalidad), el equipaje y los cambios de fecha. Vista de conciliación: no es un documento fiscal.',
  })
  @ApiResponse({ status: 200, description: 'Página de ventas con sus importes.' })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  listar(@Query() query: ConciliacionQueryDto) {
    return this.conciliacion.listar(query);
  }
}
