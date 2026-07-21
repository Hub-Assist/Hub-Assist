import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCapacityTypeToWorkspace1748700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'workspaces',
      new TableColumn({
        name: 'capacityType',
        type: 'enum',
        enum: ['Shared', 'Exclusive'],
        default: "'Shared'",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('workspaces', 'capacityType');
  }
}
