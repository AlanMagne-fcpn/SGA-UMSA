import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlazoYTiempoAula1792200000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE curso_lecciones DROP CONSTRAINT IF EXISTS curso_lecciones_tipo_check');
    await runner.query("ALTER TABLE curso_lecciones ADD CONSTRAINT curso_lecciones_tipo_check CHECK (tipo IN ('video','examen','material','practica','laboratorio'))");
    await runner.query('ALTER TABLE curso_lecciones ADD COLUMN IF NOT EXISTS plazo date');
    await runner.query('ALTER TABLE curso_lecciones ADD COLUMN IF NOT EXISTS tiempo_limite_minutos integer');
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE curso_lecciones DROP COLUMN IF EXISTS tiempo_limite_minutos');
    await runner.query('ALTER TABLE curso_lecciones DROP COLUMN IF EXISTS plazo');
    await runner.query('ALTER TABLE curso_lecciones DROP CONSTRAINT IF EXISTS curso_lecciones_tipo_check');
    await runner.query("ALTER TABLE curso_lecciones ADD CONSTRAINT curso_lecciones_tipo_check CHECK (tipo IN ('video','examen','material','practica'))");
  }
}
