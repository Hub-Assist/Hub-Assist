import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTotpToUser1685000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'totpEnabled',
        type: 'boolean',
        default: false,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'totpSecret',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'backupCodes',
        type: 'text',
        isNullable: true,
        comment: 'Comma-separated backup codes for account recovery',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'backupCodes');
    await queryRunner.dropColumn('users', 'totpSecret');
    await queryRunner.dropColumn('users', 'totpEnabled');
  }
}
