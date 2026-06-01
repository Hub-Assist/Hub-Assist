import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateDailyUtilizationSnapshots1748700000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'daily_utilization_snapshots',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'date',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'workspaceId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'workspaceType',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'bookedHours',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'availableHours',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'occupancyRate',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'daily_utilization_snapshots',
      new TableIndex({
        name: 'idx_utilization_date_workspace',
        columnNames: ['date', 'workspaceId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'daily_utilization_snapshots',
      new TableIndex({
        name: 'idx_utilization_date',
        columnNames: ['date'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('daily_utilization_snapshots', 'idx_utilization_date');
    await queryRunner.dropIndex('daily_utilization_snapshots', 'idx_utilization_date_workspace');
    await queryRunner.dropTable('daily_utilization_snapshots');
  }
}
