import { AppError } from "../errors/AppError";
import { FAIXAS_VULNERABILIDADE } from "../domain/faixasVulnerabilidade";
import { MunicipioRepository } from "../repository/municipioRepository";
import { CriterioRepository } from "../repository/criterioRepository";
import { SimulacaoRepository } from "../repository/simulacaoRepository";
import { MatrizService } from "./MatrizService";
import { SimulacaoService } from "./SimulacaoService";

class DashboardService {
    // RF05: números dos cards do dashboard. Sem simulacaoId, usa a simulação mais recente
    async getResumo(simulacaoId?: number) {
        const [municipios, criterios, simulacoes, anosComDados] = await Promise.all([
            MunicipioRepository.count(),
            CriterioRepository.count(),
            SimulacaoRepository.count(),
            new MatrizService().getAnos(),
        ]);

        const idSimulacao = simulacaoId ?? await this.getIdSimulacaoMaisRecente();

        return {
            totais: { municipios, criterios, simulacoes, anosComDados },
            simulacao: idSimulacao === undefined ? null : await this.resumirSimulacao(idSimulacao),
        };
    }

    private async resumirSimulacao(id: number) {
        const simulacao = await new SimulacaoService().getSimulacaoById(id);
        const { ranking } = simulacao;

        if (ranking.length === 0) {
            throw new AppError("A simulação não possui resultados.", 422);
        }

        const somaCi = ranking.reduce((total, r) => total + r.ci, 0);
        const resumoMunicipio = (r: typeof ranking[number]) => ({ municipio: r.municipio, posicao: r.posicao, ci: r.ci, faixa: r.faixa });

        return {
            id: simulacao.id,
            data_execucao: simulacao.data_execucao,
            ano_referencia: simulacao.ano_referencia,
            usuario: simulacao.usuario,
            totalMunicipios: ranking.length,
            municipiosIgnorados: simulacao.parametros.ignorados.length,
            ciMedio: somaCi / ranking.length,
            // o ranking vem do menos para o mais vulnerável (maior Ci primeiro)
            maisVulneravel: resumoMunicipio(ranking[ranking.length - 1]),
            menosVulneravel: resumoMunicipio(ranking[0]),
            // todas as faixas aparecem, inclusive as vazias, para servir de legenda do mapa
            faixas: FAIXAS_VULNERABILIDADE.map(f => ({
                ...f,
                quantidade: ranking.filter(r => r.faixa === f.faixa).length,
            })),
        };
    }

    private async getIdSimulacaoMaisRecente() {
        const [maisRecente] = await SimulacaoRepository.find({
            select: { id: true },
            order: { data_execucao: "DESC", id: "DESC" },
            take: 1,
        });
        return maisRecente?.id;
    }
}

export { DashboardService };
