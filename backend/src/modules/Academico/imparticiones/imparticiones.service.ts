import { CoordinacionEvento } from '../coordinaciones/entities/coordinacion.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Imparticion } from './entities/imparticion.entity';
import { ActividadAcademica } from '../actividades-academicas/entities/actividad-academica.entity';
import { UsuariosService } from '../../Usuario/usuarios/usuarios.service';
import { AsignarPonenteDto } from './dto/asignar-ponente.dto';
import { CreateImparticionDto } from './dto/create-imparticion.dto';
import { RoleId } from '../../Usuario/usuarios/constants/user-roles.constants';

@Injectable()
export class ImparticionesService {
  constructor(
    @InjectRepository(Imparticion)
    private readonly imparticionRepository: Repository<Imparticion>,
    private readonly usuariosService: UsuariosService,
    @InjectRepository(CoordinacionEvento)
    private readonly coordinacionRepository: Repository<CoordinacionEvento>,
    @InjectRepository(ActividadAcademica)
    private readonly actividadRepository: Repository<ActividadAcademica>,
  ) {}

  /**
   * Vincula un ponente a una actividad.
   * Si el email no existe, crea el usuario automáticamente.
   */
  async asignarPonente(dto: AsignarPonenteDto) {
    const { email, nombres, primer_apellido, id_actividad, id_evento } = dto;

    // 1. Buscar si el usuario ya existe
    let usuario = await this.usuariosService.findOptionalByEmail(email);

    if (!usuario) {
      // 2. Si no existe, crearlo como Ponente
      usuario = (await this.usuariosService.crearPonente({
        email,
        password: 'Tyan.2026!', // Password temporal por defecto
        nombres,
        primer_apellido,
        id_rol: RoleId.PONENTE,
      })) as any;
    } else {
      // 3. Si existe, asegurar que tenga el rol de Ponente
      await this.usuariosService.asignarRol(usuario.id, RoleId.PONENTE);
    }

    // 4. Crear la Impartición (vincular a la actividad)
    if (!usuario) {
      throw new NotFoundException('No se pudo encontrar ni crear el usuario para el ponente.');
    }

    // Verificamos si ya está vinculado para evitar duplicados
    const existe = await this.imparticionRepository.findOne({
      where: {
        usuario: { id: usuario.id },
        actividadAcademica: { id: id_actividad },
      },
    });

    if (existe) {
      // Si ya existe pero nos pasan temática, actualizarla
      if (dto.tematica && existe.tematica !== dto.tematica) {
        await this.imparticionRepository.update(existe.id, { tematica: dto.tematica });
        return { ...existe, tematica: dto.tematica };
      }
      return existe;
    }

    const nuevaImparticion = this.imparticionRepository.create({
      usuario: { id: usuario.id },
      actividadAcademica: { id: id_actividad },
      evento: { id: id_evento },
      tematica: dto.tematica || undefined,
    });

    return this.imparticionRepository.save(nuevaImparticion);
  }

  // ── Coordinador ─────────────────────────────────────────────

  /** Asignar un ponente a una actividad y evento */
  async asignar(dto: CreateImparticionDto) {
    const imparticion = this.imparticionRepository.create({
      usuario: { id: dto.id_usuario },
      actividadAcademica: { id: dto.id_actividad_academica },
      evento: { id: dto.id_evento },
      tematica: dto.tematica || undefined,
    });
    return this.imparticionRepository.save(imparticion);
  }

  /** Actualizar la temática de una impartición existente */
  async actualizarTematica(id: number, tematica: string) {
    const imparticion = await this.imparticionRepository.findOneBy({ id });
    if (!imparticion) {
      throw new NotFoundException(`Impartición ${id} no encontrada`);
    }
    await this.imparticionRepository.update(id, { tematica });
    return { id, tematica, mensaje: 'Temática actualizada correctamente.' };
  }

  /** Remover una asignación de ponente */
  async remover(id: number) {
    const imparticion = await this.imparticionRepository.findOneBy({ id });
    if (!imparticion) {
      throw new NotFoundException(`Impartición ${id} no encontrada`);
    }
    await this.imparticionRepository.delete(id);
    return { mensaje: `Impartición ${id} eliminada` };
  }

  /** Listar imparticiones de un evento específico (directorio) */
  async findByEvento(eventoId: number) {
    return this.imparticionRepository.find({
      where: { evento: { id: eventoId } },
      relations: ['usuario', 'usuario.persona', 'actividadAcademica'],
    });
  }

  /** Listar imparticiones de una actividad específica (detalle de actividad) */
  async findByActividad(actividadId: number) {
    return this.imparticionRepository.find({
      where: { actividadAcademica: { id: actividadId } },
      relations: ['usuario', 'usuario.persona', 'actividadAcademica', 'evento'],
    });
  }

  // ── Métodos legacy (scaffold default) ──────────────────────

  // ══════════════════════════════════════════════════════════
  //  PONENTE — Vista personal
  // ══════════════════════════════════════════════════════════

  /**
   * Si el super admin asignó al ponente como responsable del evento
   * (coordinacion_eventos), crea las imparticiones de las actividades activas
   * para que el portal y las notas las reconozcan.
   */
  async asignarAEvento(eventoId: number, usuarioId: number) {
    const actividades = await this.actividadRepository.find({
      where: { evento: { id: eventoId } },
    });
    let asignadas = 0;
    for (const act of actividades) {
      if (Number(act.estado) === -1) continue;
      const existe = await this.imparticionRepository.findOne({
        where: {
          usuario: { id: usuarioId },
          actividadAcademica: { id: act.id },
        },
      });
      if (existe) continue;
      const nueva = this.imparticionRepository.create({
        usuario: { id: usuarioId } as any,
        actividadAcademica: { id: act.id } as any,
        evento: { id: eventoId } as any,
      });
      await this.imparticionRepository.save(nueva);
      asignadas += 1;
    }
    return { asignadas, totalActividades: actividades.filter((a) => Number(a.estado) !== -1).length };
  }

  private async usuarioEsPonente(usuarioId: number) {
    const filas = await this.imparticionRepository.manager.query(
      `SELECT 1
         FROM usuarios_roles ur
         JOIN roles r ON r.id = ur.id_rol
        WHERE ur.id_usuario = $1
          AND translate(lower(r.nombre_rol), 'áéíóúü', 'aeiouu') LIKE '%ponent%'
        LIMIT 1`,
      [usuarioId],
    );
    return Array.isArray(filas) && filas.length > 0;
  }

  private async asegurarImparticionesDesdeCoordinacion(usuarioId: number) {
    if (!(await this.usuarioEsPonente(usuarioId))) return;
    const coordinaciones = await this.coordinacionRepository.find({
      where: { usuario: { id: usuarioId } },
      relations: ['evento'],
    });
    for (const asignacion of coordinaciones) {
      if (asignacion.evento?.id) {
        await this.asignarAEvento(asignacion.evento.id, usuarioId);
      }
    }
  }

  /**
   * Devuelve las actividades académicas que imparte el ponente autenticado.
   * Incluye datos del evento y el conteo de inscritos por actividad.
   */
  async findMisActividades(usuarioId: number) {
    await this.asegurarImparticionesDesdeCoordinacion(usuarioId);
    return this.imparticionRepository.find({
      where: { usuario: { id: usuarioId } },
      relations: [
        'actividadAcademica',
        'actividadAcademica.evento',
        'actividadAcademica.modalidades',
        'actividadAcademica.inscripciones',
        'evento',
      ],
      order: { fecha_creacion: 'DESC' },
    });
  }

  /** Eventos asignados directamente o mediante actividades; solo incluye actividades propias. */
  async findMisEventos(usuarioId: number) {
    await this.asegurarImparticionesDesdeCoordinacion(usuarioId);
    const [coordinaciones, imparticiones] = await Promise.all([
      this.coordinacionRepository.find({
        where: { usuario: { id: usuarioId } },
        relations: ['evento'],
        order: { fecha_creacion: 'DESC' },
      }),
      this.imparticionRepository.find({
        where: { usuario: { id: usuarioId } },
        relations: [
          'actividadAcademica',
          'actividadAcademica.evento',
          'actividadAcademica.modalidades',
          'actividadAcademica.inscripciones',
          'evento',
        ],
        order: { fecha_creacion: 'DESC' },
      }),
    ]);
    const eventos = new Map<number, { evento: CoordinacionEvento['evento']; actividades: Imparticion['actividadAcademica'][] }>();
    for (const asignacion of coordinaciones) {
      if (asignacion.evento) eventos.set(asignacion.evento.id, { evento: asignacion.evento, actividades: [] });
    }
    for (const imparticion of imparticiones) {
      const actividad = imparticion.actividadAcademica;
      const evento = imparticion.evento || actividad?.evento;
      if (!evento || !actividad || Number(actividad.estado) === -1) continue;
      if (!eventos.has(evento.id)) eventos.set(evento.id, { evento, actividades: [] });
      const grupo = eventos.get(evento.id)!;
      if (!grupo.actividades.some((act) => act.id === actividad.id)) grupo.actividades.push(actividad);
    }
    return Array.from(eventos.values());
  }

  /**
   * Devuelve los estudiantes inscritos en las actividades del ponente.
   * Incluye datos personales, notas y número de asistencias por modalidad.
   * Agrupado por actividad para fácil procesamiento en el frontend.
   */
  async findMisEstudiantes(usuarioId: number) {
    await this.asegurarImparticionesDesdeCoordinacion(usuarioId);
    const imparticiones = await this.imparticionRepository.find({
      where: { usuario: { id: usuarioId } },
      relations: [
        'actividadAcademica',
        'actividadAcademica.inscripciones',
        'actividadAcademica.inscripciones.usuario',
        'actividadAcademica.inscripciones.usuario.persona',
        'actividadAcademica.inscripciones.usuario.afiliaciones',
        'actividadAcademica.inscripciones.modalidades',
        'actividadAcademica.inscripciones.modalidades.cursoModalidad',
        'evento',
      ],
    });

    return imparticiones.map((imp) => ({
      actividad_id: imp.actividadAcademica?.id,
      actividad_nombre: (imp.actividadAcademica as any)?.nombre,
      evento_nombre: imp.evento?.nombre,
      estudiantes: (imp.actividadAcademica?.inscripciones ?? []).map((ins) => ({
        inscripcion_id: ins.id,
        estado: ins.estado,
        nota_principal: ins.nota_principal,
        usuario_id: ins.usuario?.id,
        email: ins.usuario?.email,
        nombres: ins.usuario?.persona?.nombres,
        primer_apellido: ins.usuario?.persona?.primer_apellido,
        segundo_apellido: ins.usuario?.persona?.segundo_apellido,
        modalidades: ins.modalidades?.map((m) => ({
          id: m.id,
          nota: m.nota,
          num_asistencia: m.num_asistencia,
          aprobado: m.aprobado,
        })) ?? [],
      })),
    }));
  }


  create(data: Partial<Imparticion>) {
    return this.imparticionRepository.save(this.imparticionRepository.create(data));
  }

  findAll() {
    return this.imparticionRepository.find({
      relations: ['usuario', 'actividadAcademica', 'evento'],
    });
  }

  findOne(id: number) {
    return this.imparticionRepository.findOne({
      where: { id },
      relations: ['usuario', 'actividadAcademica', 'evento'],
    });
  }

  update(id: number, data: Partial<Imparticion>) {
    return this.imparticionRepository.update(id, data);
  }

  remove(id: number) {
    return this.imparticionRepository.delete(id);
  }
}
