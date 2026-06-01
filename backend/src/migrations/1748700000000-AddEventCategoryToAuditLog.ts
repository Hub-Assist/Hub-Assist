import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddEventCategoryToAuditLog1748700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'audit_logs',
      new TableColumn({
        name: 'eventCategory',
        type: 'enum',
        enum: ['BOOKING', 'USER', 'WORKSPACE', 'AUTH', 'SYSTEM'],
        isNullable: true,
      }),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'idx_audit_logs_event_category_created_at',
        columnNames: ['eventCategory', 'createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('audit_logs', 'idx_audit_logs_event_category_created_at');
    await queryRunner.dropColumn('audit_logs', 'eventCategory');
  }
}
