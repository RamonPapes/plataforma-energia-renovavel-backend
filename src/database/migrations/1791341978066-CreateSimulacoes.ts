import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateSimulacoes1791341978066 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "simulacoes",
                columns: [
                    { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                    { name: "usuario_id", type: "int", isNullable: false },
                    { name: "ano_referencia", type: "int", isNullable: false },
                    { name: "parametros", type: "json", isNullable: false },
                    { name: "status", type: "varchar", length: "20", default: "'CONCLUIDA'" },
                    { name: "data_execucao", type: "timestamp", default: "CURRENT_TIMESTAMP" },
                ],
                // RESTRICT: usuário com simulações não pode ser apagado (preserva o histórico)
                foreignKeys: [
                    { columnNames: ["usuario_id"], referencedTableName: "usuarios", referencedColumnNames: ["id"], onDelete: "RESTRICT" },
                ],
            })
        );

        await queryRunner.createTable(
            new Table({
                name: "resultados_ranking",
                columns: [
                    { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                    { name: "simulacao_id", type: "int", isNullable: false },
                    { name: "municipio_id", type: "int", isNullable: false },
                    { name: "coeficiente_ci", type: "decimal", precision: 10, scale: 8, isNullable: false },
                    { name: "distancia_positiva", type: "decimal", precision: 10, scale: 8, isNullable: false },
                    { name: "distancia_negativa", type: "decimal", precision: 10, scale: 8, isNullable: false },
                    { name: "posicao", type: "int", isNullable: false },
                ],
                uniques: [
                    { name: "UQ_resultado_simulacao_municipio", columnNames: ["simulacao_id", "municipio_id"] },
                ],
                // CASCADE: os resultados pertencem à simulação; RESTRICT: município presente em ranking não pode ser apagado
                foreignKeys: [
                    { columnNames: ["simulacao_id"], referencedTableName: "simulacoes", referencedColumnNames: ["id"], onDelete: "CASCADE" },
                    { columnNames: ["municipio_id"], referencedTableName: "municipios", referencedColumnNames: ["id"], onDelete: "RESTRICT" },
                ],
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("resultados_ranking");
        await queryRunner.dropTable("simulacoes");
    }

}
