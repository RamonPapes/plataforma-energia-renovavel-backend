import { AppError } from "../errors/AppError";
import { Coordenadas } from "../database/transformers";
import { classificarVulnerabilidade } from "../domain/faixasVulnerabilidade";
import { Municipio } from "../models/Municipio";
import { MunicipioRepository } from "../repository/municipioRepository";
import { SimulacaoRepository } from "../repository/simulacaoRepository";
import { ResultadoRankingRepository } from "../repository/resultadoRankingRepository";
import { MatrizService } from "./MatrizService";

// RF07: dados georreferenciados em GeoJSON (RFC 7946), formato lido diretamente pelo Leaflet (L.geoJSON).
// Atenção: no GeoJSON a ordem das coordenadas é [longitude, latitude].

type Propriedades = Record<string, unknown>;

function ponto(coordenadas: Coordenadas, properties: Propriedades) {
    return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [coordenadas.longitude, coordenadas.latitude] },
        properties,
    };
}

// Municípios sem latitude/longitude não podem ir para o mapa: são listados em "semCoordenadas"
// (membro extra permitido pelo GeoJSON) para o front poder avisar o usuário
function colecao<T>(itens: T[], municipioDe: (item: T) => Municipio, propriedadesDe: (item: T) => Propriedades, metadados: Propriedades = {}) {
    const comCoordenadas = itens.filter(item => municipioDe(item).coordenadas);
    const semCoordenadas = itens.filter(item => !municipioDe(item).coordenadas).map(item => {
        const { id, nome, uf } = municipioDe(item);
        return { id, nome, uf };
    });

    return {
        type: "FeatureCollection" as const,
        features: comCoordenadas.map(item => ponto(municipioDe(item).coordenadas!, propriedadesDe(item))),
        metadados: { ...metadados, semCoordenadas },
    };
}

class GeoService {
    // Mapa base: todos os municípios cadastrados
    async getMunicipios() {
        const municipios = await MunicipioRepository.find({ order: { nome: "ASC" } });

        return colecao(municipios, m => m, m => ({
            municipioId: m.id,
            nome: m.nome,
            uf: m.uf,
            populacao: m.populacao,
            idh: m.idh,
        }));
    }

    // Resultado de uma simulação: cada ponto traz posição, Ci e faixa de vulnerabilidade para colorir o mapa
    async getSimulacao(simulacaoId: number) {
        const simulacao = await SimulacaoRepository.findOneBy({ id: simulacaoId });

        if (!simulacao) {
            throw new AppError("Simulação não encontrada.", 404);
        }

        const resultados = await ResultadoRankingRepository.find({
            where: { simulacao_id: simulacaoId },
            relations: { municipio: true },
            order: { posicao: "ASC" },
        });

        return colecao(resultados, r => r.municipio, r => {
            const { faixa, rotulo } = classificarVulnerabilidade(r.coeficiente_ci);
            return {
                municipioId: r.municipio.id,
                nome: r.municipio.nome,
                uf: r.municipio.uf,
                posicao: r.posicao,
                ci: r.coeficiente_ci,
                faixa,
                rotuloFaixa: rotulo,
            };
        }, { simulacaoId, ano: simulacao.ano_referencia, totalMunicipios: resultados.length });
    }

    // Camada por indicador (capítulo 8: "camadas de calor por indicador"): valor de um critério em cada município.
    // valorMinimo e valorMaximo ajudam o front a montar a escala de cores
    async getIndicador(criterioId: number, ano?: number) {
        const matrizService = new MatrizService();
        const anoReferencia = ano ?? await matrizService.getAnoMaisRecente();

        if (anoReferencia === undefined) {
            throw new AppError("A matriz de decisão está vazia.", 422);
        }

        const { criterios: [criterio], municipios, valores } = await matrizService.carregarMatriz({
            ano: anoReferencia,
            criterioIds: [criterioId],
        });

        // só entram os municípios que têm valor para este critério no ano
        const comValor = municipios
            .map((municipio, i) => ({ municipio, valor: valores[i][0] }))
            .filter((item): item is { municipio: Municipio; valor: number } => item.valor !== null);

        const numeros = comValor.map(item => item.valor);

        return colecao(comValor, item => item.municipio, item => ({
            municipioId: item.municipio.id,
            nome: item.municipio.nome,
            uf: item.municipio.uf,
            valor: item.valor,
        }), {
            ano: anoReferencia,
            criterio: { id: criterio.id, nome: criterio.nome, tipo: criterio.tipo, unidade: criterio.unidade },
            valorMinimo: numeros.length ? Math.min(...numeros) : null,
            valorMaximo: numeros.length ? Math.max(...numeros) : null,
        });
    }
}

export { GeoService };
