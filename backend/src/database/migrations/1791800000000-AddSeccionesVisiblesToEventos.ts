import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSeccionesVisiblesToEventos1791800000000 implements MigrationInterface {
  name = 'AddSeccionesVisiblesToEventos1791800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "eventos" ADD COLUMN IF NOT EXISTS "secciones_visibles" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "eventos" DROP COLUMN IF EXISTS "secciones_visibles"`);
  }
}
