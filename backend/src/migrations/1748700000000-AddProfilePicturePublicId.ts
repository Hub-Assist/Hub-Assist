import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProfilePicturePublicId1748700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'profilePicturePublicId',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'profilePicturePublicId');
  }
}
