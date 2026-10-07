import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateMunicipios1791244914483 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "municipios",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "nome",
            type: "varchar",
            length: "200",
            isNullable: false,
          },
          {
            name: "uf",
            type: "char",
            length: "2",
            isNullable: false,
          },
          {
            name: "populacao",
            type: "int",
            isNullable: true,
          },
          {
            name: "idh",
            type: "decimal",
            precision: 4,
            scale: 3,
            isNullable: true,
          },
          {
            name: "coordenadas",
            type: "point", // No MySQL usamos o tipo nativo "point"
            isNullable: true,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP", // No MySQL é melhor usar CURRENT_TIMESTAMP do que NOW()
          },
        ],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("municipios");
  }
}