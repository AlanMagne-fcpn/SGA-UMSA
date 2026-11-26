import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInscripcionSinCuenta1792300000000 implements MigrationInterface {
  name = 'AddInscripcionSinCuenta1792300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inscripciones" ALTER COLUMN "id_usuario" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "inscripciones" ADD COLUMN IF NOT EXISTS "sin_cuenta" smallint NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "inscripciones" ADD COLUMN IF NOT EXISTS "nombre_externo" character varying(200)`);
    await queryRunner.query(`ALTER TABLE "inscripciones" ADD COLUMN IF NOT EXISTS "email_externo" character varying(150)`);
    await queryRunner.query(`ALTER TABLE "inscripciones" ADD COLUMN IF NOT EXISTS "documento_externo" character varying(50)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inscripciones" DROP COLUMN IF EXISTS "documento_externo"`);
    await queryRunner.query(`ALTER TABLE "inscripciones" DROP COLUMN IF EXISTS "email_externo"`);
    await queryRunner.query(`ALTER TABLE "inscripciones" DROP COLUMN IF EXISTS "nombre_externo"`);
    await queryRunner.query(`ALTER TABLE "inscripciones" DROP COLUMN IF EXISTS "sin_cuenta"`);
  }
}
