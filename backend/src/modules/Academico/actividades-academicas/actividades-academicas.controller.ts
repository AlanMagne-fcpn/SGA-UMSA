import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, ParseIntPipe, UseGuards, Query, Request,
  UseInterceptors, UploadedFile, Res
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ActividadesAcademicasService } from './actividades-academicas.service';
import { CreateActividadDto } from './dto/create-actividad.dto';
import { UpdateActividadDto } from './dto/update-actividad.dto';
import { JwtAuthGuard } from '../../Seguridad/auth/jwt-auth.guard';
import { RolesGuard } from '../../Seguridad/auth/roles.guard';
import { Roles } from '../../Seguridad/auth/roles.decorator';
import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';

/** Configuración de multer para guardar imágenes en uploads/cursos/ */
const activityImageStorage = diskStorage({
  destination: './uploads/cursos',
  filename: (_req, file, cb) =>
    cb(null, `${uuidv4()}${extname(file.originalname)}`),
});

/** Configuración de multer para guardar materiales en uploads/materiales/ */
const materialStorage = diskStorage({
  destination: (_req, _file, cb) => {
    const dir = './uploads/materiales';
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (_req, file, cb) =>
    cb(null, `${uuidv4()}${extname(file.originalname)}`),
});
const entregaStorage = diskStorage({
  destination: (_req, _file, cb) => {
    const dir = './private/curso-entregas';
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname).toLowerCase()}`),
});
const archivoPermitido = (_req: any, file: Express.Multer.File, cb: any) => {
  if (!/\.(pdf|docx?|pptx?|xlsx?|txt|csv|zip|png|jpe?g|webp)$/i.test(file.originalname)) return cb(new BadRequestException('Tipo de archivo no permitido. Usa PDF, documentos, imágenes o ZIP.'), false);
  cb(null, true);
};

@ApiTags('Actividades Académicas')
@Controller('actividades-academicas')
export class ActividadesAcademicasController {
  constructor(private readonly service: ActividadesAcademicasService) {}

  /** GET /actividades-academicas — lista todas */
  @Get()
  @ApiOperation({ summary: 'Listar actividades académicas' })
  findAll() {
    return this.service.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Super Usuario')
  @ApiBearerAuth()
  @Get('solicitudes/pendientes')
  @ApiOperation({ summary: 'Listar solicitudes de reactivación pendientes (Super Admin)' })
  getSolicitudesPendientes() {
    return this.service.getSolicitudesPendientes();
  }

  @Get('publicos/:id')
  @ApiOperation({ summary: 'Ficha pública de un curso, disponible sin registro' })
  findPublicOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findPublicOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Ponente', 'Coordinador', 'Super Usuario')
  @Get(':id/lecciones/editor')
  listarLeccionesEditor(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.listarLeccionesEditor(id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Ponente', 'Coordinador', 'Super Usuario')
  @Get(':id/aula/configuracion')
  configuracionAula(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.configuracionAula(id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Ponente', 'Coordinador', 'Super Usuario')
  @Post(':id/lecciones')
  crearLeccion(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Request() req: any) {
    return this.service.guardarLeccion(id, body, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Ponente', 'Coordinador', 'Super Usuario')
  @Put(':id/lecciones/:leccionId')
  actualizarLeccion(@Param('id', ParseIntPipe) id: number, @Param('leccionId', ParseIntPipe) leccionId: number, @Body() body: any, @Request() req: any) {
    return this.service.guardarLeccion(id, body, req.user, leccionId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Ponente', 'Coordinador', 'Super Usuario')
  @Delete(':id/lecciones/:leccionId')
  eliminarLeccion(@Param('id', ParseIntPipe) id: number, @Param('leccionId', ParseIntPipe) leccionId: number, @Request() req: any) {
    return this.service.eliminarLeccion(id, leccionId, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/aula')
  listarAula(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.listarAula(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/aula/resumen')
  resumenAula(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.resumenEstudiante(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/lecciones/:leccionId/entrega')
  @UseInterceptors(FileInterceptor('file', { storage: entregaStorage, limits: { fileSize: 25 * 1024 * 1024 }, fileFilter: archivoPermitido }))
  async entregar(@Param('id', ParseIntPipe) id: number, @Param('leccionId', ParseIntPipe) leccionId: number, @Body() body: any, @Request() req: any, @UploadedFile() file?: Express.Multer.File) {
    try { return await this.service.entregarPractica(id, leccionId, body?.texto, file, req.user); }
    catch (error) { if (file && existsSync(file.path)) unlinkSync(file.path); throw error; }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Ponente', 'Coordinador', 'Super Usuario')
  @Get(':id/entregas')
  entregas(@Param('id', ParseIntPipe) id: number, @Request() req: any) { return this.service.listarEntregas(id, req.user); }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Ponente', 'Coordinador', 'Super Usuario')
  @Put(':id/entregas/:progresoId/nota')
  calificar(@Param('id', ParseIntPipe) id: number, @Param('progresoId', ParseIntPipe) progresoId: number, @Body() body: any, @Request() req: any) {
    return this.service.calificarPractica(id, progresoId, body, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/entregas/:progresoId/archivo')
  async descargarEntrega(@Param('id', ParseIntPipe) id: number, @Param('progresoId', ParseIntPipe) progresoId: number, @Request() req: any, @Res() res: Response) {
    const file = await this.service.archivoEntrega(id, progresoId, req.user);
    return res.download(join(process.cwd(), 'private/curso-entregas', file.almacenado), file.nombre);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/lecciones/:leccionId/completar')
  completarLeccion(@Param('id', ParseIntPipe) id: number, @Param('leccionId', ParseIntPipe) leccionId: number, @Body() body: { respuestas?: number[] }, @Request() req: any) {
    return this.service.completarLeccion(id, leccionId, body?.respuestas, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/valoraciones')
  valorarCurso(@Param('id', ParseIntPipe) id: number, @Body() body: { puntuacion: number; comentario?: string }, @Request() req: any) {
    return this.service.valorarCurso(id, body, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Ponente', 'Coordinador', 'Super Usuario')
  @Post(':id/videos/upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: materialStorage,
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!/^video\/(mp4|webm|ogg|quicktime)$/.test(file.mimetype) || !/\.(mp4|webm|ogg|mov)$/i.test(file.originalname)) return cb(new BadRequestException('Selecciona un video MP4, WebM, OGG o MOV.'), false);
      cb(null, true);
    },
  }))
  async uploadVideo(@Param('id', ParseIntPipe) id: number, @Request() req: any, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Selecciona un video MP4, WebM, OGG o MOV de hasta 500 MB.');
    try {
      await this.service.verificarPermisosEdicion(id, req.user);
      await this.service.verificarPermisoContenido(id, 'video');
      return { path: `/uploads/materiales/${file.filename}`, size: file.size, mimetype: file.mimetype };
    } catch (error) {
      if (existsSync(file.path)) unlinkSync(file.path);
      throw error;
    }
  }

  /** GET /actividades-academicas/:id */
  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una actividad' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  // ── Coordinador ─────────────────────────────────────────────

  /** POST /actividades-academicas */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Coordinador', 'Super Usuario')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Crear actividad académica (Coordinador)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('imagen', { storage: activityImageStorage }))
  crear(
    @Body() dto: CreateActividadDto, 
    @Request() req: any,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.service.crear(dto, req.user, file);
  }

  /** PUT /actividades-academicas/:id */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Coordinador', 'Super Usuario')
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Actualizar actividad académica (Coordinador)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('imagen', { storage: activityImageStorage }))
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActividadDto,
    @Request() req: any,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.service.actualizar(id, dto, req.user, file);
  }

  /** PATCH /actividades-academicas/:id - Para inhabilitar o cambios rápidos */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Coordinador', 'Super Usuario')
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Actualización parcial de actividad académica (Coordinador)' })
  patch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActividadDto,
    @Request() req: any
  ) {
    return this.service.actualizar(id, dto, req.user);
  }

  /** DELETE /actividades-academicas/:id */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Coordinador', 'Super Usuario')
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar actividad académica (Coordinador)' })
  eliminar(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.eliminar(id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Coordinador', 'Super Usuario')
  @ApiBearerAuth()
  @Post(':id/solicitar-activacion')
  @ApiOperation({ summary: 'Solicitar reactivación de una actividad al Super Usuario' })
  solicitarActivacion(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.solicitarActivacion(id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Super Usuario')
  @ApiBearerAuth()
  @Patch(':id/activar')
  @ApiOperation({ summary: 'Aprobar reactivación de una actividad (Super Admin)' })
  aprobarReactivacion(@Param('id', ParseIntPipe) id: number) {
    return this.service.aprobarReactivacion(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Ponente', 'Coordinador', 'Super Usuario')
  @ApiBearerAuth()
  @Patch(':id/materiales')
  @ApiOperation({ summary: 'Actualizar materiales de una actividad (Ponente / Coordinador)' })
  actualizarMateriales(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any
  ) {
    return this.service.actualizarMateriales(id, req.body.materiales, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Ponente', 'Coordinador', 'Super Usuario')
  @ApiBearerAuth()
  @Post(':id/materiales/upload')
  @UseInterceptors(FileInterceptor('file', { storage: materialStorage, limits: { fileSize: 25 * 1024 * 1024 }, fileFilter: archivoPermitido }))
  @ApiOperation({ summary: 'Subir archivo de material didáctico' })
  async uploadMaterial(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @UploadedFile() file?: Express.Multer.File
  ) {
    try {
      await this.service.verificarPermisosEdicion(id, req.user);
      await this.service.verificarPermisoContenido(id, 'material');
      if (!file) throw new BadRequestException('No se ha subido ningún archivo.');
      return {
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: `/uploads/materiales/${file.filename}`
      };
    } catch (error) {
      if (file && existsSync(file.path)) unlinkSync(file.path);
      throw error;
    }
  }
}
