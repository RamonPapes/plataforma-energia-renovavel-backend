import {
    normalizar, ponderar, idealPositiva, idealNegativa, distancias, coeficienteProximidade, topsis,
} from "../../src/domain/topsis";
import { TipoCriterio } from "../../src/models/Criterio";

const { BENEFICIO: B, CUSTO: C } = TipoCriterio;

// Exemplo numérico 7.3 do roteiro
const MATRIZ_ROTEIRO = [
    [15, 0.8, 980, 0.75, 5.2], // A
    [5, 2.1, 1850, 0.62, 5.8], // B
    [22, 0.3, 650, 0.89, 4.9], // C
];
const PESOS_ROTEIRO = [0.2, 0.2, 0.15, 0.25, 0.2];
const TIPOS_ROTEIRO = [C, B, B, C, B];

describe("TOPSIS - passos do algoritmo", () => {
    test("normalização vetorial preserva proporções (exemplo do roteiro)", () => {
        const resultado = normalizar([[3], [4]]);

        expect(resultado[0][0]).toBeCloseTo(0.6);
        expect(resultado[1][0]).toBeCloseTo(0.8);
    });

    test("normalização deixa cada coluna com norma 1", () => {
        const normalizada = normalizar(MATRIZ_ROTEIRO);

        for (let j = 0; j < 5; j++) {
            const norma = Math.sqrt(normalizada.reduce((soma, linha) => soma + linha[j] ** 2, 0));
            expect(norma).toBeCloseTo(1);
        }
    });

    test("coluna toda zerada vira 0 em vez de dividir por zero", () => {
        expect(normalizar([[0, 1], [0, 2]]).map(linha => linha[0])).toEqual([0, 0]);
    });

    test("ponderação multiplica cada coluna pelo seu peso", () => {
        // valores com representação binária exata, para comparar sem erro de ponto flutuante
        expect(ponderar([[1, 1], [0.5, 0.25]], [0.5, 0.25])).toEqual([[0.5, 0.25], [0.25, 0.0625]]);
    });

    test("soluções ideais respeitam benefício (maior é melhor) e custo (menor é melhor)", () => {
        const ponderada = [[1, 10], [3, 5]];

        expect(idealPositiva(ponderada, [B, C])).toEqual([3, 5]);
        expect(idealNegativa(ponderada, [B, C])).toEqual([1, 10]);
    });

    test("distância euclidiana até a solução ideal", () => {
        expect(distancias([[0, 0], [3, 4]], [0, 0])).toEqual([0, 5]);
    });

    test("coeficiente de proximidade Ci = D- / (D+ + D-)", () => {
        expect(coeficienteProximidade([1, 3], [3, 1])).toEqual([0.75, 0.25]);
    });

    test("D+ = D- = 0 (alternativas iguais) resulta em Ci 0.5", () => {
        expect(coeficienteProximidade([0], [0])).toEqual([0.5]);
    });
});

describe("TOPSIS - ranking", () => {
    test("exemplo 7.3 do roteiro: B > A > C", () => {
        const ranking = topsis(MATRIZ_ROTEIRO, PESOS_ROTEIRO, TIPOS_ROTEIRO);

        expect(ranking.map(r => ["A", "B", "C"][r.indice])).toEqual(["B", "A", "C"]);
        expect(ranking.map(r => r.posicao)).toEqual([1, 2, 3]);
    });

    test("exemplo 7.3: valores conferidos com cálculo independente (planilha)", () => {
        const [b, a, c] = topsis(MATRIZ_ROTEIRO, PESOS_ROTEIRO, TIPOS_ROTEIRO);

        expect(a.ci).toBeCloseTo(0.336058, 6);
        expect(a.distanciaPositiva).toBeCloseTo(0.151403, 6);
        expect(a.distanciaNegativa).toBeCloseTo(0.076633, 6);
        // B é o melhor e C o pior em todos os critérios
        expect(b.ci).toBeCloseTo(1);
        expect(c.ci).toBeCloseTo(0);
    });

    test("Ci fica entre 0 e 1", () => {
        const matriz = Array.from({ length: 50 }, (_, i) => [i % 7, (i * 13) % 11 + 1, (i * 3) % 5 + 0.5]);

        for (const r of topsis(matriz, [0.5, 0.3, 0.2], [B, C, B])) {
            expect(r.ci).toBeGreaterThanOrEqual(0);
            expect(r.ci).toBeLessThanOrEqual(1);
        }
    });

    test("alternativas idênticas empatam com Ci 0.5 e mantêm a ordem de entrada", () => {
        const ranking = topsis([[1, 2], [1, 2]], [0.5, 0.5], [B, C]);

        expect(ranking.map(r => r.ci)).toEqual([0.5, 0.5]);
        expect(ranking.map(r => r.indice)).toEqual([0, 1]);
    });

    test("RNF01: 500 alternativas x 7 critérios em menos de 3 segundos", () => {
        const matriz = Array.from({ length: 500 }, (_, i) => Array.from({ length: 7 }, (_, j) => ((i + 1) * (j + 3)) % 97));

        const inicio = performance.now();
        const ranking = topsis(matriz, Array(7).fill(1 / 7), [B, C, B, C, B, C, B]);

        expect(ranking).toHaveLength(500);
        expect(performance.now() - inicio).toBeLessThan(3000);
    });

    test.each([
        ["matriz vazia", [], [1], [B], "não tem alternativas"],
        ["sem critérios", [[]], [], [], "nenhum critério"],
        ["pesos e tipos de tamanhos diferentes", [[1]], [1], [B, C], "tamanhos diferentes"],
        ["linha sem todos os valores", [[1, 2], [1]], [0.5, 0.5], [B, B], "não tem um valor para cada critério"],
        ["valor não numérico", [[1, NaN]], [0.5, 0.5], [B, B], "não numéricos"],
        ["peso negativo", [[1, 2]], [-0.5, 1.5], [B, B], "pesos inválidos"],
    ])("rejeita entrada inválida: %s", (_, matriz, pesos, tipos, mensagem) => {
        expect(() => topsis(matriz as number[][], pesos as number[], tipos as TipoCriterio[])).toThrow(mensagem as string);
    });
});
