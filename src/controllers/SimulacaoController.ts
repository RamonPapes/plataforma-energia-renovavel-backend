import { Request, Response } from "express";
import { SimulacaoService } from "../services/SimulacaoService";
import { parseAno, parseInteiroPositivo, parseListaIds, parsePaginacao } from "../utils/parametros";
import { validarListaPesos } from "../utils/pesos";

class SimulacaoController {
    // Body (todos opcionais): { ano, municipios: [ids], criterios: [ids], pesos: [{ id, peso }] }
    async executarHandle(req: Request, res: Response) {
        const { ano, municipios, criterios, pesos } = req.body ?? {};

        const simulacaoService = new SimulacaoService();

        const simulacao = await simulacaoService.executar({
            usuarioId: req.usuario!.id,
            ano: ano === undefined ? undefined : parseAno(ano),
            municipioIds: parseListaIds(municipios, "municipios"),
            criterioIds: parseListaIds(criterios, "criterios"),
            pesos: pesos === undefined ? undefined : validarListaPesos(pesos),
        });

        return res.status(201).json(simulacao);
    }

    async getSimulacoesHandle(req: Request, res: Response) {
        const { usuarioId, ano } = req.query;
        const { page, limit } = parsePaginacao(req.query);

        const simulacaoService = new SimulacaoService();

        const simulacoes = await simulacaoService.getSimulacoes({
            usuarioId: usuarioId === undefined ? undefined : parseInteiroPositivo(usuarioId, "usuarioId"),
            ano: ano === undefined ? undefined : parseAno(ano),
            page,
            limit,
        });

        return res.status(200).json(simulacoes);
    }

    async getSimulacaoByIdHandle(req: Request, res: Response) {
        const id = parseInteiroPositivo(req.params.id, "id");

        const simulacaoService = new SimulacaoService();

        const simulacao = await simulacaoService.getSimulacaoById(id);

        return res.status(200).json(simulacao);
    }
}

export { SimulacaoController };
