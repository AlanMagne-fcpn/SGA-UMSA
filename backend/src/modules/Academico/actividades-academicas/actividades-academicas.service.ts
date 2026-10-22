import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { existsSync, unlinkSync } from 'fs';
import { ActividadAcademica } from './entities/actividad-academica.entity';
import { CreateActividadDto } from './dto/create-actividad.dto';
import { UpdateActividadDto } from './dto/update-actividad.dto';
import { MailService } from '../../Comun/mail/mail.service';
import { formatMediaUrl } from '../../../common/media-url.util';
import { resumenAula } from './aula-resumen';
import { esCurso, permisosContenido, TipoContenido } from './aula-permisos';

@Injectable()
export class ActividadesAcademicasService {
  constructor(
    @InjectRepository(ActividadAcademica)
    private readonly actividadRepository: Repository<ActividadAcademica>,
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {}

  async verificarPropiedad(eventoId: number, usuario: any) {
    if (!usuario) return;
    if (usuario.roles?.includes('Super Usuario')) return;
    const roles = Array.isArray(usuario.roles) ? usuario.roles.map((r: string) => String(r).toLowerCase()) : [];
    if (roles.some((r: string) => r.includes('coordinador'))) {
      const alcance = await this.dataSource.query(
        `SELECT alcance_eventos FROM usuarios WHERE id = $1`,
        [usuario.id],
      );
      if (alcance[0]?.alcance_eventos === 'libre') return;
    }

    const coord = await this.dataSource.query(
      `SELECT 1 FROM coordinacion_eventos WHERE id_evento = $1 AND id_usuario = $2`,
      [eventoId, usuario.id]
    );

    if (coord.length === 0) {
      throw new ForbiddenException('No tienes permisos sobre el evento de esta actividad académica.');
    }
  }

  private formatImageUrl(filenameOrUrl: string, folder: string = 'cursos'): string | null {
    return formatMediaUrl(filenameOrUrl, folder);
  }

  // ── CRUD básico ────────────────────────────────────────────

  async findAll() {
    const acts = await this.actividadRepository.find({ relations: ['evento', 'inscripciones', 'modalidades'] });
    return acts.map(act => {
      const firstMod = act.modalidades?.[0];
      return {
        ...act,
        min_nota: firstMod ? firstMod.min_nota : 51,
        min_asistencia: firstMod ? firstMod.min_asistencia : 80,
        modalidad: firstMod ? firstMod.tipo : 'Presencial',
        imagen: this.formatImageUrl(act.imagen)
      };
    });
  }

  async findOne(id: number) {
    const act = await this.actividadRepository.findOne({
      where: { id },
      relations: ['evento', 'modalidades', 'modalidades.sesiones', 'imparticiones', 'imparticiones.usuario', 'imparticiones.usuario.persona', 'inscripciones'],
    });
    if (!act) throw new NotFoundException(`Actividad ${id} no encontrada.`);
    const firstMod = act.modalidades?.[0];
    return {
      ...act,
      min_nota: firstMod ? firstMod.min_nota : 51,
      min_asistencia: firstMod ? firstMod.min_asistencia : 80,
      modalidad: firstMod ? firstMod.tipo : 'Presencial',
      imagen: this.formatImageUrl(act.imagen)
    };
  }

  /** Ficha pública: expone datos del curso sin inscripciones ni datos privados. */
  async findPublicOne(id: number) {
    const act = await this.actividadRepository.findOne({
      where: { id },
      relations: ['evento', 'modalidades', 'imparticiones', 'imparticiones.usuario', 'imparticiones.usuario.persona'],
    });
    if (!act || Number(act.estado) === -1 || Number(act.evento?.estado) === -1) {
      throw new NotFoundException(`Curso ${id} no disponible.`);
    }
    const [{ total }] = await this.dataSource.query(
      'SELECT COUNT(*)::integer AS total FROM inscripciones WHERE id_actividad_academica = $1 AND estado = 1',
      [id],
    );
    const normalizar = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const publicados = new Set((act.evento?.descripcion || '').match(/(?:^|\n)\[PONENTES_METADATA\]:([^\n]*)/)?.[1]?.split(',').map(normalizar).filter(Boolean) || []);
    const contenido = await this.dataSource.query(
      "SELECT id, tipo, titulo, descripcion, orden FROM curso_lecciones WHERE id_actividad_academica = $1 AND publicado = true AND ($2::boolean OR tipo IN ('video','material')) ORDER BY orden, id",
      [id, esCurso(act.tipo)],
    );
    const [valoracion] = await this.dataSource.query(
      'SELECT COUNT(*)::integer AS cantidad, ROUND(AVG(puntuacion)::numeric,1) AS promedio FROM curso_valoraciones WHERE id_actividad_academica=$1',
      [id],
    );
    return {
      id: act.id,
      nombre: act.nombre,
      descripcion: act.descripcion,
      tipo: act.tipo,
      imagen: this.formatImageUrl(act.imagen),
      fecha_inicio: act.fecha_inicio,
      fecha_fin: act.fecha_fin,
      horas: act.horas,
      cupo: act.cupo,
      inscritos: Number(total || 0),
      contenido,
      valoracion: { cantidad: Number(valoracion?.cantidad || 0), promedio: valoracion?.promedio == null ? null : Number(valoracion.promedio) },
      requisitos: Array.isArray(act.requisitos?.custom) ? act.requisitos.custom.map((item: any) => String(item.label || '').trim()).filter(Boolean) : [],
      objetivos: String(act.requisitos?.presentacion?.objetivos || '').split('\n').map((item) => item.trim()).filter(Boolean),
      publico_objetivo: String(act.requisitos?.presentacion?.publico_objetivo || '').trim(),
      estado: act.estado,
      modalidades: (act.modalidades || []).map((modalidad) => ({
        id: modalidad.id,
        tipo: modalidad.tipo,
        min_nota: modalidad.min_nota,
        min_asistencia: modalidad.min_asistencia,
      })),
      docentes: (act.imparticiones || []).filter((item) => {
        const persona = item.usuario?.persona;
        if (!persona || !publicados.size) return false;
        const nombre = normalizar([persona.nombres, persona.primer_apellido].filter(Boolean).join(' '));
        return [...publicados].some((publicado) => publicado === nombre || publicado.endsWith(` ${nombre}`));
      }).map((item) => ({
        id: item.usuario.id,
        nombre: [item.usuario.persona?.nombres, item.usuario.persona?.primer_apellido, item.usuario.persona?.segundo_apellido].filter(Boolean).join(' '),
      })),
      evento: act.evento ? {
        id: act.evento.id,
        nombre: act.evento.nombre,
        gestion: act.evento.gestion,
        estado: act.evento.estado,
        imagen_fondo: this.formatImageUrl(act.evento.imagen_fondo, 'fondos'),
      } : null,
    };
  }

  private async verificarInscripcion(actividadId: number, usuarioId: number) {
    const rows = await this.dataSource.query(
      'SELECT id FROM inscripciones WHERE id_actividad_academica = $1 AND id_usuario = $2 AND estado IN (1,3) LIMIT 1',
      [actividadId, usuarioId],
    );
    if (!rows.length) throw new ForbiddenException('Debes estar inscrito en este curso para acceder a las lecciones.');
    return rows[0].id as number;
  }

  private validarLeccion(input: any) {
    const titulo = String(input?.titulo || '').trim();
    const tipo = String(input?.tipo || 'video');
    const videoUrl = input?.video_url ? String(input.video_url).trim() : null;
    const preguntas = input?.preguntas ?? [];
    if (!titulo || titulo.length > 255 || !['video', 'examen', 'material', 'practica'].includes(tipo)) throw new BadRequestException('Título o tipo de lección inválido.');
    const recursos = input?.recursos ?? [];
    if (!Array.isArray(recursos) || recursos.length > 20 || recursos.some((r: any) => !r || typeof r.nombre !== 'string' || !r.nombre.trim() || r.nombre.length > 255 || typeof r.url !== 'string' || !/^\/uploads\/materiales\/[a-zA-Z0-9-]+\.[a-zA-Z0-9]+$/.test(r.url))) throw new BadRequestException('Los recursos deben ser archivos subidos al aula.');
    const peso = Number(input?.peso ?? 1);
    if (!Number.isFinite(peso) || peso < 0 || peso > 100) throw new BadRequestException('El peso debe estar entre 0 y 100.');
    if (['material','practica'].includes(tipo) && preguntas.length) throw new BadRequestException('Utiliza un examen o un video para añadir un cuestionario.');
    if (tipo === 'video' && (!videoUrl || !(/^\/uploads\/materiales\/[a-zA-Z0-9-]+\.[a-zA-Z0-9]+$/.test(videoUrl) || /^https:\/\//i.test(videoUrl)))) throw new BadRequestException('La lección necesita un video subido o un enlace HTTPS.');
    if (tipo === 'examen' && (!Array.isArray(preguntas) || !preguntas.length)) throw new BadRequestException('El examen necesita preguntas.');
    if (!Array.isArray(preguntas) || preguntas.length > 100 || preguntas.some((p: any) =>
      !p || !String(p.enunciado || '').trim() || !Array.isArray(p.opciones) || p.opciones.length < 2 || p.opciones.length > 8 ||
      p.opciones.some((o: any) => !String(o || '').trim()) || !Number.isInteger(p.correcta) || p.correcta < 0 || p.correcta >= p.opciones.length,
    )) throw new BadRequestException('Las preguntas deben incluir enunciado, opciones y una respuesta válida.');
    const orden = Number(input?.orden || 0);
    if (!Number.isInteger(orden) || orden < 0) throw new BadRequestException('El orden de la lección debe ser un número entero positivo.');
    return { titulo, tipo, videoUrl, preguntas, recursos: recursos.map(r => ({ nombre: r.nombre.trim(), url: r.url })), peso, descripcion: String(input?.descripcion || ''), orden, publicado: input?.publicado === true };
  }

  async guardarLeccion(actividadId: number, input: any, usuario: any, leccionId?: number) {
    await this.verificarPermisosEdicion(actividadId, usuario);
    const data = this.validarLeccion(input);
    await this.verificarPermisoContenido(actividadId, data.tipo as TipoContenido);
    if (data.preguntas.length) await this.verificarPermisoContenido(actividadId, 'examen');
    if (data.recursos.length) await this.verificarPermisoContenido(actividadId, 'material');
    if (leccionId) {
      const result = await this.dataSource.query(
        `UPDATE curso_lecciones SET tipo=$3, titulo=$4, descripcion=$5, orden=$6, video_url=$7, preguntas=$8::jsonb, publicado=$9, recursos=$10::jsonb, peso=$11, fecha_actualizacion=now()
         WHERE id=$1 AND id_actividad_academica=$2 RETURNING *`,
        [leccionId, actividadId, data.tipo, data.titulo, data.descripcion, data.orden, data.videoUrl, JSON.stringify(data.preguntas), data.publicado, JSON.stringify(data.recursos), data.peso],
      );
      if (!result.length) throw new NotFoundException('Lección no encontrada.');
      return result[0];
    }
    const result = await this.dataSource.query(
      `INSERT INTO curso_lecciones (id_actividad_academica, tipo, titulo, descripcion, orden, video_url, preguntas, publicado, recursos, peso)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10) RETURNING *`,
      [actividadId, data.tipo, data.titulo, data.descripcion, data.orden, data.videoUrl, JSON.stringify(data.preguntas), data.publicado, JSON.stringify(data.recursos), data.peso],
    );
    return result[0];
  }

  async listarLeccionesEditor(actividadId: number, usuario: any) {
    await this.verificarPermisosEdicion(actividadId, usuario);
    const config = await this.obtenerConfiguracionAula(actividadId);
    const rows = await this.dataSource.query('SELECT * FROM curso_lecciones WHERE id_actividad_academica=$1 ORDER BY orden,id', [actividadId]);
    return esCurso(config.tipo_actividad) ? rows : rows.filter((l: any) => ['video', 'material'].includes(l.tipo)).map((l: any) => ({ ...l, preguntas: [], peso: 0 }));
  }

  private async obtenerConfiguracionAula(actividadId: number) {
    const act = await this.actividadRepository.findOne({ where: { id: actividadId } });
    if (!act) throw new NotFoundException('Actividad no encontrada.');
    return { tipo_actividad: act.tipo, permisos: permisosContenido(act.tipo, act.requisitos) };
  }

  async configuracionAula(actividadId: number, usuario: any) {
    await this.verificarPermisosEdicion(actividadId, usuario);
    return this.obtenerConfiguracionAula(actividadId);
  }

  async verificarPermisoContenido(actividadId: number, tipo: TipoContenido) {
    const config = await this.obtenerConfiguracionAula(actividadId);
    if (['practica', 'examen'].includes(tipo) && !esCurso(config.tipo_actividad)) throw new BadRequestException('Las prácticas, cuestionarios y exámenes solo están disponibles en actividades de tipo Curso.');
    if (!config.permisos[tipo]) throw new ForbiddenException('La organización no ha habilitado este contenido para el ponente.');
  }

  async eliminarLeccion(actividadId: number, leccionId: number, usuario: any) {
    await this.verificarPermisosEdicion(actividadId, usuario);
    const result = await this.dataSource.query('DELETE FROM curso_lecciones WHERE id=$1 AND id_actividad_academica=$2 RETURNING id', [leccionId, actividadId]);
    if (!result.length) throw new NotFoundException('Lección no encontrada.');
    return { eliminado: true };
  }

  async listarAula(actividadId: number, usuario: any) {
    await this.verificarInscripcion(actividadId, usuario.id);
    const rows = await this.dataSource.query(
      `SELECT l.id, l.tipo, l.titulo, l.descripcion, l.orden, l.video_url, CASE WHEN LOWER(TRIM(a.tipo))='curso' THEN l.preguntas ELSE '[]'::jsonb END AS preguntas, l.recursos, l.peso, p.completado_en, p.nota, p.entrega, p.retroalimentacion
       FROM curso_lecciones l JOIN actividades_academicas a ON a.id=l.id_actividad_academica LEFT JOIN curso_progreso p ON p.id_leccion=l.id AND p.id_usuario=$2
       WHERE l.id_actividad_academica=$1 AND l.publicado=true AND (LOWER(TRIM(a.tipo))='curso' OR l.tipo IN ('video','material')) ORDER BY l.orden,l.id`,
      [actividadId, usuario.id],
    );
    return rows.map(({ preguntas, ...row }: any) => ({ ...row, completado_en: row.tipo === 'practica' && row.nota == null ? null : row.completado_en, preguntas: (preguntas || []).map((p: any) => ({ enunciado: p.enunciado, opciones: p.opciones })) }));
  }

  async completarLeccion(actividadId: number, leccionId: number, respuestas: unknown, usuario: any) {
    const inscripcionId = await this.verificarInscripcion(actividadId, usuario.id);
    const rows = await this.dataSource.query(
      `SELECT l.id, l.tipo, CASE WHEN LOWER(TRIM(a.tipo))='curso' THEN l.preguntas ELSE '[]'::jsonb END AS preguntas FROM curso_lecciones l JOIN actividades_academicas a ON a.id=l.id_actividad_academica WHERE l.id=$1 AND l.id_actividad_academica=$2 AND l.publicado=true AND (LOWER(TRIM(a.tipo))='curso' OR l.tipo IN ('video','material'))`,
      [leccionId, actividadId],
    );
    if (!rows.length) throw new NotFoundException('Lección no disponible.');
    if (rows[0].tipo === 'practica') throw new BadRequestException('Esta práctica requiere una entrega y la calificación del docente.');
    const preguntas = rows[0].preguntas || [];
    if (preguntas.length && (!Array.isArray(respuestas) || respuestas.length !== preguntas.length || respuestas.some((r, i) => !Number.isInteger(r) || r < 0 || r >= preguntas[i].opciones.length))) {
      throw new BadRequestException('Responde todas las preguntas antes de completar la lección.');
    }
    const nota = preguntas.length ? Math.round(100 * preguntas.filter((p: any, i: number) => p.correcta === (respuestas as number[])[i]).length / preguntas.length) : null;
    await this.dataSource.query(
      `INSERT INTO curso_progreso (id_leccion,id_usuario,nota) VALUES ($1,$2,$3)
       ON CONFLICT (id_leccion,id_usuario) DO UPDATE SET nota=GREATEST(curso_progreso.nota,EXCLUDED.nota), completado_en=now()`,
      [leccionId, usuario.id, nota],
    );
    const resumen = await this.sincronizarNota(actividadId, usuario.id, inscripcionId);
    const { terminado } = resumen;
    return {
      ...resumen, nota,
      mensaje: terminado ? 'El curso está completo. La organización emitirá el certificado correspondiente.' : 'Progreso guardado.',
    };
  }

  private async sincronizarNota(actividadId: number, usuarioId: number, inscripcionId: number) {
    const resumen = await resumenAula(this.dataSource, actividadId, usuarioId);
    if (resumen.promedio !== null) await this.dataSource.query('UPDATE inscripciones SET nota_principal=$1 WHERE id=$2', [resumen.promedio, inscripcionId]);
    return resumen;
  }

  async resumenEstudiante(actividadId: number, usuario: any) {
    const inscripcionId = await this.verificarInscripcion(actividadId, usuario.id);
    return this.sincronizarNota(actividadId, usuario.id, inscripcionId);
  }

  async entregarPractica(actividadId: number, leccionId: number, texto: string, file: Express.Multer.File | undefined, usuario: any) {
    await this.verificarInscripcion(actividadId, usuario.id);
    const [leccion] = await this.dataSource.query("SELECT id FROM curso_lecciones WHERE id=$1 AND id_actividad_academica=$2 AND tipo='practica' AND publicado=true AND EXISTS(SELECT 1 FROM actividades_academicas a WHERE a.id=$2 AND LOWER(TRIM(a.tipo))='curso')", [leccionId, actividadId]);
    if (!leccion) throw new NotFoundException('Práctica no disponible.');
    const comentario = String(texto || '').trim();
    if ((!comentario && !file) || comentario.length > 10000) throw new BadRequestException('Adjunta un archivo o escribe una respuesta de hasta 10000 caracteres.');
    const entrega = { texto: comentario, archivo: file ? { nombre: file.originalname, almacenado: file.filename } : null };
    const result = await this.dataSource.query(`INSERT INTO curso_progreso (id_leccion,id_usuario,entrega) VALUES ($1,$2,$3::jsonb)
      ON CONFLICT (id_leccion,id_usuario) DO UPDATE SET entrega=EXCLUDED.entrega, completado_en=now()
      WHERE curso_progreso.nota IS NULL RETURNING id`, [leccionId, usuario.id, JSON.stringify(entrega)]);
    if (!result.length) throw new BadRequestException('La práctica ya fue calificada. Contacta al docente para solicitar una revisión.');
    return { mensaje: 'Entrega recibida. Pendiente de calificación.' };
  }

  async listarEntregas(actividadId: number, usuario: any) {
    await this.verificarPermisosEdicion(actividadId, usuario);
    return this.dataSource.query(`SELECT p.id, p.id_leccion, p.id_usuario, p.entrega, p.nota, p.retroalimentacion, l.titulo,
      p.completado_en, u.email, CONCAT_WS(' ',per.nombres,per.primer_apellido,per.segundo_apellido) AS estudiante
      FROM curso_progreso p JOIN curso_lecciones l ON l.id=p.id_leccion
      JOIN usuarios u ON u.id=p.id_usuario LEFT JOIN personas per ON per.id_usuario=u.id
      WHERE l.id_actividad_academica=$1 AND l.tipo='practica' AND p.entrega IS NOT NULL AND EXISTS(SELECT 1 FROM actividades_academicas a WHERE a.id=l.id_actividad_academica AND LOWER(TRIM(a.tipo))='curso') ORDER BY p.nota IS NOT NULL,p.completado_en`, [actividadId]);
  }

  async calificarPractica(actividadId: number, progresoId: number, input: any, usuario: any) {
    await this.verificarPermisosEdicion(actividadId, usuario);
    const nota = input?.nota;
    const feedback = String(input?.retroalimentacion || '').trim();
    if (typeof nota !== 'number' || !Number.isFinite(nota) || nota < 0 || nota > 100 || feedback.length > 5000) throw new BadRequestException('Indica una nota entre 0 y 100 y una devolución de hasta 5000 caracteres.');
    const [entrega] = await this.dataSource.query(`UPDATE curso_progreso p SET nota=$3, retroalimentacion=$4, calificado_por=$5, calificado_en=now()
      FROM curso_lecciones l WHERE p.id=$1 AND p.id_leccion=l.id AND l.id_actividad_academica=$2 AND l.tipo='practica' AND p.entrega IS NOT NULL AND EXISTS(SELECT 1 FROM actividades_academicas a WHERE a.id=l.id_actividad_academica AND LOWER(TRIM(a.tipo))='curso')
      RETURNING p.id_usuario`, [progresoId, actividadId, nota, feedback, usuario.id]);
    if (!entrega) throw new NotFoundException('Entrega no encontrada.');
    const inscripcionId = await this.verificarInscripcion(actividadId, entrega.id_usuario);
    return this.sincronizarNota(actividadId, entrega.id_usuario, inscripcionId);
  }

  async archivoEntrega(actividadId: number, progresoId: number, usuario: any) {
    const [entrega] = await this.dataSource.query(`SELECT p.id_usuario,p.entrega FROM curso_progreso p JOIN curso_lecciones l ON l.id=p.id_leccion
      WHERE p.id=$1 AND l.id_actividad_academica=$2`, [progresoId, actividadId]);
    if (!entrega?.entrega?.archivo) throw new NotFoundException('Archivo no encontrado.');
    if (entrega.id_usuario !== usuario.id) await this.verificarPermisosEdicion(actividadId, usuario);
    const file = entrega.entrega.archivo;
    if (!/^[a-zA-Z0-9-]+\.[a-zA-Z0-9]+$/.test(file.almacenado)) throw new NotFoundException('Archivo no encontrado.');
    return file;
  }

  async valorarCurso(actividadId: number, input: any, usuario: any) {
    const puntuacion = Number(input?.puntuacion);
    const comentario = String(input?.comentario || '').trim();
    if (!Number.isInteger(puntuacion) || puntuacion < 1 || puntuacion > 5 || comentario.length > 1000) throw new BadRequestException('La puntuación debe estar entre 1 y 5 y el comentario no puede superar 1000 caracteres.');
    const [inscripcion] = await this.dataSource.query(
      'SELECT estado FROM inscripciones WHERE id_actividad_academica=$1 AND id_usuario=$2 AND estado IN (1,3) LIMIT 1',
      [actividadId, usuario.id],
    );
    if (!inscripcion) throw new ForbiddenException('Debes estar inscrito para valorar el curso.');
    const [resumen] = await this.dataSource.query(
      `SELECT COUNT(*)::integer AS total, COUNT(p.id)::integer AS completadas FROM curso_lecciones l
       LEFT JOIN curso_progreso p ON p.id_leccion=l.id AND p.id_usuario=$2
       WHERE l.id_actividad_academica=$1 AND l.publicado=true`,
      [actividadId, usuario.id],
    );
    const virtualCompletado = resumen.total > 0 && resumen.total === resumen.completadas;
    if (!virtualCompletado && Number(inscripcion.estado) !== 3) throw new ForbiddenException('Podrás valorar el curso cuando lo completes.');
    const [result] = await this.dataSource.query(
      `INSERT INTO curso_valoraciones (id_actividad_academica,id_usuario,puntuacion,comentario) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id_actividad_academica,id_usuario) DO UPDATE SET puntuacion=EXCLUDED.puntuacion,comentario=EXCLUDED.comentario RETURNING id,puntuacion,comentario`,
      [actividadId, usuario.id, puntuacion, comentario || null],
    );
    return result;
  }

  // ── Coordinador ─────────────────────────────────────────────

  /** Lista todas las actividades de un evento (para el panel del coordinador) */
  async findByEvento(eventoId: number, usuario?: any) {
    const query = this.actividadRepository.createQueryBuilder('a')
      .leftJoinAndSelect('a.modalidades', 'm')
      .innerJoin('a.evento', 'e')
      .where('e.id = :eventoId', { eventoId })
      .orderBy('a.fecha_inicio', 'ASC');

    if (usuario && !usuario.roles?.includes('Super Usuario')) {
      query.innerJoin('e.coordinaciones', 'c')
           .andWhere('c.usuario.id = :usuarioId', { usuarioId: usuario.id });
    }

    const results = await query.getMany();
    return results.map(act => {
      const firstMod = act.modalidades?.[0];
      return {
        ...act,
        estado: Number(act.estado),
        min_nota: firstMod ? firstMod.min_nota : 51,
        min_asistencia: firstMod ? firstMod.min_asistencia : 80,
        modalidad: firstMod ? firstMod.tipo : 'Presencial',
        imagen: this.formatImageUrl(act.imagen)
      };
    });
  }

  /** Crea una actividad asignándola al evento indicado en el DTO */
  async crear(dto: CreateActividadDto, usuario?: any, file?: Express.Multer.File) {
    const evento = await this.dataSource.query(
      `SELECT estado, fase FROM eventos WHERE id = $1`,
      [dto.id_evento]
    );
    if (evento.length === 0) {
      throw new NotFoundException(`El evento con ID ${dto.id_evento} no existe.`);
    }
    const ev = evento[0];
    if (ev.estado === 0 || ev.estado === -1 || ev.fase === 4 || ev.fase === 5) {
      throw new BadRequestException('No se pueden agregar actividades académicas a un evento finalizado, inhabilitado o archivado.');
    }

    if (usuario) {
      await this.verificarPropiedad(dto.id_evento, usuario);
    }
    const { id_evento, modalidad, min_nota, min_asistencia, sesiones, ...campos } = dto;
    const data: any = {
      ...campos,
      evento: { id: id_evento },
    };
    if (file) data.imagen = file.filename;

    const actividad = this.actividadRepository.create(data as any) as unknown as ActividadAcademica;
    const saved = await this.actividadRepository.save(actividad);

    // Guardar modalidad por defecto
    const resMod = await this.dataSource.query(
      `INSERT INTO curso_modalidades (id_actividad_academica, tipo, min_nota, min_asistencia) VALUES ($1, $2, $3, $4) RETURNING id`,
      [saved.id, modalidad || 'Presencial', min_nota || 0, min_asistencia || 0]
    );
    const modId = resMod[0].id;

    // Guardar sesiones
    if (sesiones && Array.isArray(sesiones)) {
      for (const s of sesiones) {
        await this.dataSource.query(
          `INSERT INTO sesiones_academicas (id_curso_modalidad, dia, hora_inicio, hora_fin) VALUES ($1, $2, $3, $4)`,
          [modId, s.dia, s.hora_inicio, s.hora_fin]
        );
      }
    }

    return this.findOne(saved.id);
  }

  async actualizar(id: number, dto: UpdateActividadDto, usuario?: any, file?: Express.Multer.File) {
    // 1. Obtener la entidad raw (sin URLs formateadas)
    const actRaw = await this.actividadRepository.findOne({
      where: { id },
      relations: ['evento', 'modalidades']
    });
    if (!actRaw) throw new NotFoundException(`Actividad ${id} no encontrada.`);

    if (usuario) {
      await this.verificarPropiedad(actRaw.evento.id, usuario);
      if (dto.id_evento && dto.id_evento !== actRaw.evento.id) {
        await this.verificarPropiedad(dto.id_evento, usuario);
      }
    }

    const { id_evento, modalidad, min_nota, min_asistencia, sesiones, imagen, ...campos } = dto;
    
    // 2. Manejo de imagen y limpieza de la anterior
    if (file) {
      if (actRaw.imagen && !actRaw.imagen.startsWith('http')) {
        const oldPath = `./uploads/cursos/${actRaw.imagen}`;
        if (existsSync(oldPath)) unlinkSync(oldPath);
      }
      actRaw.imagen = file.filename;
    }

    // 3. Actualizar campos básicos
    const camposAny = campos as any;
    if (camposAny.fecha_inicio === '') camposAny.fecha_inicio = null;
    if (camposAny.fecha_fin === '') camposAny.fecha_fin = null;
    
    if (camposAny.estado !== undefined) {
        await this.actividadRepository.update(id, { estado: Number(camposAny.estado) });
        actRaw.estado = Number(camposAny.estado);
    }
    
    Object.assign(actRaw, camposAny);
    // FORZAR tipo correcto después de Object.assign (que pudo poner un string)
    if (camposAny.estado !== undefined) {
        actRaw.estado = Number(camposAny.estado);
    }
    if (id_evento) actRaw.evento = { id: id_evento } as any;

    console.log(`[ACTIVIDAD ${id}] Guardando con estado = ${actRaw.estado} (tipo: ${typeof actRaw.estado})`);
    await this.actividadRepository.save(actRaw);

    // Actualizar Modalidad (primera encontrada)
    if (modalidad !== undefined || min_nota !== undefined || min_asistencia !== undefined || sesiones !== undefined) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        let mod = actRaw.modalidades?.[0];
        if (!mod) {
          const res = await queryRunner.manager.query(
            `INSERT INTO curso_modalidades (id_actividad_academica, tipo, min_nota, min_asistencia) VALUES ($1, $2, $3, $4) RETURNING id`,
            [id, modalidad || 'Presencial', min_nota || 0, min_asistencia || 0]
          );
          mod = { id: res[0].id } as any;
        } else {
          const updateFields: string[] = [];
          const values: any[] = [];
          if (modalidad !== undefined) { updateFields.push(`tipo = $${values.length + 1}`); values.push(modalidad); }
          if (min_nota !== undefined) { updateFields.push(`min_nota = $${values.length + 1}`); values.push(min_nota); }
          if (min_asistencia !== undefined) { updateFields.push(`min_asistencia = $${values.length + 1}`); values.push(min_asistencia); }
          
          if (updateFields.length > 0) {
            values.push(mod.id);
            await queryRunner.manager.query(
              `UPDATE curso_modalidades SET ${updateFields.join(', ')} WHERE id = $${values.length}`,
              values
            );
          }
        }

        // Actualizar Sesiones
        if (sesiones !== undefined && Array.isArray(sesiones)) {
          await queryRunner.manager.query(`DELETE FROM sesiones_academicas WHERE id_curso_modalidad = $1`, [mod.id]);
          for (const s of sesiones) {
            await queryRunner.manager.query(
              `INSERT INTO sesiones_academicas (id_curso_modalidad, dia, hora_inicio, hora_fin) VALUES ($1, $2, $3, $4)`,
              [mod.id, s.dia, s.hora_inicio, s.hora_fin]
            );
          }
        }
        await queryRunner.commitTransaction();
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }
    }

    return this.findOne(id);
  }

  async eliminar(id: number, usuario?: any) {
    const act = await this.actividadRepository.findOne({
      where: { id },
      relations: ['evento', 'inscripciones', 'imparticiones', 'modalidades', 'certificados']
    });
    
    if (!act) throw new NotFoundException(`Actividad ${id} no encontrada.`);

    if (usuario) {
      await this.verificarPropiedad(act.evento.id, usuario);
    }

    // 1. Validar dependencias
    const dependencias: string[] = [];
    if (act.inscripciones?.length > 0) dependencias.push(`${act.inscripciones.length} inscripciones de estudiantes`);
    if (act.imparticiones?.length > 0) dependencias.push(`${act.imparticiones.length} ponentes asignados`);
    if (act.certificados?.length > 0) dependencias.push(`${act.certificados.length} certificados emitidos`);

    if (dependencias.length > 0) {
      throw new ForbiddenException(
        `No se puede eliminar la actividad porque tiene registros asociados: ${dependencias.join(', ')}. ` +
        `Debe anular o desvincular estos registros antes de borrar la actividad.`
      );
    }

    try {
      // 2. Limpiar modalidades antes de borrar la actividad
      if (act.modalidades?.length > 0) {
        const modIds = act.modalidades.map(m => m.id);
        // Las sesiones se borran por cascada o manualmente si es necesario
        await this.dataSource.query(`DELETE FROM sesiones_academicas WHERE id_curso_modalidad IN (${modIds.join(',')})`);
        await this.dataSource.query(`DELETE FROM curso_modalidades WHERE id_actividad_academica = $1`, [id]);
      }

      await this.actividadRepository.delete(id);
      return { mensaje: `Actividad ${id} eliminada correctamente.` };
    } catch (error) {
      console.error('Error eliminando actividad:', error);
      throw new ForbiddenException('Error de base de datos al intentar eliminar la actividad. Verifique restricciones de integridad.');
    }
  }

  async solicitarActivacion(id: number, usuario: any) {
    const act = await this.actividadRepository.findOne({ where: { id }, relations: ['evento'] });
    if (!act) throw new NotFoundException(`Actividad ${id} no encontrada.`);

    // Marcar en la descripción que hay una solicitud pendiente
    const tag = `[SOLICITUD_ACTIVACION]`;
    if (!act.descripcion?.includes(tag)) {
        act.descripcion = `${tag}\n${act.descripcion || ''}`;
        await this.actividadRepository.save(act);
    }

    // El log para activación ya fue añadido a la descripción. No se envía correo a MAIL_USER.
    
    return { message: 'Solicitud enviada correctamente al Super Usuario.' };
  }

  async getSolicitudesPendientes() {
    const solicitudes = await this.actividadRepository.createQueryBuilder('a')
        .leftJoinAndSelect('a.evento', 'e')
        .where('a.estado = :estado', { estado: -1 })
        .andWhere('a.descripcion LIKE :tag', { tag: '%[SOLICITUD_ACTIVACION]%' })
        .getMany();
    
    return solicitudes.map(act => ({
        ...act,
        imagen: this.formatImageUrl(act.imagen)
    }));
  }

  async aprobarReactivacion(id: number) {
    const act = await this.actividadRepository.findOneBy({ id });
    if (!act) throw new NotFoundException(`Actividad ${id} no encontrada.`);

    act.estado = 1;
    // Limpiar el tag de solicitud
    act.descripcion = (act.descripcion || '').replace('[SOLICITUD_ACTIVACION]\n', '').replace('[SOLICITUD_ACTIVACION]', '');
    
    return await this.actividadRepository.save(act);
  }

  async verificarPermisosEdicion(actividadId: number, usuario: any) {
    if (!usuario) return;
    if (usuario.roles?.includes('Super Usuario')) return;

    // Obtener la actividad
    const act = await this.actividadRepository.findOne({
      where: { id: actividadId },
      relations: ['evento'],
    });
    if (!act) throw new NotFoundException(`Actividad ${actividadId} no encontrada.`);

    const esCoordinador = (usuario.roles || []).some((rol: string) => String(rol).toLowerCase().includes('coordinador'));
    if (esCoordinador) {
      const [cuenta] = await this.dataSource.query('SELECT alcance_eventos FROM usuarios WHERE id = $1', [usuario.id]);
      if (cuenta?.alcance_eventos === 'libre') return;
    }

    // Verificar si es coordinador del evento
    const coord = await this.dataSource.query(
      `SELECT 1 FROM coordinacion_eventos WHERE id_evento = $1 AND id_usuario = $2`,
      [act.evento.id, usuario.id]
    );

    if (coord.length > 0) return; // Es coordinador

    // Verificar si es ponente asignado
    const isImpartidor = await this.dataSource.query(
      `SELECT 1 FROM imparticiones WHERE id_actividad_academica = $1 AND id_usuario = $2`,
      [actividadId, usuario.id]
    );

    if (isImpartidor.length > 0) return; // Es ponente asignado

    throw new ForbiddenException('No tienes permisos sobre esta actividad académica.');
  }

  async actualizarMateriales(actividadId: number, materiales: any[], usuario: any) {
    await this.verificarPermisosEdicion(actividadId, usuario);
    await this.verificarPermisoContenido(actividadId, 'material');

    const act = await this.actividadRepository.findOneBy({ id: actividadId });
    if (!act) throw new NotFoundException(`Actividad ${actividadId} no encontrada.`);

    act.materiales = materiales;
    await this.actividadRepository.save(act);

    return { 
      message: 'Materiales actualizados correctamente.', 
      materiales: act.materiales 
    };
  }

  // Métodos legacy
  create(data: Partial<ActividadAcademica>) {
    const actividad = this.actividadRepository.create(data);
    return this.actividadRepository.save(actividad);
  }

  update(id: number, data: Partial<ActividadAcademica>) {
    return this.actividadRepository.update(id, data);
  }

  remove(id: number) {
    return this.eliminar(id);
  }
}
