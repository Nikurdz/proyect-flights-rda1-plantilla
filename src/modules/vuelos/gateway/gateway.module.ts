import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { GraphQLError } from 'graphql';
import { PubSub } from 'graphql-subscriptions';
import { DataSource } from 'typeorm';
import { TokenService } from '../auth/token.service';
import { ProblemDetailsException, isProblemDetailsBody } from '../common/problem-details.exception';
import { ReservaExterna } from '../ecommerce/integracion/entities/reserva-externa.entity';
import { Factura } from '../ecommerce/facturacion/entities/factura.entity';
import { IntegracionModule } from '../ecommerce/integracion/integracion.module';
import { ObservabilidadModule } from '../ecommerce/observabilidad/observabilidad.module';
import { Orden } from '../ecommerce/ordenes/entities/orden.entity';
import { OrdenesModule } from '../ecommerce/ordenes/ordenes.module';
import { EsbModule } from '../esb/esb.module';
import { VuelosCoreModule } from '../vuelos-core.module';
import { limiteDeProfundidad } from './depth-limit';
import { crearLoaders } from './gateway.context';
import { GatewayEventBridge, PUBSUB } from './gateway.pubsub';
import { GatewayResolver, OrdenFieldResolver, ReservaExternaFieldResolver } from './gateway.resolver';
import { GatewayService } from './gateway.service';

const MAX_PROFUNDIDAD = Number(process.env.GRAPHQL_MAX_DEPTH) || 7;

/** The bearer token of a request or of a websocket connection, verified; null when there is none or it is not valid. */
function autenticar(tokens: TokenService, cabecera: unknown) {
  if (typeof cabecera !== 'string' || !cabecera.startsWith('Bearer ')) return null;
  try {
    return tokens.verify(cabecera.slice(7));
  } catch {
    return null;
  }
}

/**
 * The GraphQL gateway (BFF) next to the REST API, at `/graphql`: JWT and roles like the REST routes, a depth limit,
 * introspection only outside production, DataLoaders per request, subscriptions over graphql-ws. It talks to the
 * domains only through the service bus.
 */
@Module({
  imports: [
    VuelosCoreModule,
    EsbModule,
    IntegracionModule,
    OrdenesModule,
    ObservabilidadModule,
    TypeOrmModule.forFeature([Factura, Orden, ReservaExterna]),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [VuelosCoreModule, TypeOrmModule.forFeature([Factura])],
      inject: [TokenService, DataSource],
      useFactory: (tokens: TokenService, dataSource: DataSource) => {
        const produccion = process.env.NODE_ENV === 'production';
        return {
          autoSchemaFile: true,
          sortSchema: true,
          path: '/graphql',
          introspection: !produccion,
          playground: false,
          plugins: produccion ? [ApolloServerPluginLandingPageDisabled()] : [],
          csrfPrevention: true,
          validationRules: [limiteDeProfundidad(MAX_PROFUNDIDAD)],
          subscriptions: {
            'graphql-ws': {
              onConnect: (ctx: { connectionParams?: Record<string, unknown>; extra: unknown }) => {
                const params = ctx.connectionParams ?? {};
                (ctx.extra as Record<string, unknown>).auth = autenticar(tokens, params.Authorization ?? params.authorization);
              },
            },
          },
          context: ({ req, extra }: { req?: { headers: Record<string, unknown> }; extra?: { auth?: unknown } }) => ({
            auth: req ? autenticar(tokens, req.headers.authorization) : (extra?.auth ?? null),
            loaders: crearLoaders(dataSource.getRepository(Factura)),
          }),
          // A domain failure keeps the code the REST API would give it, so a client handles both the same way.
          formatError: (formatted: { message: string; extensions?: Record<string, unknown> }, error: unknown) => {
            const original = (error as { originalError?: unknown })?.originalError;
            if (original instanceof ProblemDetailsException) {
              const cuerpo = original.getResponse();
              if (isProblemDetailsBody(cuerpo)) {
                return { message: cuerpo.detail ?? cuerpo.title, extensions: { code: cuerpo.code, status: cuerpo.status, title: cuerpo.title } };
              }
            }
            if (original instanceof GraphQLError) return formatted;
            // Never leak internals of an unexpected failure.
            if (original && !(original instanceof Error && (original as { status?: number }).status)) return { message: 'Internal error', extensions: { code: 'INTERNAL_ERROR' } };
            return formatted;
          },
        };
      },
    }),
  ],
  providers: [GatewayService, GatewayResolver, OrdenFieldResolver, ReservaExternaFieldResolver, GatewayEventBridge, { provide: PUBSUB, useValue: new PubSub() }],
})
export class GatewayModule {}
