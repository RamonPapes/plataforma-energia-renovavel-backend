import { AppError } from "../errors/AppError";
import { AppDataSource } from "../database/data-source";
import { topsis } from "../domain/topsis";
import { classificarVulnerabilidade } from "../domain/faixasVulnerabilidade";
import { Simulacao, IParametrosSimulacao } from "../models/Simulacao";
import { ResultadoRanking } from "../models/ResultadoRanking";
import { SimulacaoRepository } from "../repository/simulacaoRepository";
import { ResultadoRankingRepository } from "../repository/resultadoRankingRepository";
import { MatrizService } from "./MatrizService";
import { IPeso, distribuirPesos, garantirSomaIgualAUm } from "../utils/pesos";

interface IExecutarRequest {
    usuarioId: number;
    ano?: number;
    municipioIds?: number[];
    criterioIds?: number[];
    pesos?: IPeso[];
}

interface IListarSimulacoesRequest {
    usuarioId?: number;
    ano?: number;
    page: number;
    limit: number;
}

const TAMANHO_LOTE = 1000;

class SimulacaoService {
    // UC03: monta a matriz de decisão do banco, executa o TOPSIS e salva a simulação com o ranking
    async executar({ usuarioId, ano, municipioIds, criterioIds, pesos }: IExecutarRequest) {
        const matrizService = new MatrizService();

        const anoReferencia = ano ?? await matrizService.getAnoMaisRecente();
        if (anoReferencia === undefined) {
            throw new AppError("A matriz de decisão está vazia: cadastre os valores dos indicadores antes de executar o TOPSIS.", 422);
        }

        const { criterios, municipios, valores } = await matrizService.carregarMatriz({ ano: anoReferencia, municipioIds, criterioIds });

        if (criterios.length === 0) {
            throw new AppError("Nenhum critério cadastrado.", 422);
        }

        const pesosEfetivos = pesos
            ? this.pesosInformados(pesos, criterios.map(c => c.id))
            : this.pesosSalvos(criterios.map(c => c.peso));

        // município sem valor em algum critério não entra no cálculo e é informado em "ignorados"
        const completos: number[] = [];
        const ignorados: IParametrosSimulacao["ignorados"] = [];

        municipios.forEach((municipio, i) => {
            const criteriosFaltando = criterios.filter((_, j) => valores[i][j] === null).map(c => c.id);

            if (criteriosFaltando.length) {
                ignorados.push({ id: municipio.id, nome: municipio.nome, uf: municipio.uf, criteriosFaltando });
            } else {
                completos.push(i);
            }
        });

        if (completos.length < 2) {
            throw new AppError(
                `São necessários ao menos 2 municípios com valores em todos os critérios selecionados no ano ${anoReferencia} ` +
                `(encontrados: ${completos.length}; com valores faltando: ${ignorados.length}).`,
                422
            );
        }

        const ranking = topsis(
            completos.map(i => valores[i] as number[]),
            pesosEfetivos,
            criterios.map(c => c.tipo)
        );

        const parametros: IParametrosSimulacao = {
            ano: anoReferencia,
            municipiosSelecionados: municipioIds ?? null,
            pesosPersonalizados: pesos !== undefined,
            criterios: criterios.map((c, j) => ({ id: c.id, nome: c.nome, tipo: c.tipo, unidade: c.unidade, peso: pesosEfetivos[j] })),
            ignorados,
        };

        // a simulação e o ranking são salvos juntos: ou tudo, ou nada
        const simulacaoId = await AppDataSource.transaction(async manager => {
            const simulacao = await manager.save(manager.create(Simulacao, {
                usuario_id: usuarioId,
                ano_referencia: anoReferencia,
                parametros,
            }));

            const linhas = ranking.map(resultado => ({
                simulacao_id: simulacao.id,
                municipio_id: municipios[completos[resultado.indice]].id,
                coeficiente_ci: resultado.ci,
                distancia_positiva: resultado.distanciaPositiva,
                distancia_negativa: resultado.distanciaNegativa,
                posicao: resultado.posicao,
            }));

            for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
                await manager.insert(ResultadoRanking, linhas.slice(i, i + TAMANHO_LOTE));
            }

            return simulacao.id;
        });

        return this.getSimulacaoById(simulacaoId);
    }

    // RF10: histórico de simulações, da mais recente para a mais antiga
    async getSimulacoes({ usuarioId, ano, page, limit }: IListarSimulacoesRequest) {
        const consulta = SimulacaoRepository.createQueryBuilder("s")
            .leftJoin("s.usuario", "u")
            .select(["s.id", "s.data_execucao", "s.ano_referencia", "s.status", "u.id", "u.nome"])
            .orderBy("s.data_execucao", "DESC")
            .addOrderBy("s.id", "DESC")
            .skip((page - 1) * limit)
            .take(limit);

        if (usuarioId !== undefined) consulta.andWhere("s.usuario_id = :usuarioId", { usuarioId });
        if (ano !== undefined) consulta.andWhere("s.ano_referencia = :ano", { ano });

        const [simulacoes, total] = await consulta.getManyAndCount();

        // quantidade de municípios no ranking de cada simulação da página
        const contagens = simulacoes.length
            ? await ResultadoRankingRepository.createQueryBuilder("r")
                .select("r.simulacao_id", "simulacaoId")
                .addSelect("COUNT(*)", "total")
                .where("r.simulacao_id IN (:...ids)", { ids: simulacoes.map(s => s.id) })
                .groupBy("r.simulacao_id")
                .getRawMany<{ simulacaoId: number; total: string }>()
            : [];
        const totalPorSimulacao = new Map(contagens.map(c => [Number(c.simulacaoId), Number(c.total)]));

        const data = simulacoes.map(s => ({
            id: s.id,
            data_execucao: s.data_execucao,
            ano_referencia: s.ano_referencia,
            status: s.status,
            usuario: s.usuario ? { id: s.usuario.id, nome: s.usuario.nome } : null,
            totalMunicipios: totalPorSimulacao.get(s.id) ?? 0,
        }));

        return { data, total, page, limit };
    }

    async getSimulacaoById(id: number) {
        const simulacao = await SimulacaoRepository.findOne({ where: { id }, relations: { usuario: true } });

        if (!simulacao) {
            throw new AppError("Simulação não encontrada.", 404);
        }

        const resultados = await ResultadoRankingRepository.find({
            where: { simulacao_id: id },
            relations: { municipio: true },
            order: { posicao: "ASC" },
        });

        return {
            id: simulacao.id,
            data_execucao: simulacao.data_execucao,
            ano_referencia: simulacao.ano_referencia,
            status: simulacao.status,
            usuario: { id: simulacao.usuario.id, nome: simulacao.usuario.nome },
            parametros: simulacao.parametros,
            // maior Ci = menos vulnerável (posição 1)
            ranking: resultados.map(r => ({
                posicao: r.posicao,
                municipio: { id: r.municipio.id, nome: r.municipio.nome, uf: r.municipio.uf },
                ci: r.coeficiente_ci,
                distanciaPositiva: r.distancia_positiva,
                distanciaNegativa: r.distancia_negativa,
                faixa: classificarVulnerabilidade(r.coeficiente_ci).faixa,
            })),
        };
    }

    // Pesos enviados na requisição: um para cada critério selecionado, somando 1
    private pesosInformados(pesos: IPeso[], criterioIds: number[]) {
        const porId = new Map(pesos.map(p => [p.id, p.peso]));

        const naoSelecionados = pesos.filter(p => !criterioIds.includes(p.id)).map(p => p.id);
        if (naoSelecionados.length) {
            throw new AppError(`Pesos informados para critérios fora da simulação: ${naoSelecionados.join(", ")}.`);
        }

        const faltando = criterioIds.filter(id => !porId.has(id));
        if (faltando.length) {
            throw new AppError(`Informe o peso de todos os critérios da simulação. Faltando: ${faltando.join(", ")}.`);
        }

        const pesosOrdenados = criterioIds.map(id => porId.get(id)!);
        garantirSomaIgualAUm(pesosOrdenados);

        return pesosOrdenados;
    }

    // Pesos salvos nos critérios (UC02). Com apenas parte dos critérios selecionada, eles são
    // reescalados proporcionalmente para que a soma volte a ser 1
    private pesosSalvos(pesos: number[]) {
        if (pesos.every(peso => peso === 0)) {
            throw new AppError("Os critérios selecionados estão com peso 0. Configure os pesos em PUT /criterios/pesos ou envie-os na requisição.", 422);
        }

        return distribuirPesos(pesos);
    }
}

export { SimulacaoService };
