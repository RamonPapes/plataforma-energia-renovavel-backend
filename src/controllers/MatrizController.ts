import { Request, Response } from "express";
import { MatrizService } from "../services/MatrizService";
import { AppError } from "../errors/AppError";
import { parseAno, parseInteiroPositivo, parseListaIds } from "../utils/parametros";

// 500 municípios x 7 critérios = 3.500 valores, com folga
const MAXIMO_VALORES_POR_REQUISICAO = 5000;
// limite da coluna DECIMAL(15,4)
const VALOR_MAXIMO = 99999999999;

// Valida o body { ano?, valores: [{ municipioId, criterioId, ano?, valor }] }.
// O ano pode vir em cada item ou uma vez só no body, valendo para todos os itens.
function validarValores(body: Record<string, unknown> = {}) {
    const { valores } = body;

    if (!Array.isArray(valores) || valores.length === 0) {
        throw new AppError("Informe a lista de valores: { \"ano\": 2022, \"valores\": [{ \"municipioId\": 1, \"criterioId\": 1, \"valor\": 12.5 }, ...] }.");
    }
    if (valores.length > MAXIMO_VALORES_POR_REQUISICAO) {
        throw new AppError(`Envie no máximo ${MAXIMO_VALORES_POR_REQUISICAO} valores por requisição.`);
    }

    const celulas = new Set<string>();

    return valores.map((item, i) => {
        const municipioId = parseInteiroPositivo(item?.municipioId, `valores[${i}].municipioId`);
        const criterioId = parseInteiroPositivo(item?.criterioId, `valores[${i}].criterioId`);
        const ano = parseAno(item?.ano ?? body.ano, `ano de valores[${i}]`);
        const valor = item?.valor;

        if (valor !== null && (typeof valor !== "number" || !Number.isFinite(valor) || Math.abs(valor) > VALOR_MAXIMO)) {
            throw new AppError(`valores[${i}].valor deve ser um número (ou null para remover o valor).`);
        }

        const chave = `${municipioId}:${criterioId}:${ano}`;
        if (celulas.has(chave)) {
            throw new AppError(`valores[${i}] repete município ${municipioId}, critério ${criterioId} e ano ${ano}.`);
        }
        celulas.add(chave);

        return { municipioId, criterioId, ano, valor: valor as number | null };
    });
}

class MatrizController {
    async salvarValoresHandle(req: Request, res: Response) {
        const valores = validarValores(req.body);

        const matrizService = new MatrizService();

        const resultado = await matrizService.salvarValores(valores);

        return res.status(200).json(resultado);
    }

    async getMatrizHandle(req: Request, res: Response) {
        const { ano, municipios, criterios } = req.query;

        const matrizService = new MatrizService();

        const matriz = await matrizService.getMatriz({
            ano: ano === undefined ? undefined : parseAno(ano),
            municipioIds: parseListaIds(municipios, "municipios"),
            criterioIds: parseListaIds(criterios, "criterios"),
        });

        return res.status(200).json(matriz);
    }

    async getAnosHandle(req: Request, res: Response) {
        const matrizService = new MatrizService();

        const anos = await matrizService.getAnos();

        return res.status(200).json(anos);
    }

    async getIndicadoresMunicipioHandle(req: Request, res: Response) {
        const id = parseInteiroPositivo(req.params.id, "id");
        const { ano } = req.query;

        const matrizService = new MatrizService();

        const indicadores = await matrizService.getIndicadoresMunicipio(id, ano === undefined ? undefined : parseAno(ano));

        return res.status(200).json(indicadores);
    }
}

export { MatrizController };
