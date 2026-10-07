import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateMatrizDecisao1791341978065 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "matriz_decisao",
                columns: [
                    { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                    { name: "municipio_id", type: "int", isNullable: false },
                    { name: "criterio_id", type: "int", isNullable: false },
                    { name: "valor", type: "decimal", precision: 15, scale: 4, isNullable: false },
                    { name: "ano_referencia", type: "int", isNullable: false },
                    { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
                ],
                uniques: [
                    { name: "UQ_matriz_municipio_criterio_ano", columnNames: ["municipio_id", "criterio_id", "ano_referencia"] },
                ],
                indices: [
                    { name: "IDX_matriz_ano", columnNames: ["ano_referencia"] },
                ],
                // RESTRICT: município ou critério com valores na matriz não pode ser apagado
                foreignKeys: [
                    { columnNames: ["municipio_id"], referencedTableName: "municipios", referencedColumnNames: ["id"], onDelete: "RESTRICT" },
                    { columnNames: ["criterio_id"], referencedTableName: "criterios", referencedColumnNames: ["id"], onDelete: "RESTRICT" },
                ],
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("matriz_decisao");
    }

}
