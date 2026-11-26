import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisponibleDesdeYClaveItem1792400000000 implements MigrationInterface {
  name = 'AddDisponibleDesdeYClaveItem1792400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "curso_lecciones" ADD COLUMN IF NOT EXISTS "disponible_desde" date`);
    await queryRunner.query(`ALTER TABLE "curso_lecciones" ADD COLUMN IF NOT EXISTS "clave_item" character varying(40)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "curso_lecciones" DROP COLUMN IF EXISTS "clave_item"`);
    await queryRunner.query(`ALTER TABLE "curso_lecciones" DROP COLUMN IF EXISTS "disponible_desde"`);
  }
}
