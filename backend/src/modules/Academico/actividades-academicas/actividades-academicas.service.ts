import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { existsSync, readdirSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { ActividadAcademica } from './entities/actividad-academica.entity';
import { CreateActividadDto } from './dto/create-actividad.dto';
import { UpdateActividadDto } from './dto/update-actividad.dto';
import { MailService } from '../../Comun/mail/mail.service';
import { formatMediaUrl } from '../../../common/media-url.util';
import { resumenAula } from './aula-resumen';
import { esquemaEvaluacion, exigeTiempoExamen, modoEvaluacion, permisosContenido, permiteEvaluacion, SQL_PUEDE_EVALUAR, TipoContenido, validarEsquema } from './aula-permisos';

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

  private fotoPerfilPublica(userId: number): string | null {
    const id = Math.trunc(Number(userId));
    if (!Number.isInteger(id) || id <= 0) return null;
    // Solo rutas constantes: se lista el directorio y se empareja por regex (sin join con input).
    const perfilesDir = resolve(process.cwd(), 'uploads', 'perfiles');
    if (!existsSync(perfilesDir)) return null;
    try {
      const match = readdirSync(perfilesDir).find((nombre) => {
        const m = /^user_(\d+)\.(jpg|jpeg|png)$/i.exec(nombre);
        return m != null && Number(m[1]) === id;
      });
      return match ? `/uploads/perfiles/${match}` : null;
    } catch {
      return null;
    }
  }

  /** Ficha pública: expone datos del curso sin inscripciones ni datos privados. */
  async findPublicOne(id: number) {
    const act = await this.actividadRepository.findOne({
      where: { id },
      relations: [
        'evento',
        'modalidades',
        'imparticiones',
        'imparticiones.usuario',
        'imparticiones.usuario.persona',
        'imparticiones.usuario.afiliaciones',
        'imparticiones.usuario.afiliaciones.gradoAcademico',
      ],
    });
    if (!act || Number(act.estado) === -1 || Number(act.evento?.estado) === -1) {
      throw new NotFoundException(`Curso ${id} no disponible.`);
    }
    const [{ total }] = await this.dataSource.query(
      'SELECT COUNT(*)::integer AS total FROM inscripciones WHERE id_actividad_academica = $1 AND estado = 1',
      [id],
    );
    const contenido = await this.dataSource.query(
      "SELECT id, tipo, titulo, descripcion, orden FROM curso_lecciones WHERE id_actividad_academica = $1 AND publicado = true AND ($2::boolean OR tipo IN ('video','material')) ORDER BY orden, id",
      [id, permiteEvaluacion(act.tipo, act.requisitos)],
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
      docentes: (act.imparticiones || [])
        .filter((item) => item.usuario?.persona && Number(item.usuario.estado ?? 1) === 1)
        .map((item) => {
          const persona = item.usuario.persona;
          const afiliacion = item.usuario.afiliaciones?.[0];
          const gradoRaw = String(
            persona.grado_academico
            || afiliacion?.gradoAcademico?.abreviacion
            || afiliacion?.gradoAcademico?.descripcion
            || '',
          ).trim();
          const grado = !gradoRaw || gradoRaw === '0' ? '' : gradoRaw;
          const institucion = String(afiliacion?.institucion || '').trim();
          const curriculum = String(persona.curriculum || '').trim()
            || [afiliacion?.disciplina_cientifica, afiliacion?.area_tematica, institucion !== '0' ? institucion : '']
              .map((parte) => String(parte || '').trim())
              .filter(Boolean)
              .join(' · ');
          return {
            id: item.usuario.id,
            nombre: [persona.nombres, persona.primer_apellido, persona.segundo_apellido].filter(Boolean).join(' '),
            grado,
            foto: this.fotoPerfilPublica(item.usuario.id),
            curriculum,
            institucion: institucion && institucion !== '0' ? institucion : '',
          };
        }),
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
    if (!titulo || titulo.length > 255 || !['examen', 'material', 'practica', 'laboratorio'].includes(tipo)) {
      throw new BadRequestException(tipo === 'video' ? 'Los videos están deshabilitados. Usa archivos, enlaces o prácticas.' : 'Título o tipo de lección inválido.');
    }
    const recursos = input?.recursos ?? [];
    const recursoValido = (r: any) =>
      r &&
      typeof r.nombre === 'string' &&
      !!r.nombre.trim() &&
      r.nombre.length <= 255 &&
      typeof r.url === 'string' &&
      (/^\/uploads\/materiales\/[a-zA-Z0-9-]+\.[a-zA-Z0-9]+$/.test(r.url) || /^https:\/\//i.test(r.url));
    if (!Array.isArray(recursos) || recursos.length > 20 || recursos.some((r: any) => !recursoValido(r))) {
      throw new BadRequestException('Los recursos deben ser archivos subidos al aula o enlaces HTTPS.');
    }
    const peso = Number(input?.peso ?? 1);
    if (!Number.isFinite(peso) || peso < 0 || peso > 100) throw new BadRequestException('El peso debe estar entre 0 y 100.');
    if (['material', 'practica', 'laboratorio'].includes(tipo) && preguntas.length) throw new BadRequestException('Utiliza un examen o un video para añadir un cuestionario.');
    if (tipo === 'video' && (!videoUrl || !(/^\/uploads\/materiales\/[a-zA-Z0-9-]+\.[a-zA-Z0-9]+$/.test(videoUrl) || /^https:\/\//i.test(videoUrl)))) throw new BadRequestException('La lección necesita un video subido o un enlace HTTPS.');
    if (tipo === 'examen' && (!Array.isArray(preguntas) || !preguntas.length)) throw new BadRequestException('El examen necesita preguntas.');
    if (!Array.isArray(preguntas) || preguntas.length > 100 || preguntas.some((p: any) =>
      !p || !String(p.enunciado || '').trim() || !Array.isArray(p.opciones) || p.opciones.length < 2 || p.opciones.length > 8 ||
      p.opciones.some((o: any) => !String(o || '').trim()) || !Number.isInteger(p.correcta) || p.correcta < 0 || p.correcta >= p.opciones.length,
    )) throw new BadRequestException('Las preguntas deben incluir enunciado, opciones y una respuesta válida.');
    const orden = Number(input?.orden || 0);
    if (!Number.isInteger(orden) || orden < 0) throw new BadRequestException('El orden de la lección debe ser un número entero positivo.');
    const plazo = input?.plazo ? String(input.plazo).slice(0, 10) : null;
    if (plazo && !/^\d{4}-\d{2}-\d{2}$/.test(plazo)) throw new BadRequestException('El plazo debe tener formato AAAA-MM-DD.');
    const disponibleDesde = input?.disponible_desde ? String(input.disponible_desde).slice(0, 10) : null;
    if (disponibleDesde && !/^\d{4}-\d{2}-\d{2}$/.test(disponibleDesde)) throw new BadRequestException('La fecha de apertura debe tener formato AAAA-MM-DD.');
    if (disponibleDesde && plazo && disponibleDesde > plazo) throw new BadRequestException('La fecha de apertura no puede ser posterior al plazo de entrega.');
    const claveItem = input?.clave_item ? String(input.clave_item).trim().slice(0, 40) : null;
    const tiempo = input?.tiempo_limite_minutos == null || input?.tiempo_limite_minutos === '' ? null : Number(input.tiempo_limite_minutos);
    if (tiempo != null && (!Number.isInteger(tiempo) || tiempo < 1 || tiempo > 600)) throw new BadRequestException('El tiempo límite debe estar entre 1 y 600 minutos.');
    return { titulo, tipo, videoUrl, preguntas, recursos: recursos.map(r => ({ nombre: r.nombre.trim(), url: r.url })), peso, descripcion: String(input?.descripcion || ''), orden, publicado: input?.publicado === true, plazo, disponibleDesde, claveItem, tiempo };
  }

  async guardarLeccion(actividadId: number, input: any, usuario: any, leccionId?: number) {
    await this.verificarPermisosEdicion(actividadId, usuario);
    let data = this.validarLeccion(input);
    const config = await this.obtenerConfiguracionAula(actividadId);
    await this.verificarPermisoContenido(actividadId, data.tipo as TipoContenido);
    if (data.preguntas.length) await this.verificarPermisoContenido(actividadId, 'examen');
    if (data.recursos.length && !['practica', 'laboratorio'].includes(data.tipo)) await this.verificarPermisoContenido(actividadId, 'material');
    if (data.tipo === 'examen' && exigeTiempoExamen(config.requisitos) && !data.tiempo) {
      throw new BadRequestException('El examen necesita un tiempo límite en minutos.');
    }
    if (data.claveItem && config.evaluacion?.items?.length) {
      const item = config.evaluacion.items.find((fila: any) => fila.clave === data.claveItem);
      if (!item) throw new BadRequestException('El rubro de calificación no pertenece a esta actividad.');
      const tipoLeccion = item.tipo === 'seccion' ? 'examen' : item.tipo;
      data = {
        ...data,
        tipo: tipoLeccion,
        titulo: data.titulo || item.nombre,
        peso: Number(item.puntaje),
        plazo: data.plazo || item.plazo,
      };
    }
    if (leccionId) {
      const result = await this.dataSource.query(
        `UPDATE curso_lecciones SET tipo=$3, titulo=$4, descripcion=$5, orden=$6, video_url=$7, preguntas=$8::jsonb, publicado=$9, recursos=$10::jsonb, peso=$11, plazo=$12, tiempo_limite_minutos=$13, disponible_desde=$14, clave_item=$15, fecha_actualizacion=now()
         WHERE id=$1 AND id_actividad_academica=$2 RETURNING *`,
        [leccionId, actividadId, data.tipo, data.titulo, data.descripcion, data.orden, data.videoUrl, JSON.stringify(data.preguntas), data.publicado, JSON.stringify(data.recursos), data.peso, data.plazo, data.tiempo, data.disponibleDesde, data.claveItem],
      );
      if (!result.length) throw new NotFoundException('Lección no encontrada.');
      return result[0];
    }
    const result = await this.dataSource.query(
      `INSERT INTO curso_lecciones (id_actividad_academica, tipo, titulo, descripcion, orden, video_url, preguntas, publicado, recursos, peso, plazo, tiempo_limite_minutos, disponible_desde, clave_item)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11,$12,$13,$14) RETURNING *`,
      [actividadId, data.tipo, data.titulo, data.descripcion, data.orden, data.videoUrl, JSON.stringify(data.preguntas), data.publicado, JSON.stringify(data.recursos), data.peso, data.plazo, data.tiempo, data.disponibleDesde, data.claveItem],
    );
    return result[0];
  }

  async listarLeccionesEditor(actividadId: number, usuario: any) {
    await this.verificarPermisosEdicion(actividadId, usuario);
    const config = await this.obtenerConfiguracionAula(actividadId);
    const rows = await this.dataSource.query('SELECT * FROM curso_lecciones WHERE id_actividad_academica=$1 ORDER BY orden,id', [actividadId]);
    return permiteEvaluacion(config.tipo_actividad, config.requisitos) ? rows : rows.filter((l: any) => ['video', 'material'].includes(l.tipo)).map((l: any) => ({ ...l, preguntas: [], peso: 0 }));
  }

  private async obtenerConfiguracionAula(actividadId: number) {
    const act = await this.actividadRepository.findOne({ where: { id: actividadId }, relations: ['modalidades'] });
    if (!act) throw new NotFoundException('Actividad no encontrada.');
    const modalidad = act.modalidades?.[0]?.tipo || '';
    const evaluacion = act.requisitos?.evaluacion ? esquemaEvaluacion(act.tipo, act.requisitos) : null;
    return { tipo_actividad: act.tipo, modalidad, evaluacion, requisitos: act.requisitos, permisos: permisosContenido(act.tipo, act.requisitos, modalidad) };
  }

  async configuracionAula(actividadId: number, usuario: any) {
    await this.verificarPermisosEdicion(actividadId, usuario);
    const { requisitos, ...config } = await this.obtenerConfiguracionAula(actividadId);
    return config;
  }

  async verificarPermisoContenido(actividadId: number, tipo: TipoContenido) {
    const config = await this.obtenerConfiguracionAula(actividadId);
    if (['practica', 'examen', 'laboratorio'].includes(tipo) && !permiteEvaluacion(config.tipo_actividad, config.requisitos)) throw new BadRequestException('Las prácticas, cuestionarios y exámenes solo están disponibles en actividades de tipo Curso.');
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
      `SELECT l.id, l.tipo, l.titulo, l.descripcion, l.orden, l.video_url, l.plazo, l.disponible_desde, l.clave_item, l.tiempo_limite_minutos, CASE WHEN ${SQL_PUEDE_EVALUAR} THEN l.preguntas ELSE '[]'::jsonb END AS preguntas, l.recursos, l.peso, p.completado_en, p.nota, p.entrega, p.retroalimentacion
       FROM curso_lecciones l JOIN actividades_academicas a ON a.id=l.id_actividad_academica LEFT JOIN curso_progreso p ON p.id_leccion=l.id AND p.id_usuario=$2
       WHERE l.id_actividad_academica=$1 AND l.publicado=true AND (${SQL_PUEDE_EVALUAR} OR l.tipo IN ('video','material')) ORDER BY l.orden,l.id`,
      [actividadId, usuario.id],
    );
    const hoy = new Date().toISOString().slice(0, 10);
    return rows.map(({ preguntas, ...row }: any) => ({
      ...row,
      abierta: !row.disponible_desde || String(row.disponible_desde).slice(0, 10) <= hoy,
      vencida: !!(row.plazo && String(row.plazo).slice(0, 10) < hoy),
      completado_en: ['practica', 'laboratorio'].includes(row.tipo) && row.nota == null ? null : row.completado_en,
      preguntas: (preguntas || []).map((p: any) => ({ enunciado: p.enunciado, opciones: p.opciones })),
    }));
  }

  async completarLeccion(actividadId: number, leccionId: number, respuestas: unknown, usuario: any) {
    const inscripcionId = await this.verificarInscripcion(actividadId, usuario.id);
    const rows = await this.dataSource.query(
      `SELECT l.id, l.tipo, l.plazo, l.disponible_desde, CASE WHEN ${SQL_PUEDE_EVALUAR} THEN l.preguntas ELSE '[]'::jsonb END AS preguntas FROM curso_lecciones l JOIN actividades_academicas a ON a.id=l.id_actividad_academica WHERE l.id=$1 AND l.id_actividad_academica=$2 AND l.publicado=true AND (${SQL_PUEDE_EVALUAR} OR l.tipo IN ('video','material'))`,
      [leccionId, actividadId],
    );
    if (!rows.length) throw new NotFoundException('Lección no disponible.');
    if (['practica', 'laboratorio'].includes(rows[0].tipo)) throw new BadRequestException('Esta práctica requiere una entrega y la calificación del docente.');
    const hoy = new Date().toISOString().slice(0, 10);
    if (rows[0].disponible_desde && String(rows[0].disponible_desde).slice(0, 10) > hoy) throw new BadRequestException('Esta evaluación todavía no está abierta.');
    if (rows[0].plazo && String(rows[0].plazo).slice(0, 10) < hoy) throw new BadRequestException('El plazo de esta evaluación ya venció.');
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
    const [leccion] = await this.dataSource.query(
      `SELECT id, plazo, disponible_desde FROM curso_lecciones WHERE id=$1 AND id_actividad_academica=$2 AND tipo IN ('practica','laboratorio') AND publicado=true AND EXISTS(SELECT 1 FROM actividades_academicas a WHERE a.id=$2 AND ${SQL_PUEDE_EVALUAR})`,
      [leccionId, actividadId],
    );
    if (!leccion) throw new NotFoundException('Práctica no disponible.');
    const hoy = new Date().toISOString().slice(0, 10);
    if (leccion.disponible_desde && String(leccion.disponible_desde).slice(0, 10) > hoy) {
      throw new BadRequestException('Esta tarea todavía no está abierta para entregas.');
    }
    if (leccion.plazo && String(leccion.plazo).slice(0, 10) < hoy) {
      throw new BadRequestException('El plazo de esta tarea ya venció.');
    }
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
      WHERE l.id_actividad_academica=$1 AND l.tipo IN ('practica','laboratorio') AND p.entrega IS NOT NULL AND EXISTS(SELECT 1 FROM actividades_academicas a WHERE a.id=l.id_actividad_academica AND ${SQL_PUEDE_EVALUAR}) ORDER BY p.nota IS NOT NULL,p.completado_en`, [actividadId]);
  }

  private async asegurarLeccionRubro(actividadId: number, item: { clave: string; tipo: string; nombre: string; puntaje: number; plazo: string | null }) {
    const [existente] = await this.dataSource.query(
      `SELECT id FROM curso_lecciones WHERE id_actividad_academica=$1 AND clave_item=$2 LIMIT 1`,
      [actividadId, item.clave],
    );
    if (existente) return Number(existente.id);
    const tipo = item.tipo === 'seccion' ? 'examen' : item.tipo;
    const [creada] = await this.dataSource.query(
      `INSERT INTO curso_lecciones (id_actividad_academica, tipo, titulo, descripcion, orden, video_url, preguntas, publicado, recursos, peso, plazo, tiempo_limite_minutos, disponible_desde, clave_item)
       VALUES ($1,$2,$3,'',0,null,'[]'::jsonb,true,'[]'::jsonb,$4,$5,null,null,$6) RETURNING id`,
      [actividadId, tipo, item.nombre, item.puntaje, item.plazo, item.clave],
    );
    return Number(creada.id);
  }

  async listarNotasRubrica(actividadId: number, usuario: any) {
    await this.verificarPermisosEdicion(actividadId, usuario);
    const config = await this.obtenerConfiguracionAula(actividadId);
    if (!permiteEvaluacion(config.tipo_actividad, config.requisitos)) {
      return { esquema: null, estudiantes: [], mensaje: 'Esta actividad califica solo por asistencia.' };
    }
    const esquema = config.evaluacion;
    const lecciones = await this.dataSource.query(
      `SELECT id, clave_item, titulo, peso, tipo FROM curso_lecciones WHERE id_actividad_academica=$1 ORDER BY orden,id`,
      [actividadId],
    );
    const inscritos = await this.dataSource.query(
      `SELECT i.id AS inscripcion_id, i.id_usuario, i.nota_principal, i.sin_cuenta, i.nombre_externo, i.email_externo,
              u.email, CONCAT_WS(' ', per.nombres, per.primer_apellido, per.segundo_apellido) AS nombre
       FROM inscripciones i
       LEFT JOIN usuarios u ON u.id = i.id_usuario
       LEFT JOIN personas per ON per.id_usuario = u.id
       WHERE i.id_actividad_academica=$1 AND i.estado IN (1,3)
       ORDER BY COALESCE(per.primer_apellido, i.nombre_externo), COALESCE(per.nombres, '')`,
      [actividadId],
    );
    const progreso = await this.dataSource.query(
      `SELECT p.id_usuario, p.id_leccion, p.nota, l.clave_item
       FROM curso_progreso p
       JOIN curso_lecciones l ON l.id = p.id_leccion
       WHERE l.id_actividad_academica=$1`,
      [actividadId],
    );
    const resumenes = await Promise.all(
      inscritos.filter((fila: any) => fila.id_usuario).map(async (fila: any) => {
        const resumen = await resumenAula(this.dataSource, actividadId, Number(fila.id_usuario));
        return { id_usuario: Number(fila.id_usuario), resumen };
      }),
    );
    const resumenPorUsuario = new Map(resumenes.map((fila) => [fila.id_usuario, fila.resumen]));
    const estudiantes = inscritos.map((fila: any) => {
      const notas: Record<string, number | null> = {};
      for (const item of esquema?.items || []) {
        const filaNota = progreso.find((p: any) => Number(p.id_usuario) === Number(fila.id_usuario) && p.clave_item === item.clave);
        notas[item.clave] = filaNota?.nota == null ? null : Number(filaNota.nota);
      }
      const resumen = fila.id_usuario ? resumenPorUsuario.get(Number(fila.id_usuario)) : null;
      return {
        inscripcion_id: fila.inscripcion_id,
        id_usuario: fila.id_usuario,
        nombre: fila.nombre?.trim() || fila.nombre_externo || 'Sin nombre',
        email: fila.email || fila.email_externo || '',
        sin_cuenta: Number(fila.sin_cuenta || 0) === 1,
        asistencia: resumen?.asistencia ?? null,
        notas,
        total: resumen?.promedio ?? (fila.nota_principal == null ? null : Number(fila.nota_principal)),
      };
    });
    return { esquema, lecciones, estudiantes };
  }

  async guardarEsquemaEvaluacion(actividadId: number, input: any, usuario: any) {
    await this.verificarPermisosEdicion(actividadId, usuario);
    const act = await this.actividadRepository.findOne({ where: { id: actividadId } });
    if (!act) throw new NotFoundException(`Actividad ${actividadId} no encontrada.`);
    if (!permiteEvaluacion(act.tipo, act.requisitos)) {
      throw new BadRequestException('Esta actividad no usa rubros de calificación.');
    }
    const modo = modoEvaluacion(act.tipo, act.requisitos);
    const actual = act.requisitos || {};
    const evaluacionEntrada = {
      modo,
      asistencia: Number(input?.asistencia ?? actual.evaluacion?.asistencia ?? 0),
      bloques: {
        contenido: true,
        secciones: true,
        practica: true,
        examen: true,
        ...(actual.evaluacion?.bloques || {}),
        ...(input?.bloques || {}),
        laboratorio: false,
      },
      items: Array.isArray(input?.items) ? input.items : (actual.evaluacion?.items || []),
    };
    const requisitos = this.aplicarEsquema(act.tipo, {
      ...actual,
      aula: { ...(actual.aula || {}), video: false, material: actual.aula?.material !== false, practica: true, examen: true },
      evaluacion: evaluacionEntrada,
    });
    await this.actividadRepository.update(actividadId, { requisitos });
    for (const item of requisitos.evaluacion?.items || []) {
      await this.dataSource.query(
        `UPDATE curso_lecciones
         SET peso = $1,
             titulo = CASE WHEN COALESCE(TRIM(titulo), '') = '' THEN $2 ELSE titulo END
         WHERE id_actividad_academica = $3 AND clave_item = $4`,
        [item.puntaje, item.nombre, actividadId, item.clave],
      );
    }
    return { esquema: requisitos.evaluacion };
  }

  async guardarNotaRubrica(actividadId: number, input: any, usuario: any) {
    await this.verificarPermisosEdicion(actividadId, usuario);
    const config = await this.obtenerConfiguracionAula(actividadId);
    if (!permiteEvaluacion(config.tipo_actividad, config.requisitos)) {
      throw new BadRequestException('Esta actividad no usa rubros de calificación.');
    }
    const idUsuario = Number(input?.id_usuario);
    const claveItem = String(input?.clave_item || '').trim();
    const nota = Number(input?.nota);
    if (!idUsuario || !claveItem) throw new BadRequestException('Indica el estudiante y el rubro.');
    if (!Number.isFinite(nota) || nota < 0 || nota > 100) throw new BadRequestException('La nota debe estar entre 0 y 100.');
    const item = config.evaluacion?.items?.find((fila: any) => fila.clave === claveItem);
    if (!item) throw new BadRequestException('El rubro no existe en el esquema de la actividad.');
    const [inscrito] = await this.dataSource.query(
      `SELECT id FROM inscripciones WHERE id_actividad_academica=$1 AND id_usuario=$2 AND estado IN (1,3) LIMIT 1`,
      [actividadId, idUsuario],
    );
    if (!inscrito) throw new NotFoundException('El estudiante no está inscrito en esta actividad.');
    const leccionId = await this.asegurarLeccionRubro(actividadId, item);
    await this.dataSource.query(
      `INSERT INTO curso_progreso (id_leccion, id_usuario, nota, completado_en, calificado_por, calificado_en)
       VALUES ($1,$2,$3,now(),$4,now())
       ON CONFLICT (id_leccion, id_usuario) DO UPDATE
       SET nota=EXCLUDED.nota, calificado_por=$4, calificado_en=now(), completado_en=COALESCE(curso_progreso.completado_en, now())`,
      [leccionId, idUsuario, nota, usuario.id],
    );
    return this.sincronizarNota(actividadId, idUsuario, Number(inscrito.id));
  }

  async calificarPractica(actividadId: number, progresoId: number, input: any, usuario: any) {
    await this.verificarPermisosEdicion(actividadId, usuario);
    const nota = input?.nota;
    const feedback = String(input?.retroalimentacion || '').trim();
    if (typeof nota !== 'number' || !Number.isFinite(nota) || nota < 0 || nota > 100 || feedback.length > 5000) throw new BadRequestException('Indica una nota entre 0 y 100 y una devolución de hasta 5000 caracteres.');
    const [entrega] = await this.dataSource.query(`UPDATE curso_progreso p SET nota=$3, retroalimentacion=$4, calificado_por=$5, calificado_en=now()
      FROM curso_lecciones l WHERE p.id=$1 AND p.id_leccion=l.id AND l.id_actividad_academica=$2 AND l.tipo IN ('practica','laboratorio') AND p.entrega IS NOT NULL AND EXISTS(SELECT 1 FROM actividades_academicas a WHERE a.id=l.id_actividad_academica AND ${SQL_PUEDE_EVALUAR})
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

  private aplicarEsquema(tipo: string | undefined, requisitos: any) {
    if (!requisitos || typeof requisitos !== 'object') return requisitos;
    const aula = { ...(requisitos.aula || {}), video: false };
    if (!requisitos.evaluacion) return { ...requisitos, aula };
    const crudo = requisitos.evaluacion;
    if (modoEvaluacion(tipo || '', requisitos) === 'asistencia' && (crudo.items?.length || crudo.bloques?.secciones || crudo.bloques?.practica || crudo.bloques?.laboratorio || crudo.bloques?.examen)) {
      throw new BadRequestException('Este tipo de actividad solo califica asistencia.');
    }
    const esquema = esquemaEvaluacion(tipo || '', requisitos);
    const error = validarEsquema(esquema);
    if (error) throw new BadRequestException(error);
    return { ...requisitos, aula, evaluacion: esquema };
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
    if (Number(ev.estado) === -1 || Number(ev.fase) === 5) {
      throw new BadRequestException('Este evento está inhabilitado o archivado. Actívalo de nuevo para publicar actividades.');
    }
    if (Number(ev.estado) === 0) {
      throw new BadRequestException('Este evento está cerrado. Cámbialo a Activo para publicar actividades.');
    }

    if (usuario) {
      await this.verificarPropiedad(dto.id_evento, usuario);
    }
    const { id_evento, modalidad, min_nota, min_asistencia, sesiones, ...campos } = dto;
    if (campos.requisitos) campos.requisitos = this.aplicarEsquema(campos.tipo, campos.requisitos);
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
    if ((campos as any).requisitos) (campos as any).requisitos = this.aplicarEsquema((campos as any).tipo || actRaw.tipo, (campos as any).requisitos);
    
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

  async actualizarAccesoYSesiones(
    actividadId: number,
    body: { aula_fisica?: string; enlace_virtual?: string; sesiones?: { dia?: string; hora_inicio?: string; hora_fin?: string }[] },
    usuario: any,
  ) {
    await this.verificarPermisosEdicion(actividadId, usuario);
    const act = await this.actividadRepository.findOne({
      where: { id: actividadId },
      relations: ['modalidades'],
    });
    if (!act) throw new NotFoundException(`Actividad ${actividadId} no encontrada.`);

    const requisitos = { ...(act.requisitos || {}) };
    requisitos.acceso = {
      ...(requisitos.acceso || {}),
      aula_fisica: String(body.aula_fisica ?? requisitos.acceso?.aula_fisica ?? '').trim().slice(0, 200),
      enlace_virtual: String(body.enlace_virtual ?? requisitos.acceso?.enlace_virtual ?? '').trim().slice(0, 500),
    };
    act.requisitos = requisitos;
    await this.actividadRepository.save(act);

    if (Array.isArray(body.sesiones)) {
      let modId = act.modalidades?.[0]?.id;
      if (!modId) {
        const creada = await this.dataSource.query(
          `INSERT INTO curso_modalidades (id_actividad_academica, tipo, min_nota, min_asistencia) VALUES ($1, $2, 51, 80) RETURNING id`,
          [actividadId, 'Presencial'],
        );
        modId = creada[0].id;
      }
      await this.dataSource.query(`DELETE FROM sesiones_academicas WHERE id_curso_modalidad = $1 AND fecha IS NULL`, [modId]);
      for (const sesion of body.sesiones) {
        const dia = String(sesion.dia || '').trim();
        const inicio = String(sesion.hora_inicio || '').trim();
        const fin = String(sesion.hora_fin || '').trim();
        if (!dia || !inicio || !fin) continue;
        await this.dataSource.query(
          `INSERT INTO sesiones_academicas (id_curso_modalidad, dia, hora_inicio, hora_fin) VALUES ($1, $2, $3, $4)`,
          [modId, dia, inicio, fin],
        );
      }
    }

    return this.findOne(actividadId);
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
