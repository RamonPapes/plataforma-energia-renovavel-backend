import { createHash, randomBytes } from "crypto";
import { hash, truncates } from "bcryptjs";
import { AppError } from "../errors/AppError";

const SALT_ROUNDS = 10;
const SENHA_MINIMA = 6;

export function gerarHashSenha(senha: string) {
    return hash(senha, SALT_ROUNDS);
}

export function validarSenha(senha: unknown, campo = "A senha") {
    if (typeof senha !== "string" || senha.length < SENHA_MINIMA) {
        throw new AppError(`${campo} deve ter no mínimo ${SENHA_MINIMA} caracteres.`);
    }
    // o bcrypt ignora o que passa de 72 bytes (UTF-8), então senhas maiores seriam cortadas sem aviso
    if (truncates(senha)) {
        throw new AppError(`${campo} é muito longa.`);
    }
    return senha;
}

// Código aleatório de uso único para redefinir a senha
export function gerarTokenRedefinicao() {
    return randomBytes(32).toString("hex");
}

// Só o hash do código vai para o banco: quem ler a tabela não consegue usá-lo
export function hashTokenRedefinicao(token: string) {
    return createHash("sha256").update(token).digest("hex");
}
