import { ImparticionesService } from './imparticiones.service';

describe('Eventos asignados al ponente', () => {
  const usuarioId = 42;
  const evento = { id: 1, nombre: 'Congreso' };
  const actividad = { id: 10, nombre: 'Taller', estado: 1, evento };
  let imparticiones: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    manager: { query: jest.Mock };
  };
  let coordinaciones: { find: jest.Mock };
  let actividades: { find: jest.Mock };
  let service: ImparticionesService;

  beforeEach(() => {
    imparticiones = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => row),
      manager: { query: jest.fn().mockResolvedValue([]) },
    };
    coordinaciones = { find: jest.fn().mockResolvedValue([]) };
    actividades = { find: jest.fn().mockResolvedValue([]) };
    service = new ImparticionesService(
      imparticiones as any,
      {} as any,
      coordinaciones as any,
      actividades as any,
    );
  });

  it('crea imparticiones cuando el ponente fue asignado al evento como responsable', async () => {
    imparticiones.manager.query.mockResolvedValue([1]);
    coordinaciones.find.mockResolvedValue([{ evento }]);
    actividades.find.mockResolvedValue([actividad, { id: 99, estado: -1, evento }]);
    imparticiones.find.mockResolvedValue([{ evento, actividadAcademica: actividad }]);

    expect(await service.findMisEventos(usuarioId)).toEqual([{ evento, actividades: [actividad] }]);
    expect(imparticiones.save).toHaveBeenCalledTimes(1);
    expect(imparticiones.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario: { id: usuarioId },
        actividadAcademica: { id: actividad.id },
        evento: { id: evento.id },
      }),
    );
  });

  it('no concede actividades al coordinador que no es ponente', async () => {
    coordinaciones.find.mockResolvedValue([{ evento }]);
    expect(await service.findMisEventos(usuarioId)).toEqual([{ evento, actividades: [] }]);
    expect(actividades.find).not.toHaveBeenCalled();
  });

  it('combina asignaciones sin repetir eventos ni actividades y omite inhabilitadas', async () => {
    coordinaciones.find.mockResolvedValue([{ evento }]);
    imparticiones.find.mockResolvedValue([
      { evento, actividadAcademica: actividad },
      { evento, actividadAcademica: actividad },
      { evento, actividadAcademica: { ...actividad, id: 11, estado: -1 } },
    ]);
    expect(await service.findMisEventos(usuarioId)).toEqual([{ evento, actividades: [actividad] }]);
  });

  it('recupera el evento de la actividad cuando la imparticion no tiene evento', async () => {
    imparticiones.find.mockResolvedValue([{ actividadAcademica: actividad }]);
    expect(await service.findMisEventos(usuarioId)).toEqual([{ evento, actividades: [actividad] }]);
  });
});
