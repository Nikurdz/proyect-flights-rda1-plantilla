import { createHash, randomBytes, randomInt } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthClaims, SignedToken } from '../../auth/token.service';
import { TokenService } from '../../auth/token.service';
import { todayUtc } from '../../common/date.util';
import { uniqueViolationColumns } from '../../common/db-errors';
import { DomainEventBus } from '../../common/domain-event-bus';
import { HTTP_LOCKED, ProblemDetailsException } from '../../common/problem-details.exception';
import { SlidingWindowLimiter, assertWithinLimit } from '../common/rate-limiter';
import { MercadosService } from '../mercados/mercados.service';
import { ClienteViewDto, LoginDto, PreferenciasDto, RegistroClienteDto } from './dto/identidad.dto';
import { Cliente } from './entities/cliente.entity';
import { hashPassword, verifyPassword } from './password.util';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const VERIFICATION_HOURS = 24;

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

const invalidCredentials = () =>
  new ProblemDetailsException(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid credentials', 'The email or password is incorrect.');

/** D01. Accounts, sessions (including guests) and preferences. */
@Injectable()
export class IdentidadService {
  private readonly loginLimiter = new SlidingWindowLimiter(20, 15 * 60_000);
  private readonly guestLimiter = new SlidingWindowLimiter(120, 60 * 60_000);
  private readonly verifyLimiter = new SlidingWindowLimiter(10, 15 * 60_000);
  private dummyHash?: Promise<string>;

  constructor(
    @InjectRepository(Cliente) private readonly clientes: Repository<Cliente>,
    private readonly mercados: MercadosService,
    private readonly tokens: TokenService,
    private readonly events: DomainEventBus,
  ) {}

  async registrar(dto: RegistroClienteDto): Promise<ClienteViewDto> {
    const mercado = await this.mercados.requerirActivo(dto.mercado ?? 'ec');
    if (dto.fechaNacimiento >= todayUtc()) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid birth date', 'fechaNacimiento must be in the past.', [
        { name: 'fechaNacimiento', reason: 'must be in the past' },
      ]);
    }

    const hashContrasena = await hashPassword(dto.contrasena);
    const verificationToken = randomBytes(32).toString('base64url');

    let cliente: Cliente | undefined;
    for (let attempt = 0; attempt < 3 && !cliente; attempt++) {
      try {
        cliente = await this.clientes.save(
          this.clientes.create({
            correo: dto.correo,
            hashContrasena,
            nombres: dto.nombres.trim(),
            apellidos: dto.apellidos.trim(),
            fechaNacimiento: dto.fechaNacimiento,
            telefono: dto.telefono ?? null,
            roles: ['CUSTOMER'],
            numeroSocio: this.nuevoNumeroSocio(),
            mercadoPreferido: mercado.codigo,
            idiomaPreferido: mercado.idiomaPorDefecto,
            consentimientoMarketing: dto.consentimientoMarketing ?? false,
            terminosVersionAceptada: mercado.textosLegales.terminos.version,
            terminosAceptadosEn: new Date(),
            tokenVerificacionHash: sha256(verificationToken),
            tokenVerificacionVenceEn: new Date(Date.now() + VERIFICATION_HOURS * 3_600_000),
          }),
        );
      } catch (error) {
        const columns = uniqueViolationColumns(error);
        if (columns?.includes('correo')) {
          // CU-01 E1: offer sign-in or recovery without revealing anything about the account.
          throw new ProblemDetailsException(HttpStatus.CONFLICT, 'EMAIL_ALREADY_REGISTERED', 'Email already registered', 'If you already have an account, sign in or recover your access.');
        }
        if (!columns?.includes('numeroSocio')) throw error; // a member-number collision just retries
      }
    }
    if (!cliente) {
      throw new ProblemDetailsException(HttpStatus.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE', 'Could not create the account', 'Please try again.');
    }

    await this.events.publish(
      'ClienteRegistrado',
      cliente.clienteId,
      { clienteId: cliente.clienteId, correo: cliente.correo, nombres: cliente.nombres, idioma: cliente.idiomaPreferido, verificationToken },
      { market: mercado.codigo },
    );
    return this.vista(cliente);
  }

  async verificarCorreo(token: string, ip: string): Promise<void> {
    assertWithinLimit(this.verifyLimiter, `verify:${ip}`, 'Too many verification attempts');
    const cliente = await this.clientes.findOne({ where: { tokenVerificacionHash: sha256(token) } });
    if (!cliente || !cliente.tokenVerificacionVenceEn || cliente.tokenVerificacionVenceEn.getTime() < Date.now()) {
      throw new ProblemDetailsException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Invalid or expired token', 'The verification link is invalid or has expired.', [
        { name: 'token', reason: 'invalid or expired' },
      ]);
    }
    await this.clientes.update(cliente.clienteId, { correoVerificado: true, tokenVerificacionHash: null, tokenVerificacionVenceEn: null });
  }

  async login(dto: LoginDto, ip: string): Promise<SignedToken> {
    const limit = this.loginLimiter.consume(`login:${ip}`);
    if (!limit.allowed) {
      throw new ProblemDetailsException(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED', 'Too many sign-in attempts', `Try again in ${limit.retryAfterSeconds} seconds.`, undefined, limit.retryAfterSeconds);
    }

    const cliente = await this.clientes.findOne({ where: { correo: dto.correo } });
    if (!cliente) {
      // Same work and same answer as a wrong password, so timing and wording do not reveal which emails exist.
      await verifyPassword(dto.contrasena, await this.dummy());
      throw invalidCredentials();
    }

    if (cliente.bloqueadoHasta && cliente.bloqueadoHasta.getTime() > Date.now()) {
      throw new ProblemDetailsException(HTTP_LOCKED, 'ACCOUNT_LOCKED', 'Account temporarily locked', 'Too many failed attempts. Try again later or recover your access.');
    }

    if (!(await verifyPassword(dto.contrasena, cliente.hashContrasena))) {
      await this.registrarFallo(cliente);
      throw invalidCredentials();
    }

    if (cliente.intentosFallidos > 0 || cliente.bloqueadoHasta) {
      await this.clientes.update(cliente.clienteId, { intentosFallidos: 0, bloqueadoHasta: null });
    }
    return this.tokens.sign({ ownerId: cliente.clienteId, kind: 'customer', roles: cliente.roles });
  }

  /** RF-CHK-001: buying without an account uses a short-lived guest identity. */
  invitado(ip: string): SignedToken {
    assertWithinLimit(this.guestLimiter, `guest:${ip}`, 'Too many guest sessions');
    return this.tokens.sign({ ownerId: `guest:${randomBytes(16).toString('hex')}`, kind: 'guest', roles: [] });
  }

  async obtener(auth: AuthClaims, id: string): Promise<ClienteViewDto> {
    return this.vista(await this.cargarPropio(auth, id));
  }

  async actualizarPreferencias(auth: AuthClaims, id: string, dto: PreferenciasDto): Promise<ClienteViewDto> {
    const cliente = await this.cargarPropio(auth, id);

    if (dto.mercado) {
      const mercado = await this.mercados.requerirActivo(dto.mercado);
      cliente.mercadoPreferido = mercado.codigo;
      if (!dto.idioma) cliente.idiomaPreferido = mercado.idiomaPorDefecto;
    }
    if (dto.idioma) {
      const mercado = await this.mercados.obtener(cliente.mercadoPreferido);
      if (!mercado.idiomas.includes(dto.idioma)) {
        throw new ProblemDetailsException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_FAILED', 'Language not available', `The market "${mercado.codigo}" does not offer "${dto.idioma}".`, [
          { name: 'idioma', reason: 'not available in the market' },
        ]);
      }
      cliente.idiomaPreferido = dto.idioma;
    }
    if (dto.canalNotificacion) cliente.canalNotificacion = dto.canalNotificacion;

    const consentChanged = dto.consentimientoMarketing !== undefined && dto.consentimientoMarketing !== cliente.consentimientoMarketing;
    if (dto.consentimientoMarketing !== undefined) cliente.consentimientoMarketing = dto.consentimientoMarketing;

    const saved = await this.clientes.save(cliente);
    if (consentChanged) {
      await this.events.publish('ConsentimientoActualizado', saved.clienteId, { clienteId: saved.clienteId, marketing: saved.consentimientoMarketing }, { market: saved.mercadoPreferido });
    }
    return this.vista(saved);
  }

  vista(cliente: Cliente): ClienteViewDto {
    return {
      clienteId: cliente.clienteId,
      correo: cliente.correo,
      correoVerificado: cliente.correoVerificado,
      nombres: cliente.nombres,
      apellidos: cliente.apellidos,
      numeroSocio: cliente.numeroSocio,
      mercado: cliente.mercadoPreferido,
      idioma: cliente.idiomaPreferido,
      canalNotificacion: cliente.canalNotificacion,
      consentimientoMarketing: cliente.consentimientoMarketing,
      _links: {
        self: `/api/v1/clientes/${cliente.clienteId}`,
        preferencias: `/api/v1/clientes/${cliente.clienteId}/preferencias`,
        ordenes: `/api/v1/clientes/${cliente.clienteId}/ordenes`,
      },
    };
  }

  private async cargarPropio(auth: AuthClaims, id: string): Promise<Cliente> {
    if (auth.kind !== 'customer') {
      throw new ProblemDetailsException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Account required', 'Guests have no account profile; sign in first.');
    }
    const clienteId = id === 'me' ? auth.ownerId : id;
    if (clienteId !== auth.ownerId) {
      throw new ProblemDetailsException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Not your account', 'You can only access your own account.');
    }
    const cliente = await this.clientes.findOne({ where: { clienteId } });
    if (!cliente) {
      throw new ProblemDetailsException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Account not found', 'The account no longer exists.');
    }
    return cliente;
  }

  private async registrarFallo(cliente: Cliente): Promise<void> {
    // Atomic increment: concurrent wrong guesses cannot all read the same count and slip under the limit.
    const result = await this.clientes
      .createQueryBuilder()
      .update(Cliente)
      .set({ intentosFallidos: () => '"intentosFallidos" + 1' })
      .where('"clienteId" = :id', { id: cliente.clienteId })
      .returning('"intentosFallidos"')
      .execute();
    const attempts = Number((result.raw as { intentosFallidos: number }[])[0]?.intentosFallidos ?? 0);

    if (attempts >= MAX_FAILED_LOGINS) {
      await this.clientes.update(cliente.clienteId, { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + LOCK_MINUTES * 60_000) });
      await this.events.publish('CuentaBloqueada', cliente.clienteId, { clienteId: cliente.clienteId, correo: cliente.correo, nombres: cliente.nombres, idioma: cliente.idiomaPreferido, minutos: LOCK_MINUTES }, { market: cliente.mercadoPreferido });
    }
  }

  private dummy(): Promise<string> {
    this.dummyHash ??= hashPassword('not-a-real-password');
    return this.dummyHash;
  }

  private nuevoNumeroSocio(): string {
    let digits = '';
    for (let i = 0; i < 9; i++) digits += randomInt(10).toString();
    return `LP${digits}`;
  }
}
