import { Request, Response } from "express";
import { MunicipioService } from "../services/MunicipioService";
import { AppError } from "../errors/AppError";

const UFS = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
    "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const LIMIT_PADRAO = 50;
// RNF01 prevê TOPSIS com até 500 alternativas, então o front consegue buscar todas de uma vez
const LIMIT_MAXIMO = 500;

// Valida o body do POST e do PUT e devolve os dados normalizados para o service
function validarMunicipio(body: Record<string, unknown> = {}) {
    const { nome, uf, populacao, idh, latitude, longitude } = body;

    if (typeof nome !== "string" || !nome.trim()) throw new AppError("O nome do município é obrigatório.");
    if (nome.trim().length > 200) throw new AppError("O nome não pode exceder 200 caracteres.");
    if (typeof uf !== "string" || !UFS.includes(uf.toUpperCase())) throw new AppError("UF inválida.");

    if (populacao != null && (!Number.isInteger(populacao) || (populacao as number) < 0)) {
        throw new AppError("A população deve ser um número inteiro maior ou igual a zero.");
    }

    if (idh != null && (typeof idh !== "number" || idh < 0 || idh > 1)) {
        throw new AppError("O IDH deve ser um número entre 0 e 1.");
    }

    if ((latitude == null) !== (longitude == null)) {
        throw new AppError("Informe latitude e longitude juntas.");
    }
    if (latitude != null && (typeof latitude !== "number" || latitude < -90 || latitude > 90)) {
        throw new AppError("A latitude deve ser um número entre -90 e 90.");
    }
    if (longitude != null && (typeof longitude !== "number" || longitude < -180 || longitude > 180)) {
        throw new AppError("A longitude deve ser um número entre -180 e 180.");
    }

    return {
        nome: nome.trim(),
        uf: uf.toUpperCase(),
        populacao: (populacao as number | null | undefined) ?? null,
        idh: (idh as number | null | undefined) ?? null,
        coordenadas: latitude != null ? { latitude: latitude as number, longitude: longitude as number } : null,
    };
}

function parseInteiroPositivo(valor: unknown, nome: string) {
    const numero = Number(valor);

    if (!Number.isInteger(numero) || numero < 1) {
        throw new AppError(`O parâmetro ${nome} deve ser um número inteiro positivo.`);
    }

    return numero;
}

class MunicipioController {
    async createMunicipioHandle(req: Request, res: Response) {
        const dados = validarMunicipio(req.body);

        const municipioService: MunicipioService = new MunicipioService();

        const municipio = await municipioService.createMunicipio(dados);

        return res.status(201).json(municipio);
    }

    async getMunicipiosHandle(req: Request, res: Response) {
        const { uf, page, limit } = req.query;

        if (uf !== undefined && (typeof uf !== "string" || !UFS.includes(uf.toUpperCase()))) {
            throw new AppError("UF inválida.");
        }

        const pagina = page === undefined ? 1 : parseInteiroPositivo(page, "page");
        const limite = limit === undefined ? LIMIT_PADRAO : parseInteiroPositivo(limit, "limit");

        if (limite > LIMIT_MAXIMO) {
            throw new AppError(`O parâmetro limit deve ser no máximo ${LIMIT_MAXIMO}.`);
        }

        const municipioService = new MunicipioService();

        const municipios = await municipioService.getMunicipios({
            uf: uf?.toUpperCase(),
            page: pagina,
            limit: limite,
        });

        return res.status(200).json(municipios);
    }

    async getMunicipioByIdHandle(req: Request, res: Response) {
        const id = parseInteiroPositivo(req.params.id, "id");

        const municipioService = new MunicipioService();

        const municipio = await municipioService.getMunicipioById(id);

        return res.status(200).json(municipio);
    }

    async updateMunicipioHandle(req: Request, res: Response) {
        const id = parseInteiroPositivo(req.params.id, "id");
        const dados = validarMunicipio(req.body);

        const municipioService = new MunicipioService();

        const municipio = await municipioService.updateMunicipio(id, dados);

        return res.status(200).json(municipio);
    }

    async deleteMunicipioHandle(req: Request, res: Response) {
        const id = parseInteiroPositivo(req.params.id, "id");

        const municipioService = new MunicipioService();

        await municipioService.deleteMunicipio(id);

        return res.status(204).send();
    }
}


export { MunicipioController }
