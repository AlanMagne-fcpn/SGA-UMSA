import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCupoToActividades1791700000000 implements MigrationInterface {
  name = 'AddCupoToActividades1791700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "actividades_academicas" ADD COLUMN IF NOT EXISTS "cupo" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "actividades_academicas" DROP COLUMN IF EXISTS "cupo"`);
  }
}
