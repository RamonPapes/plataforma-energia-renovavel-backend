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

const ANO_MINIMO = 1900;
const ANO_MAXIMO = 2100;

export function parseAno(valor: unknown, nome = "ano") {
    const ano = Number(valor);

    if (!Number.isInteger(ano) || ano < ANO_MINIMO || ano > ANO_MAXIMO) {
        throw new AppError(`O ${nome} deve ser um número inteiro entre ${ANO_MINIMO} e ${ANO_MAXIMO}.`);
    }

    return ano;
}

// Aceita uma lista de ids como array (body) ou como texto separado por vírgula (?municipios=1,2,3)
export function parseListaIds(valor: unknown, nome: string) {
    if (valor === undefined) return undefined;

    const itens = Array.isArray(valor) ? valor : typeof valor === "string" ? valor.split(",") : null;

    if (!itens || itens.length === 0) {
        throw new AppError(`O parâmetro ${nome} deve ser uma lista de ids.`);
    }

    return [...new Set(itens.map(item => parseInteiroPositivo(typeof item === "string" ? item.trim() : item, nome)))];
}
