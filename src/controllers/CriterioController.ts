import { Request, Response } from "express";
import { CriterioService } from "../services/CriterioService";
import { TipoCriterio } from "../models/Criterio";
import { AppError } from "../errors/AppError";
import { parseInteiroPositivo, parsePaginacao } from "../utils/parametros";

function validarTipo(tipo: unknown) {
    // aceita também minúsculas ("beneficio", "custo"), como no roteiro
    const tipoNormalizado = typeof tipo === "string" ? tipo.toUpperCase() : tipo;

    if (!Object.values(TipoCriterio).includes(tipoNormalizado as TipoCriterio)) {
        throw new AppError("Tipo inválido. Use BENEFICIO ou CUSTO.");
    }

    return tipoNormalizado as TipoCriterio;
}

function validarTextoOpcional(valor: unknown, campo: string, tamanhoMaximo?: number) {
    if (valor == null || valor === "") return null;
    if (typeof valor !== "string") throw new AppError(`O campo ${campo} deve ser um texto.`);
    if (tamanhoMaximo && valor.trim().length > tamanhoMaximo) {
        throw new AppError(`O campo ${campo} deve ter no máximo ${tamanhoMaximo} caracteres.`);
    }
    return valor.trim() || null;
}

// Valida o body do POST e do PUT e devolve os dados normalizados para o service
function validarCriterio(body: Record<string, unknown> = {}) {
    const { nome, descricao, tipo, unidade, peso } = body;

    if (peso !== undefined) {
        throw new AppError("O peso não é informado aqui: ao criar ou remover um critério os pesos são redistribuídos automaticamente. Para ajustá-los, use PUT /criterios/pesos.");
    }

    if (typeof nome !== "string" || !nome.trim()) throw new AppError("O nome do critério é obrigatório.");
    if (nome.trim().length > 150) throw new AppError("O nome deve ter no máximo 150 caracteres.");

    return {
        nome: nome.trim(),
        descricao: validarTextoOpcional(descricao, "descricao"),
        tipo: validarTipo(tipo),
        unidade: validarTextoOpcional(unidade, "unidade", 50),
    };
}

function validarPesos(pesos: unknown) {
    if (!Array.isArray(pesos) || pesos.length === 0) {
        throw new AppError("Informe a lista de pesos: { \"pesos\": [{ \"id\": 1, \"peso\": 0.2 }, ...] }.");
    }

    const ids = new Set<number>();

    return pesos.map(item => {
        const id = parseInteiroPositivo(item?.id, "id");
        const peso = item?.peso;

        if (ids.has(id)) throw new AppError(`O critério ${id} foi informado mais de uma vez.`);
        ids.add(id);

        if (typeof peso !== "number" || peso < 0 || peso > 1) {
            throw new AppError(`O peso do critério ${id} deve ser um número entre 0 e 1.`);
        }
        // a coluna guarda 4 casas decimais; mais que isso seria arredondado sem aviso
        if (Math.abs(peso * 10000 - Math.round(peso * 10000)) > 1e-9) {
            throw new AppError(`O peso do critério ${id} deve ter no máximo 4 casas decimais.`);
        }

        return { id, peso };
    });
}

class CriterioController {
    async createCriterioHandle(req: Request, res: Response) {
        const dados = validarCriterio(req.body);

        const criterioService = new CriterioService();

        const criterio = await criterioService.createCriterio(dados);

        return res.status(201).json(criterio);
    }

    async getCriteriosHandle(req: Request, res: Response) {
        const { tipo } = req.query;
        const { page, limit } = parsePaginacao(req.query);

        const criterioService = new CriterioService();

        const criterios = await criterioService.getCriterios({
            tipo: tipo === undefined ? undefined : validarTipo(tipo),
            page,
            limit,
        });

        return res.status(200).json(criterios);
    }

    async getCriterioByIdHandle(req: Request, res: Response) {
        const id = parseInteiroPositivo(req.params.id, "id");

        const criterioService = new CriterioService();

        const criterio = await criterioService.getCriterioById(id);

        return res.status(200).json(criterio);
    }

    async updateCriterioHandle(req: Request, res: Response) {
        const id = parseInteiroPositivo(req.params.id, "id");
        const dados = validarCriterio(req.body);

        const criterioService = new CriterioService();

        const criterio = await criterioService.updateCriterio(id, dados);

        return res.status(200).json(criterio);
    }

    async deleteCriterioHandle(req: Request, res: Response) {
        const id = parseInteiroPositivo(req.params.id, "id");

        const criterioService = new CriterioService();

        await criterioService.deleteCriterio(id);

        return res.status(204).send();
    }

    async atualizarPesosHandle(req: Request, res: Response) {
        const pesos = validarPesos(req.body?.pesos);

        const criterioService = new CriterioService();

        const criterios = await criterioService.atualizarPesos(pesos);

        return res.status(200).json(criterios);
    }
}

export { CriterioController };
