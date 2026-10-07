import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateUsuarios1791296501072 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "usuarios",
                columns: [
                    { name: "id", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                    { name: "nome", type: "varchar", length: "150", isNullable: false },
                    { name: "email", type: "varchar", length: "150", isNullable: false, isUnique: true },
                    { name: "senha", type: "varchar", length: "255", isNullable: false },
                    {
                        name: "perfil",
                        type: "enum",
                        enum: ["ADMINISTRADOR", "PESQUISADOR", "GESTOR_PUBLICO"],
                        default: "'PESQUISADOR'",
                    },
                    { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
                ],
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("usuarios");
    }

}
