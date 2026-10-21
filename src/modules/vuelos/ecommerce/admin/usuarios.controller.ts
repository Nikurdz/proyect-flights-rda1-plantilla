import { Body, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentAuth, JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import type { AuthClaims } from '../../auth/token.service';
import { ApiProblemResponses } from '../../common/api-problem-responses';
import { ProblemController } from '../../common/problem-controller';
import { AdminCambiarRolesDto, AdminCrearUsuarioDto, AdminUsuarioParamDto, AdminUsuarioViewDto, AdminUsuariosPaginaDto, AdminUsuariosQueryDto } from './admin-usuarios.dto';
import { UsuariosService } from './usuarios.service';

const { BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT } = HttpStatus;

/** Account management of the ADMIN: create users and promote or demote administrators. */
@ProblemController('admin/usuarios', 'E-commerce · Back-office')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuarios (ADMIN)', description: 'Más recientes primero, con búsqueda por correo o nombre y filtro por rol. Nunca incluye contraseñas ni tokens.' })
  @ApiResponse({ status: 200, type: AdminUsuariosPaginaDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN)
  listar(@Query() query: AdminUsuariosQueryDto) {
    return this.usuarios.listar(query);
  }

  @Get(':clienteId')
  @ApiOperation({ summary: 'Detalle de un usuario (ADMIN)' })
  @ApiResponse({ status: 200, type: AdminUsuarioViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  obtener(@Param() params: AdminUsuarioParamDto) {
    return this.usuarios.obtener(params.clienteId);
  }

  @Post()
  @ApiOperation({
    summary: 'Crear un usuario (ADMIN)',
    description: 'Crea la cuenta con el correo ya verificado. Con roles ["CUSTOMER","ADMIN"] se crea un administrador. Queda registrado en la auditoría.',
  })
  @ApiResponse({ status: 201, type: AdminUsuarioViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, CONFLICT)
  crear(@CurrentAuth() auth: AuthClaims, @Body() body: AdminCrearUsuarioDto) {
    return this.usuarios.crear(auth.ownerId, body);
  }

  @Put(':clienteId/roles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cambiar los roles de un usuario (ADMIN)',
    description:
      'Ascender a administrador (roles ["CUSTOMER","ADMIN"]) o quitarle el rol (["CUSTOMER"]). No se puede quitar el rol a uno mismo ni al último administrador (409 LAST_ADMIN). ' +
      'El rol viaja en el token: el cambio se aplica al siguiente inicio de sesión del usuario.',
  })
  @ApiResponse({ status: 200, type: AdminUsuarioViewDto })
  @ApiProblemResponses(BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  cambiarRoles(@CurrentAuth() auth: AuthClaims, @Param() params: AdminUsuarioParamDto, @Body() body: AdminCambiarRolesDto) {
    return this.usuarios.cambiarRoles(auth.ownerId, params.clienteId, body);
  }
}
