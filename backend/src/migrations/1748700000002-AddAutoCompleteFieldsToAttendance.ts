import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAutoCompleteFieldsToAttendance1748700000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'attendance',
      new TableColumn({
        name: 'autoCompleted',
        type: 'boolean',
        default: false,
      }),
    );

    await queryRunner.addColumn(
      'attendance',
      new TableColumn({
        name: 'autoCompletedReason',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('attendance', 'autoCompletedReason');
    await queryRunner.dropColumn('attendance', 'autoCompleted');
  }
}
