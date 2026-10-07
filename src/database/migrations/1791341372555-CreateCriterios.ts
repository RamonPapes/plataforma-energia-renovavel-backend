import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateCriterios1791341372555 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "criterios",
                columns: [
                    { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                    { name: "nome", type: "varchar", length: "150", isNullable: false, isUnique: true },
                    { name: "descricao", type: "text", isNullable: true },
                    { name: "tipo", type: "enum", enum: ["BENEFICIO", "CUSTO"], isNullable: false },
                    { name: "peso", type: "decimal", precision: 5, scale: 4, default: 0, isNullable: false },
                    { name: "unidade", type: "varchar", length: "50", isNullable: true },
                    { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
                ],
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("criterios");
    }

}
