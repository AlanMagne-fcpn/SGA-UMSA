import { ActividadesAcademicasService } from './actividades-academicas.service';

describe('Ficha pública del curso', () => {
  const usuario = {
    id: 9,
    email: 'ponente@example.test',
    password: 'secreto',
    persona: { nombres: 'Ana', primer_apellido: 'Pérez' },
  };
  const actividad = {
    id: 3, nombre: 'Curso de prueba', descripcion: 'Contenido', tipo: 'Curso', estado: 1,
    modalidades: [{ id: 2, tipo: 'Virtual', min_nota: 70, min_asistencia: 0 }],
    evento: { id: 1, nombre: 'Congreso', estado: 1, descripcion: '', gestion: '2026' },
    imparticiones: [{ usuario }],
    inscripciones: [{ usuario: { password: 'privado' } }],
  };
  const repository = { findOne: jest.fn() };
  const dataSource = { query: jest.fn((sql: string) => Promise.resolve(sql.includes('COUNT(*)') ? [{ total: 2 }] : [])) };
  const service = new ActividadesAcademicasService(repository as any, dataSource as any, {} as any);

  beforeEach(() => {
    repository.findOne.mockReset();
    repository.findOne.mockResolvedValue(actividad);
    dataSource.query.mockClear();
  });

  it('publica información académica sin inscripciones ni cuentas no autorizadas', async () => {
    const resultado = await service.findPublicOne(3);
    expect(resultado).toMatchObject({ nombre: 'Curso de prueba', inscritos: 2, docentes: [], modalidades: [{ tipo: 'Virtual', min_nota: 70 }] });
    expect(resultado).not.toHaveProperty('inscripciones');
    expect(resultado.evento).not.toHaveProperty('descripcion');
    expect(JSON.stringify(resultado)).not.toContain('secreto');
    expect(JSON.stringify(resultado)).not.toContain('ponente@example.test');
  });

  it('muestra solo el nombre de un ponente publicado expresamente', async () => {
    repository.findOne.mockResolvedValue({ ...actividad, evento: { ...actividad.evento, descripcion: '[PONENTES_METADATA]:Ana Pérez' } });
    const resultado = await service.findPublicOne(3);
    expect(resultado.docentes).toEqual([{ id: 9, nombre: 'Ana Pérez' }]);
    expect(JSON.stringify(resultado)).not.toContain('ponente@example.test');
  });

  it('excluye cursos inhabilitados', async () => {
    repository.findOne.mockResolvedValue({ ...actividad, estado: -1 });
    await expect(service.findPublicOne(3)).rejects.toThrow('no disponible');
  });
});

describe('Aula virtual y evaluación', () => {
  const query = jest.fn();
  const service = new ActividadesAcademicasService({} as any, { query } as any, {} as any);
  beforeEach(() => query.mockReset());

  it('no envía las respuestas correctas al estudiante inscrito', async () => {
    query.mockResolvedValueOnce([{ id: 4 }]).mockResolvedValueOnce([{
      id: 8, tipo: 'examen', titulo: 'Evaluación', preguntas: [{ enunciado: 'Pregunta', opciones: ['A', 'B'], correcta: 1 }],
    }]);
    const aula = await service.listarAula(2, { id: 5 });
    expect(aula[0].preguntas).toEqual([{ enunciado: 'Pregunta', opciones: ['A', 'B'] }]);
    expect(JSON.stringify(aula)).not.toContain('correcta');
  });

  it('exige inscripción y guarda la nota acumulada calculada por el servidor', async () => {
    query.mockResolvedValueOnce([{ id: 4 }])
      .mockResolvedValueOnce([{ id: 8, tipo: 'examen', preguntas: [{ enunciado: 'Pregunta', opciones: ['A', 'B'], correcta: 1 }] }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 1, completadas: 1, promedio: '0.00' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ min_nota: 70 }]);
    const resultado = await service.completarLeccion(2, 8, [0], { id: 5 });
    expect(resultado).toMatchObject({ nota: 0, terminado: true, promedio: 0 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE inscripciones SET nota_principal'), [0, 4]);
    query.mockReset().mockResolvedValueOnce([]);
    await expect(service.listarAula(2, { id: 5 })).rejects.toThrow('Debes estar inscrito');
  });

  it('no permite completar una práctica sin entrega y calificación', async () => {
    query.mockResolvedValueOnce([{ id: 4 }]).mockResolvedValueOnce([{ id: 8, tipo: 'practica', preguntas: [] }]);
    await expect(service.completarLeccion(2, 8, [], { id: 5 })).rejects.toThrow('requiere una entrega');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('rechaza índices de respuesta fuera de las opciones', async () => {
    query.mockResolvedValueOnce([{ id: 4 }]).mockResolvedValueOnce([{ id: 8, tipo: 'examen', preguntas: [{ opciones: ['A','B'], correcta: 1 }] }]);
    await expect(service.completarLeccion(2, 8, [-1], { id: 5 })).rejects.toThrow('Responde todas');
  });

  it('no admite autoasignarse una nota de práctica ni reabrir una entrega calificada', async () => {
    query.mockResolvedValueOnce([{ id: 4 }]).mockResolvedValueOnce([{ id: 8 }]).mockResolvedValueOnce([]);
    await expect(service.entregarPractica(2, 8, 'Mi respuesta', undefined, { id: 5 })).rejects.toThrow('ya fue calificada');
    const params = query.mock.calls[2][1];
    expect(JSON.parse(params[2])).toEqual({ texto: 'Mi respuesta', archivo: null });
    expect(query.mock.calls[2][0]).toContain('WHERE curso_progreso.nota IS NULL');
  });

  it('valida la nota de la práctica en el servidor', async () => {
    await expect(service.calificarPractica(2, 8, { nota: -5 }, { id: 1, roles: ['Super Usuario'] })).rejects.toThrow('entre 0 y 100');
    expect(query).not.toHaveBeenCalled();
  });

  it('solo admite valoraciones de participantes que completaron el curso', async () => {
    query.mockResolvedValueOnce([{ estado: 1 }]).mockResolvedValueOnce([{ total: 2, completadas: 1 }]);
    await expect(service.valorarCurso(2, { puntuacion: 5 }, { id: 5 })).rejects.toThrow('cuando lo completes');
    query.mockReset().mockResolvedValueOnce([{ estado: 1 }]).mockResolvedValueOnce([{ total: 2, completadas: 2 }]).mockResolvedValueOnce([{ id: 1, puntuacion: 5 }]);
    expect(await service.valorarCurso(2, { puntuacion: 5 }, { id: 5 })).toMatchObject({ puntuacion: 5 });
  });
});

describe('Permisos de contenidos por tipo de actividad', () => {
  const query = jest.fn();
  const repository = { findOne: jest.fn() };
  const service = new ActividadesAcademicasService(repository as any, { query } as any, {} as any);
  const ponente = { id: 9, roles: ['Super Usuario'] };
  const pregunta = { enunciado: 'Pregunta', opciones: ['A','B'], correcta: 1 };
  beforeEach(() => { query.mockReset(); repository.findOne.mockReset(); });
  it.each(['Simposio', 'Conferencia', 'Diplomado', 'Taller'])('rechaza exámenes en %s aunque se envíe la petición manualmente', async tipo => {
    repository.findOne.mockResolvedValue({ tipo, requisitos: { aula: { examen: true } } });
    await expect(service.guardarLeccion(7, { tipo: 'examen', titulo: 'Examen', preguntas: [pregunta] }, ponente)).rejects.toThrow('solo están disponibles');
    expect(query).not.toHaveBeenCalled();
  });
  it('no permite ocultar un cuestionario dentro de un video de simposio', async () => {
    repository.findOne.mockResolvedValue({ tipo: 'Simposio', requisitos: { aula: { video: true, examen: true } } });
    await expect(service.guardarLeccion(7, { tipo: 'video', titulo: 'Clase', video_url: 'https://example.test/video.mp4', preguntas: [pregunta] }, ponente)).rejects.toThrow('solo están disponibles');
  });
  it('exige que la organización habilite cada tipo de contenido', async () => {
    repository.findOne.mockResolvedValue({ tipo: 'Curso', requisitos: { aula: { examen: false } } });
    await expect(service.guardarLeccion(7, { tipo: 'examen', titulo: 'Examen', preguntas: [pregunta] }, ponente)).rejects.toThrow('no ha habilitado');
  });
  it('guarda una evaluación cuando es Curso y tiene permiso', async () => {
    repository.findOne.mockResolvedValue({ tipo: 'Curso', requisitos: { aula: { examen: true } } });
    query.mockResolvedValue([{ id: 8 }]);
    expect(await service.guardarLeccion(7, { tipo: 'examen', titulo: 'Examen', preguntas: [pregunta] }, ponente)).toEqual({ id: 8 });
  });
});

describe('Acceso al aula por rol y asignación', () => {
  const query = jest.fn();
  const repository = { findOne: jest.fn(async () => ({ id: 7, evento: { id: 3 } })) };
  const service = new ActividadesAcademicasService(repository as any, { query } as any, {} as any);
  beforeEach(() => query.mockReset());
  it('permite al ponente asignado y rechaza a un ponente ajeno', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ existe: 1 }]);
    await expect(service.verificarPermisosEdicion(7, { id: 9, roles: ['Ponente'] })).resolves.toBeUndefined();
    query.mockReset().mockResolvedValue([]);
    await expect(service.verificarPermisosEdicion(7, { id: 10, roles: ['Ponente'] })).rejects.toThrow('No tienes permisos');
  });
  it('permite al coordinador de su evento', async () => {
    query.mockResolvedValueOnce([{ alcance_eventos: 'restringido' }]).mockResolvedValueOnce([{ existe: 1 }]);
    await expect(service.verificarPermisosEdicion(7, { id: 9, roles: ['Coordinador'] })).resolves.toBeUndefined();
  });
  it('respeta el alcance libre del coordinador aunque no tenga una asignación individual', async () => {
    query.mockResolvedValueOnce([{ alcance_eventos: 'libre' }]);
    await expect(service.verificarPermisosEdicion(7, { id: 9, roles: ['Coordinador'] })).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('rechaza al coordinador restringido de otro evento', async () => {
    query.mockResolvedValueOnce([{ alcance_eventos: 'restringido' }]).mockResolvedValue([]);
    await expect(service.verificarPermisosEdicion(7, { id: 9, roles: ['Coordinador'] })).rejects.toThrow('No tienes permisos');
  });
});
