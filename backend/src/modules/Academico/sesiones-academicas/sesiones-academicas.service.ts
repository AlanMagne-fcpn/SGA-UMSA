import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { SesionAcademica } from './entities/sesion-academica.entity';
import { CreateSesionAcademicaDto } from './dto/create-sesion-academica.dto';
import { UpdateSesionAcademicaDto } from './dto/update-sesion-academica.dto';

@Injectable()
export class SesionesAcademicasService {
  constructor(
    @InjectRepository(SesionAcademica)
    private readonly sesionRepository: Repository<SesionAcademica>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Coordinador ─────────────────────────────────────────────

  async create(dto: CreateSesionAcademicaDto) {
    const { id_curso_modalidad, ...rest } = dto;
    const sesion = this.sesionRepository.create({
      ...rest,
      modalidad: rest.modalidad_sesion, // Mapeo si el campo en entidad es 'modalidad'
      cursoModalidad: { id: id_curso_modalidad },
    });
    return this.sesionRepository.save(sesion);
  }

  async findByModalidad(modalidadId: number) {
    return this.sesionRepository.find({
      where: { cursoModalidad: { id: modalidadId } },
      order: { fecha: 'ASC', hora_inicio: 'ASC' },
      relations: ['asistencias'],
    });
  }

  async findOne(id: number) {
    const sesion = await this.sesionRepository.findOne({
      where: { id },
      relations: ['cursoModalidad', 'asistencias'],
    });
    if (!sesion) throw new NotFoundException(`Sesión ${id} no encontrada`);
    return sesion;
  }

  async update(id: number, dto: UpdateSesionAcademicaDto) {
    await this.findOne(id);
    const { id_curso_modalidad, ...rest } = dto;
    const payload: any = { ...rest };
    if (rest.modalidad_sesion) payload.modalidad = rest.modalidad_sesion;
    if (id_curso_modalidad) {
      payload.cursoModalidad = { id: id_curso_modalidad };
    }
    await this.sesionRepository.update(id, payload);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.sesionRepository.delete(id);
    return { mensaje: `Sesión ${id} eliminada` };
  }

  findAll() {
    return this.sesionRepository.find({
      relations: ['cursoModalidad'],
    });
  }

  /**
   * Mientras la actividad está activa y dentro de su periodo, la asistencia
   * no depende de un horario previo: abre la sesión del día si aún no existe.
   */
  async abrirSesionDelDia(actividadId: number) {
    const acts = await this.dataSource.query(
      `SELECT id, estado, fecha_inicio, fecha_fin FROM actividades_academicas WHERE id = $1`,
      [actividadId],
    );
    if (!acts.length) throw new NotFoundException(`Actividad ${actividadId} no encontrada`);

    const act = acts[0];
    if (Number(act.estado) !== 1) {
      throw new BadRequestException('La asistencia solo está abierta mientras la actividad está activa.');
    }

    const hoy = new Date().toISOString().slice(0, 10);
    const inicio = act.fecha_inicio ? String(act.fecha_inicio).slice(0, 10) : null;
    const fin = act.fecha_fin ? String(act.fecha_fin).slice(0, 10) : null;
    if ((inicio && hoy < inicio) || (fin && hoy > fin)) {
      throw new BadRequestException('La actividad está fuera de su periodo. La asistencia queda abierta solo mientras esté vigente.');
    }

    let mods = await this.dataSource.query(
      `SELECT id, tipo FROM curso_modalidades WHERE id_actividad_academica = $1 ORDER BY id LIMIT 1`,
      [actividadId],
    );
    if (!mods.length) {
      mods = await this.dataSource.query(
        `INSERT INTO curso_modalidades (id_actividad_academica, tipo, min_nota, min_asistencia)
         VALUES ($1, 'Presencial', 51, 80) RETURNING id, tipo`,
        [actividadId],
      );
    }

    const modId = mods[0].id;
    const tipo = mods[0].tipo || 'Presencial';
    const existentes = await this.dataSource.query(
      `SELECT s.id, s.dia, s.fecha, s.hora_inicio, s.hora_fin
       FROM sesiones_academicas s
       WHERE s.id_curso_modalidad = $1 AND s.fecha = $2
       ORDER BY s.id LIMIT 1`,
      [modId, hoy],
    );
    if (existentes.length) {
      return { ...existentes[0], modalidad_nombre: tipo };
    }

    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dia = dias[new Date().getUTCDay()];
    const creada = await this.dataSource.query(
      `INSERT INTO sesiones_academicas (id_curso_modalidad, dia, fecha, hora_inicio, hora_fin, modalidad)
       VALUES ($1, $2, $3, '08:00', '18:00', $4)
       RETURNING id, dia, fecha, hora_inicio, hora_fin`,
      [modId, dia, hoy, tipo],
    );
    return { ...creada[0], modalidad_nombre: tipo };
  }

  // ══════════════════════════════════════════════════════════
  //  PIN DE ASISTENCIA
  // ══════════════════════════════════════════════════════════

  /**
   * Genera un PIN numérico de 6 dígitos para la sesión indicada.
   *
   * El PIN se almacena hasheado en el campo cod_verificacion usando bcrypt
   * (mismo mecanismo que las contraseñas), y también se devuelve en texto
   * plano para que el docente lo proyecte en clase.
   *
   * Cada llamada sobrescribe el PIN anterior, por lo que el coordinador
   * puede rotar el PIN si sospecha que fue filtrado.
   */
  async generarPin(sesionId: number): Promise<{
    pin: string;
    sesion_id: number;
    mensaje: string;
  }> {
    await this.findOne(sesionId); // valida existencia

    // Genera PIN aleatorio de 6 dígitos: 000000 – 999999
    const pin = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');

    // Hashea con bcrypt (costo 10, mismo que contraseñas)
    const pinHash = await bcrypt.hash(pin, 10);

    // Persiste el hash en cod_verificacion
    await this.sesionRepository.update(sesionId, {
      cod_verificacion: pinHash,
    });

    return {
      pin,
      sesion_id: sesionId,
      mensaje: 'PIN generado. Muéstralo en clase para el registro de asistencia.',
    };
  }

  /**
   * Valida el PIN ingresado comparándolo contra el hash almacenado.
   *
   * No expone el hash ni el PIN original.
   * Retorna { valido: true } o lanza BadRequestException.
   */
  async verificarPin(
    sesionId: number,
    pin: string,
  ): Promise<{ valido: boolean; sesion_id: number }> {
    const sesion = await this.findOne(sesionId);

    if (!sesion.cod_verificacion) {
      throw new BadRequestException(
        `La sesión ${sesionId} no tiene un PIN generado aún.`,
      );
    }

    if (!pin || pin.trim() === '') {
      throw new BadRequestException('El PIN no puede estar vacío.');
    }

    const valido = await bcrypt.compare(pin.trim(), sesion.cod_verificacion);

    if (!valido) {
      throw new BadRequestException('PIN incorrecto.');
    }

    return { valido: true, sesion_id: sesionId };
  }

  /**
   * Devuelve las sesiones de hoy (o de una modalidad específica) que ya
   * tienen un PIN generado (cod_verificacion NOT NULL).
   * Usado por el formulario público de registro de asistencia por PIN.
   */
  async findActivas(modalidadId?: number) {
    const hoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const qb = this.sesionRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.cursoModalidad', 'cm')
      .leftJoinAndSelect('cm.actividadAcademica', 'act')
      .where('s.fecha = :hoy', { hoy })
      .andWhere('s.cod_verificacion IS NOT NULL');

    if (modalidadId) {
      qb.andWhere('cm.id = :modalidadId', { modalidadId });
    }

    return qb.orderBy('s.hora_inicio', 'ASC').getMany();
  }
}
