import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCurriculumToPersonas1792500000000 implements MigrationInterface {
  name = 'AddCurriculumToPersonas1792500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "personas" ADD COLUMN IF NOT EXISTS "curriculum" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "personas" DROP COLUMN IF EXISTS "curriculum"`);
  }
}
