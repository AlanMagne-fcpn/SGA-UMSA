import { CertificadosService } from './certificados.service';
import { InfoCertificado } from '../info-certificados/entities/info-certificado.entity';
import { Certificado } from './entities/certificado.entity';
jest.mock('uuid', () => ({ v4: () => 'test-certificado' }));

describe('Certificación con evaluaciones del aula', () => {
  const resumen = { total: 4, completadas: 4, pendientes: 0, evaluaciones: 3, evaluadas: 3, promedio: '72' };
  let runner: any;
  let manager: any;
  let service: CertificadosService;
  beforeEach(() => {
    manager = {
      findOne: jest.fn(async (entity: any) => {
        if (entity === InfoCertificado) return { id: 10, tipo: 4 };
        if (entity === 'ActividadAcademica') return { evento: { id: 7 }, modalidades: [{ tipo: 'Virtual', min_nota: 70, min_asistencia: 80 }] };
        if (entity === 'Inscripcion') return { id: 3, nota_principal: 99, modalidades: [] };
      }),
      find: jest.fn(async () => [{ id: 20, es_excelencia: 1 }, { id: 21, es_excelencia: 0 }]),
      query: jest.fn(async () => [resumen]),
      create: jest.fn((entity, input) => ({ ...input })), save: jest.fn(async input => ({ ...input, id: 90 })),
    };
    runner = { manager, connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn() };
    service = new CertificadosService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, { createQueryRunner: () => runner } as any);
  });
  const dto = { id_info_certificado: 10, id_actividad_academica: 7, personasIds: [9] } as any;
  it('elige aprobación con la nota ponderada y suficiente avance', async () => {
    await service.emitirLote(dto);
    expect(manager.create).toHaveBeenCalledWith(Certificado, expect.objectContaining({ infoCertificado: { id: 20 } }));
  });
  it('elige participación por nota baja aunque la inscripción tenga una nota anterior alta', async () => {
    manager.query.mockResolvedValue([{ ...resumen, promedio: 40 }]);
    await service.emitirLote(dto);
    expect(manager.create).toHaveBeenCalledWith(Certificado, expect.objectContaining({ infoCertificado: { id: 21 } }));
  });
  it('impide emitir mientras haya prácticas pendientes', async () => {
    manager.query.mockResolvedValue([{ ...resumen, pendientes: 1 }]);
    await expect(service.emitirLote(dto)).rejects.toThrow('pendientes');
    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('no emite participación sin asistencia mínima', async () => {
    manager.query.mockResolvedValue([{ ...resumen, total: 4, completadas: 3, promedio: 40 }]);
    await expect(service.emitirLote(dto)).rejects.toThrow('asistencia mínima');
    expect(manager.save).not.toHaveBeenCalled();
  });
});
