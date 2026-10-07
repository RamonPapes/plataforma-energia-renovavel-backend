import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddRedefinicaoSenhaUsuarios1791340933691 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns("usuarios", [
            // hash SHA-256 do código de redefinição; o código em si nunca é gravado
            new TableColumn({ name: "reset_senha_token", type: "char", length: "64", isNullable: true, isUnique: true }),
            new TableColumn({ name: "reset_senha_expira_em", type: "datetime", isNullable: true }),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("usuarios", "reset_senha_expira_em");
        await queryRunner.dropColumn("usuarios", "reset_senha_token");
    }

}
