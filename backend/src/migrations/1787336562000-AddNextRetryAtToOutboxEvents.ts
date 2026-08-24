import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddNextRetryAtToOutboxEvents1787336562000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'outbox_events',
      new TableColumn({
        name: 'nextRetryAt',
        type: 'timestamp',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('outbox_events', 'nextRetryAt');
  }
}
