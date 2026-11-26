import { Controller, Post, Param, ParseIntPipe, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SesionesAcademicasService } from './sesiones-academicas.service';
import { JwtAuthGuard } from '../../Seguridad/auth/jwt-auth.guard';
import { RolesGuard } from '../../Seguridad/auth/roles.guard';
import { Roles } from '../../Seguridad/auth/roles.decorator';

@ApiTags('Sesiones Académicas (Ponente)')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Ponente')
@ApiBearerAuth()
@Controller('ponente/sesiones-academicas')
export class SesionesAcademicasPonenteController {
  constructor(private readonly service: SesionesAcademicasService) {}

  @Post('actividad/:actividadId/abierta')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Abrir la asistencia del día si la actividad está vigente' })
  abrirSesionDelDia(@Param('actividadId', ParseIntPipe) actividadId: number) {
    return this.service.abrirSesionDelDia(actividadId);
  }

  @Post(':id/generar-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generar PIN de asistencia (Ponente)' })
  generarPin(@Param('id', ParseIntPipe) id: number) {
    return this.service.generarPin(id);
  }
}
