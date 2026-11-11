import { Args, Context, Int, Mutation, Parent, Query, ResolveField, Resolver, Subscription } from '@nestjs/graphql';
import { HttpStatus, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { ProblemDetailsException } from '../common/problem-details.exception';
import { EsbRouter } from '../esb/esb-router';
import { RUTAS } from './gateway.service';
import { PUBSUB, TOPIC_ESTADO } from './gateway.pubsub';
import type { GatewayContext } from './gateway.context';
import {
  AuditoriaSagaGql,
  AuditoriaTransaccionGql,
  CatalogoUnificadoGql,
  CheckInGql,
  EstadoReservaCambiadoGql,
  FacturaGql,
  MisReservasGql,
  OrdenGql,
  ReservaExternaGql,
  ReservarExperienciaInputGql,
  SaludNodoGql,
} from './gateway.types';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const claveValida = (clave: string): string => {
  if (!UUID_V4.test(clave)) throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid idempotency key', 'idempotencyKey must be a UUID v4.');
  return clave;
};

/**
 * The BFF: the one door for the web client. Every operation goes through the service bus (EsbRouter), which runs the
 * handler of the domain it belongs to; the resolvers only translate GraphQL arguments and results.
 */
@Resolver()
export class GatewayResolver {
  constructor(
    private readonly esb: EsbRouter,
    @Inject(PUBSUB) private readonly pubsub: PubSub,
  ) {}

  @Query(() => CatalogoUnificadoGql, { description: 'Vuelos de un día y experiencias de los proveedores en una sola consulta. Público.' })
  catalogoUnificado(
    @Args('origen', { nullable: true }) origen?: string,
    @Args('destino', { nullable: true }) destino?: string,
    @Args('fecha', { nullable: true, description: 'YYYY-MM-DD; sin fecha solo se listan experiencias.' }) fecha?: string,
    @Args('q', { nullable: true }) q?: string,
    @Args('limite', { type: () => Int, nullable: true }) limite?: number,
  ) {
    return this.esb.invocar<CatalogoUnificadoGql>(RUTAS.catalogo, { origen, destino, fecha, q, limite });
  }

  @Query(() => MisReservasGql, { description: 'Mis órdenes de vuelo y mis reservas de experiencias.' })
  misReservas(@Context() ctx: GatewayContext) {
    return this.esb.invocar<MisReservasGql>(RUTAS.misReservas, undefined, ctx.auth);
  }

  @Query(() => FacturaGql, { description: 'Una factura con su detalle. Solo su dueño o un administrador.' })
  facturaCompleta(@Args('numeroFactura') numeroFactura: string, @Context() ctx: GatewayContext) {
    return this.esb.invocar<FacturaGql>(RUTAS.factura, { numeroFactura }, ctx.auth);
  }

  @Query(() => [SaludNodoGql], { description: 'Semáforo de cada proveedor (ADMIN).' })
  saludNodos(@Context() ctx: GatewayContext) {
    return this.esb.invocar<SaludNodoGql[]>(RUTAS.salud, undefined, ctx.auth);
  }

  @Query(() => [AuditoriaTransaccionGql], { description: 'Eventos registrados, por correlación o tipo (ADMIN).' })
  auditoriaTransacciones(
    @Context() ctx: GatewayContext,
    @Args('correlationId', { nullable: true }) correlationId?: string,
    @Args('tipo', { nullable: true }) tipo?: string,
    @Args('limite', { type: () => Int, nullable: true }) limite?: number,
  ) {
    return this.esb.invocar<AuditoriaTransaccionGql[]>(RUTAS.transacciones, { correlationId, tipo, limite }, ctx.auth);
  }

  @Query(() => [AuditoriaSagaGql], { description: 'Sagas con sus pasos, por correlación, tipo o estado (ADMIN).' })
  auditoriaSagas(
    @Context() ctx: GatewayContext,
    @Args('correlationId', { nullable: true }) correlationId?: string,
    @Args('tipo', { nullable: true }) tipo?: string,
    @Args('estado', { nullable: true }) estado?: string,
    @Args('limite', { type: () => Int, nullable: true }) limite?: number,
  ) {
    return this.esb.invocar<AuditoriaSagaGql[]>(RUTAS.sagas, { correlationId, tipo, estado, limite }, ctx.auth);
  }

  @Mutation(() => ReservaExternaGql, { description: 'Reserva y paga una experiencia (saga con compensación). idempotencyKey: UUID v4.' })
  checkoutExterno(
    @Args('experienciaId', { type: () => String }) experienciaId: string,
    @Args('input') input: ReservarExperienciaInputGql,
    @Args('idempotencyKey') idempotencyKey: string,
    @Context() ctx: GatewayContext,
  ) {
    return this.esb.invocar(RUTAS.reservar, { experienciaId, input, idempotencyKey: claveValida(idempotencyKey) }, ctx.auth);
  }

  @Mutation(() => ReservaExternaGql, { description: 'Cancela una reserva de experiencia (primero en el proveedor, luego el reembolso).' })
  cancelarReservaSaga(
    @Args('reservaId', { type: () => String }) reservaId: string,
    @Args('idempotencyKey') idempotencyKey: string,
    @Context() ctx: GatewayContext,
    @Args('motivo', { nullable: true }) motivo?: string,
  ) {
    return this.esb.invocar(RUTAS.cancelar, { reservaId, motivo, idempotencyKey: claveValida(idempotencyKey) }, ctx.auth);
  }

  @Mutation(() => CheckInGql, { description: 'Check-in digital de una reserva de vuelo.' })
  checkInDigital(@Args('bookingId', { type: () => String }) bookingId: string, @Context() ctx: GatewayContext) {
    return this.esb.invocar<CheckInGql>(RUTAS.checkIn, { bookingId }, ctx.auth);
  }

  @Subscription(() => EstadoReservaCambiadoGql, {
    description: 'Eventos de mis compras y reservas en cuanto ocurren.',
    filter: (payload: { ownerId: string }, _vars: unknown, ctx: GatewayContext) => !!ctx.auth && payload.ownerId === ctx.auth.ownerId,
    resolve: (payload: { estadoReservaCambiado: EstadoReservaCambiadoGql }) => payload.estadoReservaCambiado,
  })
  estadoReservaCambiado(@Context() ctx: GatewayContext) {
    if (!ctx.auth) throw new ProblemDetailsException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Authentication required', 'Send a Bearer access token.');
    return this.pubsub.asyncIterator(TOPIC_ESTADO);
  }
}

/** Resolved in batch: a list of orders or reservations asks the database once for all their invoices. */
@Resolver(() => OrdenGql)
export class OrdenFieldResolver {
  @ResolveField(() => FacturaGql, { nullable: true })
  factura(@Parent() orden: OrdenGql, @Context() ctx: GatewayContext) {
    return ctx.loaders.facturaDeOrden.load(orden.ordenId);
  }
}

@Resolver(() => ReservaExternaGql)
export class ReservaExternaFieldResolver {
  @ResolveField(() => FacturaGql, { nullable: true })
  factura(@Parent() reserva: ReservaExternaGql, @Context() ctx: GatewayContext) {
    return ctx.loaders.facturaDeReserva.load(reserva.id);
  }
}
