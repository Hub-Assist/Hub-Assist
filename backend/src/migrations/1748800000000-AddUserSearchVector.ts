import { MigrationInterface, QueryRunner, TableColumn, Index } from 'typeorm';

export class AddUserSearchVector1748800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add tsvector column for full-text search
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'searchVector',
        type: 'tsvector',
        isNullable: true,
        generatedType: 'STORED',
        asExpression: `to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(email, ''))`,
      }),
    );

    // Create GIN index for fast full-text search
    await queryRunner.createIndex(
      'users',
      new Index('idx_users_search_vector', ['searchVector'], {
        synchronize: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('users', 'idx_users_search_vector');
    await queryRunner.dropColumn('users', 'searchVector');
  }
}
