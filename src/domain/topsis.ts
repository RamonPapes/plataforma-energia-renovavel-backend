import { TipoCriterio } from "../models/Criterio";

// Implementação do método TOPSIS (capítulo 7.2 do roteiro).
// Funções puras, sem acesso a banco: recebem números e devolvem números.
//
// matriz[i][j] = valor da alternativa i (município) no critério j
// pesos[j]     = peso do critério j (a soma deve ser 1)
// tipos[j]     = BENEFICIO (maior é melhor) ou CUSTO (menor é melhor)

export interface ResultadoTopsis {
    indice: number;            // posição da alternativa na matriz de entrada
    ci: number;                // coeficiente de proximidade: quanto maior, menos vulnerável
    distanciaPositiva: number; // D+: distância até a solução ideal positiva
    distanciaNegativa: number; // D-: distância até a solução ideal negativa
    posicao: number;           // 1 = maior Ci
}

// Passo 1: normalização vetorial, r_ij = x_ij / sqrt(Σ x_ij²)
export function normalizar(matriz: number[][]) {
    const totalCriterios = matriz[0].length;

    const normas = Array.from({ length: totalCriterios }, (_, j) =>
        Math.sqrt(matriz.reduce((soma, linha) => soma + linha[j] ** 2, 0))
    );

    // coluna toda zerada não diferencia ninguém: fica 0 em vez de dividir por zero
    return matriz.map(linha => linha.map((valor, j) => (normas[j] === 0 ? 0 : valor / normas[j])));
}

// Passo 2: matriz ponderada, v_ij = w_j * r_ij
export function ponderar(normalizada: number[][], pesos: number[]) {
    return normalizada.map(linha => linha.map((valor, j) => valor * pesos[j]));
}

function coluna(matriz: number[][], j: number) {
    return matriz.map(linha => linha[j]);
}

// Passo 3: solução ideal positiva (A+): o melhor valor de cada critério
export function idealPositiva(ponderada: number[][], tipos: TipoCriterio[]) {
    return tipos.map((tipo, j) =>
        tipo === TipoCriterio.BENEFICIO ? Math.max(...coluna(ponderada, j)) : Math.min(...coluna(ponderada, j))
    );
}

// Passo 4: solução ideal negativa (A-): o pior valor de cada critério
export function idealNegativa(ponderada: number[][], tipos: TipoCriterio[]) {
    return tipos.map((tipo, j) =>
        tipo === TipoCriterio.BENEFICIO ? Math.min(...coluna(ponderada, j)) : Math.max(...coluna(ponderada, j))
    );
}

// Passo 5: distância euclidiana de cada alternativa até uma solução ideal
export function distancias(ponderada: number[][], ideal: number[]) {
    return ponderada.map(linha =>
        Math.sqrt(linha.reduce((soma, valor, j) => soma + (valor - ideal[j]) ** 2, 0))
    );
}

// Passo 6: coeficiente de proximidade, Ci = D- / (D+ + D-)
export function coeficienteProximidade(distanciasPositivas: number[], distanciasNegativas: number[]) {
    return distanciasPositivas.map((dPositiva, i) => {
        const total = dPositiva + distanciasNegativas[i];
        // D+ = D- = 0 só acontece quando todas as alternativas são iguais: nenhuma é melhor que outra
        return total === 0 ? 0.5 : distanciasNegativas[i] / total;
    });
}

function validarEntrada(matriz: number[][], pesos: number[], tipos: TipoCriterio[]) {
    if (matriz.length === 0) throw new Error("TOPSIS: a matriz não tem alternativas.");
    if (pesos.length === 0) throw new Error("TOPSIS: nenhum critério informado.");
    if (pesos.length !== tipos.length) throw new Error("TOPSIS: pesos e tipos têm tamanhos diferentes.");

    matriz.forEach((linha, i) => {
        if (linha.length !== pesos.length) throw new Error(`TOPSIS: a linha ${i} não tem um valor para cada critério.`);
        if (!linha.every(Number.isFinite)) throw new Error(`TOPSIS: a linha ${i} tem valores não numéricos.`);
    });

    if (!pesos.every(peso => Number.isFinite(peso) && peso >= 0)) throw new Error("TOPSIS: pesos inválidos.");
}

// Executa todos os passos e devolve o ranking (passo 7), ordenado do maior para o menor Ci
export function topsis(matriz: number[][], pesos: number[], tipos: TipoCriterio[]): ResultadoTopsis[] {
    validarEntrada(matriz, pesos, tipos);

    const ponderada = ponderar(normalizar(matriz), pesos);

    const distanciasPositivas = distancias(ponderada, idealPositiva(ponderada, tipos));
    const distanciasNegativas = distancias(ponderada, idealNegativa(ponderada, tipos));
    const coeficientes = coeficienteProximidade(distanciasPositivas, distanciasNegativas);

    return coeficientes
        .map((ci, indice) => ({
            indice,
            ci,
            distanciaPositiva: distanciasPositivas[indice],
            distanciaNegativa: distanciasNegativas[indice],
        }))
        // empate no Ci mantém a ordem de entrada
        .sort((a, b) => b.ci - a.ci || a.indice - b.indice)
        .map((resultado, i) => ({ ...resultado, posicao: i + 1 }));
}
