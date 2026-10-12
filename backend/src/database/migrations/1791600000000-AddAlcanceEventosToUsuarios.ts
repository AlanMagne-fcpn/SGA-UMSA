import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAlcanceEventosToUsuarios1791600000000 implements MigrationInterface {
  name = 'AddAlcanceEventosToUsuarios1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "alcance_eventos" character varying(20) NOT NULL DEFAULT 'restringido'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "alcance_eventos"`);
  }
}
