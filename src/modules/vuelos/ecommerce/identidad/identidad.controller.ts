import { Body, Get, HttpCode, HttpStatus, Ip, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentAuth, JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { AuthClaims } from '../../auth/token.service';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import { HTTP_LOCKED } from '../../common/problem-details.exception';
import { ClienteParamDto, ClienteViewDto, LoginDto, PreferenciasDto, RegistroClienteDto, TokenViewDto, VerificarCorreoDto } from './dto/identidad.dto';
import { IdentidadService } from './identidad.service';

const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY, TOO_MANY_REQUESTS } = HttpStatus;
const LOCKED = HTTP_LOCKED;

@ProblemController('auth', 'E-commerce · Identidad')
export class AuthController {
  constructor(private readonly identidad: IdentidadService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión', description: 'RF-IAM-003. Bloqueo temporal tras 5 intentos fallidos consecutivos.' })
  @ApiResponse({ status: 200, type: TokenViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, LOCKED, TOO_MANY_REQUESTS)
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.identidad.login(dto, ip);
  }

  @Post('invitado')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Sesión de invitado', description: 'RF-CHK-001: comprar sin cuenta. El viaje se recupera luego con número de orden y apellido.' })
  @ApiResponse({ status: 201, type: TokenViewDto })
  invitado() {
    return this.identidad.invitado();
  }

  @Post('verificar-correo')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirmar el correo con el token recibido', description: 'RF-IAM-001.' })
  @ApiProblemResponses(BAD_REQUEST)
  verificarCorreo(@Body() dto: VerificarCorreoDto) {
    return this.identidad.verificarCorreo(dto.token);
  }
}

@ProblemController('clientes', 'E-commerce · Identidad')
export class ClientesController {
  constructor(private readonly identidad: IdentidadService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar una cuenta', description: 'RF-IAM-001/002: cuenta gratuita vinculada a un número LATAM Pass; se envía un correo de verificación.' })
  @ApiResponse({ status: 201, type: ClienteViewDto })
  @ApiProblemResponses(BAD_REQUEST, CONFLICT, NOT_FOUND, UNPROCESSABLE_ENTITY)
  registrar(@Body() dto: RegistroClienteDto) {
    return this.identidad.registrar(dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil del cliente', description: 'Use "me" como id para la cuenta de la sesión.' })
  @ApiResponse({ status: 200, type: ClienteViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  obtener(@CurrentAuth() auth: AuthClaims, @Param() params: ClienteParamDto) {
    return this.identidad.obtener(auth, params.id);
  }

  @Put(':id/preferencias')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Preferencias de notificación, idioma, mercado y consentimiento', description: 'RF-IAM-009, RN-35.' })
  @ApiResponse({ status: 200, type: ClienteViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, UNPROCESSABLE_ENTITY)
  actualizarPreferencias(@CurrentAuth() auth: AuthClaims, @Param() params: ClienteParamDto, @Body() dto: PreferenciasDto) {
    return this.identidad.actualizarPreferencias(auth, params.id, dto);
  }
}
