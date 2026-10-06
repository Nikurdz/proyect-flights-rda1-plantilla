import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { buildVuelosSwaggerConfig, orderVuelosPaths, vuelosSwaggerUiOptions } from './modules/vuelos/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Behind a reverse proxy (Render) req.ip is the proxy's address unless it is trusted, and the
  // per-client rate limits (login, order lookup) would then be shared by every user. No-op unless set.
  if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY);
    app.getHttpAdapter().getInstance().set('trust proxy', Number.isInteger(hops) ? hops : process.env.TRUST_PROXY);
  }

  // Browser front ends on another origin need CORS. Production allows only the origins listed in
  // CORS_ORIGINS (comma-separated, no trailing slash); unset there means no cross-origin access.
  // Outside production, any localhost port is allowed so a dev server works without configuration.
  // Auth is a Bearer header, never a cookie, so credentials stay off.
  const corsOrigins = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  const allowLocalhost = process.env.NODE_ENV !== 'production';
  if (corsOrigins.length > 0 || allowLocalhost) {
    app.enableCors({
      origin: (origin, callback) => {
        const allowed = !origin || corsOrigins.includes(origin) || (allowLocalhost && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
        callback(null, allowed);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'Accept-Language', 'Idempotency-Key', 'X-Device-Fingerprint', 'X-Correlation-Id'],
      exposedHeaders: ['X-Correlation-Id', 'Retry-After'],
      maxAge: 600,
    });
  }

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Only the Vuelos module is mounted in this deployment, so the documentation is Vuelos': sections in the
  // order of a purchase, with what is unused or not implemented set apart (see modules/vuelos/swagger.ts).
  const document = SwaggerModule.createDocument(app, buildVuelosSwaggerConfig());
  orderVuelosPaths(document);
  SwaggerModule.setup('api/docs', app, document, vuelosSwaggerUiOptions);

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
