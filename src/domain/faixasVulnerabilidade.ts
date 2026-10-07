// Classificação do Ci em faixas de vulnerabilidade, usada no ranking, no dashboard e no mapa
// (pontos coloridos por faixa, capítulo 8 do roteiro). Cada faixa vale para ciMinimo <= Ci < ciMaximo;
// a última inclui o Ci = 1.

export enum FaixaVulnerabilidade {
    MUITO_ALTA = "MUITO_ALTA",
    ALTA = "ALTA",
    MEDIA = "MEDIA",
    BAIXA = "BAIXA",
}

export const FAIXAS_VULNERABILIDADE = [
    { faixa: FaixaVulnerabilidade.MUITO_ALTA, rotulo: "Vulnerabilidade muito alta", ciMinimo: 0, ciMaximo: 0.25 },
    { faixa: FaixaVulnerabilidade.ALTA, rotulo: "Vulnerabilidade alta", ciMinimo: 0.25, ciMaximo: 0.5 },
    { faixa: FaixaVulnerabilidade.MEDIA, rotulo: "Vulnerabilidade média", ciMinimo: 0.5, ciMaximo: 0.75 },
    { faixa: FaixaVulnerabilidade.BAIXA, rotulo: "Vulnerabilidade baixa", ciMinimo: 0.75, ciMaximo: 1 },
];

// quanto MENOR o Ci, MAIS vulnerável o município
export function classificarVulnerabilidade(ci: number) {
    return FAIXAS_VULNERABILIDADE.find(f => ci < f.ciMaximo) ?? FAIXAS_VULNERABILIDADE[FAIXAS_VULNERABILIDADE.length - 1];
}
