import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendAulaEvaluaciones1792100000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE curso_lecciones DROP CONSTRAINT IF EXISTS curso_lecciones_tipo_check');
    await runner.query("ALTER TABLE curso_lecciones ADD CONSTRAINT curso_lecciones_tipo_check CHECK (tipo IN ('video','examen','material','practica'))");
    await runner.query("ALTER TABLE curso_lecciones ADD COLUMN recursos jsonb NOT NULL DEFAULT '[]', ADD COLUMN peso numeric(8,2) NOT NULL DEFAULT 1 CHECK (peso >= 0 AND peso <= 100)");
    await runner.query("ALTER TABLE curso_progreso ADD COLUMN entrega jsonb, ADD COLUMN retroalimentacion text, ADD COLUMN calificado_por integer REFERENCES usuarios(id), ADD COLUMN calificado_en timestamptz");
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE curso_progreso DROP COLUMN calificado_en, DROP COLUMN calificado_por, DROP COLUMN retroalimentacion, DROP COLUMN entrega');
    await runner.query('ALTER TABLE curso_lecciones DROP COLUMN peso, DROP COLUMN recursos');
    // No se eliminan prácticas ni materiales al revertir la migración.
  }
}
