import "./env";
import { execSync } from "child_process";
import mysql from "mysql2/promise";

// Roda uma vez antes de todos os testes: cria o banco de teste (se não existir) e aplica as migrations
export default async function globalSetup() {
    const banco = process.env.DB_NAME as string;

    const conexao = await mysql.createConnection({
        host: process.env.DB_HOST ?? "localhost",
        port: Number(process.env.DB_PORT ?? 3306),
        user: process.env.DB_USER ?? "root",
        password: process.env.DB_PASSWORD,
    });
    await conexao.query(`CREATE DATABASE IF NOT EXISTS \`${banco}\``);
    await conexao.end();

    // mesmo comando usado em desenvolvimento; o DB_NAME do ambiente (banco _test) tem prioridade sobre o .env
    execSync("npm run migration:run", { env: process.env, stdio: "ignore" });
}
