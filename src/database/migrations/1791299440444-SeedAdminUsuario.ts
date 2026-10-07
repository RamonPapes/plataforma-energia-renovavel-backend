import { MigrationInterface, QueryRunner } from "typeorm";
import { hash } from "bcryptjs";

export class SeedAdminUsuario1791299440444 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const nome = process.env.ADMIN_NOME ?? "Administrador";
        const email = process.env.ADMIN_EMAIL;
        const senha = process.env.ADMIN_SENHA;

        // credenciais vêm do .env para não ficarem versionadas no código
        if (!email || !senha) {
            throw new Error("Defina ADMIN_EMAIL e ADMIN_SENHA no .env antes de rodar a migration de seed.");
        }

        const senhaHash = await hash(senha, 10);

        await queryRunner.query(
            "INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)",
            [nome, email, senhaHash, "ADMINISTRADOR"]
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const email = process.env.ADMIN_EMAIL;

        if (!email) {
            throw new Error("Defina ADMIN_EMAIL no .env para reverter a migration de seed.");
        }

        await queryRunner.query("DELETE FROM usuarios WHERE email = ?", [email]);
    }

}
