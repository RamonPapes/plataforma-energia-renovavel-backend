import { classificarVulnerabilidade, FaixaVulnerabilidade, FAIXAS_VULNERABILIDADE } from "../../src/domain/faixasVulnerabilidade";

describe("Faixas de vulnerabilidade", () => {
    test.each([
        [0, FaixaVulnerabilidade.MUITO_ALTA],
        [0.2499, FaixaVulnerabilidade.MUITO_ALTA],
        [0.25, FaixaVulnerabilidade.ALTA],
        [0.4999, FaixaVulnerabilidade.ALTA],
        [0.5, FaixaVulnerabilidade.MEDIA],
        [0.75, FaixaVulnerabilidade.BAIXA],
        [1, FaixaVulnerabilidade.BAIXA],
    ])("Ci %s fica na faixa %s", (ci, faixa) => {
        expect(classificarVulnerabilidade(ci).faixa).toBe(faixa);
    });

    test("as faixas cobrem de 0 a 1 sem buracos", () => {
        expect(FAIXAS_VULNERABILIDADE[0].ciMinimo).toBe(0);
        expect(FAIXAS_VULNERABILIDADE[FAIXAS_VULNERABILIDADE.length - 1].ciMaximo).toBe(1);
        FAIXAS_VULNERABILIDADE.slice(1).forEach((faixa, i) => {
            expect(faixa.ciMinimo).toBe(FAIXAS_VULNERABILIDADE[i].ciMaximo);
        });
    });
});
