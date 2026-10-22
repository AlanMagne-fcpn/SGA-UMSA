import { EventosService } from './eventos.service';

describe('Directorio publico de expositores', () => {
  const usuario = {
    id: 7, estado: 1, email: 'ponente@example.test', password: 'private',
    persona: { nombres: 'Ana', primer_apellido: 'Perez', firma_dig: 'firma.png' },
    afiliaciones: [{ institucion: 'Universidad', gradoAcademico: { abreviacion: 'Dr' } }],
  };
  const imparticion = { usuario, actividadAcademica: { id: 10, estado: 1 } };
  let repository: { findOne: jest.Mock };
  let service: EventosService;
  const evento = (descripcion = '') => ({ id: 1, descripcion, imparticiones: [imparticion] });

  beforeEach(() => {
    repository = { findOne: jest.fn() };
    service = new EventosService(repository as any, {} as any);
  });

  it('no publica cuentas solo porque estan asignadas a actividades', async () => {
    repository.findOne.mockResolvedValue(evento());
    expect(await service.getImparticiones(1)).toEqual([]);
  });

  it('publica solo seleccionados sin correos, credenciales ni firmas por defecto', async () => {
    repository.findOne.mockResolvedValue({
      ...evento('Texto\n[PONENTES_METADATA]:Dr. Ana Perez'),
      imparticiones: [imparticion, imparticion, { ...imparticion, usuario: { ...usuario, id: 8, persona: { nombres: 'Otro' } } }],
    });
    const result = await service.getImparticiones(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 7, nombres: 'Ana', foto: null });
    expect(result[0]).not.toHaveProperty('email');
    expect(result[0]).not.toHaveProperty('password');
    expect(result[0]).not.toHaveProperty('firma_dig');
  });

  it('incluye el correo solo cuando se habilita expresamente', async () => {
    repository.findOne.mockResolvedValue(evento('Texto\n[MOSTRAR_CORREOS]:true\n[PONENTES_METADATA]:Dr. Ana Perez'));
    expect((await service.getImparticiones(1))[0].email).toBe(usuario.email);
  });

  it('respeta la seccion oculta y excluye cuentas desactivadas o actividades inhabilitadas', async () => {
    const seleccionado = evento('\n[PONENTES_METADATA]:Dr. Ana Perez');
    repository.findOne.mockResolvedValue({ ...seleccionado, secciones_visibles: { directorio: false } });
    expect(await service.getImparticiones(1)).toEqual([]);
    repository.findOne.mockResolvedValue({ ...seleccionado, imparticiones: [{ ...imparticion, usuario: { ...usuario, estado: 0 } }] });
    expect(await service.getImparticiones(1)).toEqual([]);
    repository.findOne.mockResolvedValue({ ...seleccionado, imparticiones: [{ ...imparticion, actividadAcademica: { estado: -1 } }] });
    expect(await service.getImparticiones(1)).toEqual([]);
  });
});

describe('Usuarios administrativos del evento', () => {
  it('impide ver usuarios a un coordinador no asignado', async () => {
    const repository = { findOne: jest.fn() };
    const dataSource = { query: jest.fn().mockResolvedValue([]) };
    const service = new EventosService(repository as any, dataSource as any);

    await expect(service.getUsuariosEventoAdmin(9, { id: 4, roles: ['Coordinador'] }))
      .rejects.toThrow('No tienes permisos sobre este evento');
    expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('reúne estudiantes, ponentes y coordinadores sin duplicar personas ni exponer credenciales', async () => {
    const estudiante = { id: 1, email: 'ana@test.com', password: 'secreto', persona: { nombres: 'Ana', primer_apellido: 'Paz' } };
    const ponente = { id: 2, email: 'luis@test.com', password_ponente: 'secreto', persona: { nombres: 'Luis', primer_apellido: 'Rojas' } };
    const coordinador = { id: 3, email: 'marta@test.com', persona: { nombres: 'Marta', primer_apellido: 'Soto' }, usuariosRoles: [{ rol: { nombre_rol: 'Coordinador' } }] };
    const repository = { findOne: jest.fn().mockResolvedValue({
      id: 9,
      coordinaciones: [{ usuario: coordinador }],
      imparticiones: [{ usuario: ponente, actividadAcademica: { nombre: 'Seminario' } }],
      actividades: [{ nombre: 'Seminario', inscripciones: [{ usuario: estudiante }, { usuario: ponente }], imparticiones: [{ usuario: ponente }] }],
    }) };
    const service = new EventosService(repository as any, {} as any);
    const resultado = await service.getUsuariosEventoAdmin(9, { roles: ['Super Usuario'] });

    expect(resultado).toHaveLength(3);
    expect(resultado.find((persona) => persona.id === 2)).toMatchObject({ roles: ['Ponente', 'Estudiante'], actividades: ['Seminario'] });
    expect(resultado.find((persona) => persona.id === 3)?.roles).toEqual(['Coordinador']);
    expect(JSON.stringify(resultado)).not.toContain('secreto');
  });
});
