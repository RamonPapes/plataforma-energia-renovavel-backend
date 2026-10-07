import { AppError } from "../errors/AppError";

const LIMIT_PADRAO = 50;
const LIMIT_MAXIMO_PADRAO = 100;

export function parseInteiroPositivo(valor: unknown, nome: string) {
    const numero = Number(valor);

    if (!Number.isInteger(numero) || numero < 1) {
        throw new AppError(`O parâmetro ${nome} deve ser um número inteiro positivo.`);
    }

    return numero;
}

// Lê ?page e ?limit da query string, aplicando os valores padrão quando não forem informados
export function parsePaginacao(query: { page?: unknown; limit?: unknown }, limiteMaximo = LIMIT_MAXIMO_PADRAO) {
    const page = query.page === undefined ? 1 : parseInteiroPositivo(query.page, "page");
    const limit = query.limit === undefined ? LIMIT_PADRAO : parseInteiroPositivo(query.limit, "limit");

    if (limit > limiteMaximo) {
        throw new AppError(`O parâmetro limit deve ser no máximo ${limiteMaximo}.`);
    }

    return { page, limit };
}
