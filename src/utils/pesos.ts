import { AppError } from "../errors/AppError";
import { parseInteiroPositivo } from "./parametros";

// a coluna peso tem 4 casas decimais: as contas são feitas em décimos de milésimo (inteiros)
// para que pesos como 0.3333 + 0.3333 + 0.3334 deem exatamente 1, sem erro de ponto flutuante
const ESCALA_PESO = 10000;

export interface IPeso {
    id: number;
    peso: number;
}

// Valida o formato [{ id, peso }, ...] usado em PUT /criterios/pesos e em POST /topsis/executar
export function validarListaPesos(pesos: unknown) {
    if (!Array.isArray(pesos) || pesos.length === 0) {
        throw new AppError("Informe a lista de pesos: { \"pesos\": [{ \"id\": 1, \"peso\": 0.2 }, ...] }.");
    }

    const ids = new Set<number>();

    return pesos.map((item): IPeso => {
        const id = parseInteiroPositivo(item?.id, "id");
        const peso = item?.peso;

        if (ids.has(id)) throw new AppError(`O critério ${id} foi informado mais de uma vez.`);
        ids.add(id);

        if (typeof peso !== "number" || peso < 0 || peso > 1) {
            throw new AppError(`O peso do critério ${id} deve ser um número entre 0 e 1.`);
        }
        // a coluna guarda 4 casas decimais; mais que isso seria arredondado sem aviso
        if (Math.abs(peso * ESCALA_PESO - Math.round(peso * ESCALA_PESO)) > 1e-9) {
            throw new AppError(`O peso do critério ${id} deve ter no máximo 4 casas decimais.`);
        }

        return { id, peso };
    });
}

export function garantirSomaIgualAUm(pesos: number[]) {
    const soma = pesos.reduce((total, peso) => total + Math.round(peso * ESCALA_PESO), 0);

    if (soma !== ESCALA_PESO) {
        throw new AppError(`A soma dos pesos deve ser 1 (soma informada: ${soma / ESCALA_PESO}).`);
    }
}

// Converte proporções em pesos de 4 casas decimais que somam exatamente 1.
// Usa o método do maior resto: arredonda todos para baixo e entrega as unidades que sobraram
// (décimos de milésimo) para quem teve a maior parte descartada. Proporções todas zero viram pesos iguais.
export function distribuirPesos(proporcoes: number[]) {
    if (proporcoes.length === 0) return [];

    const somaProporcoes = proporcoes.reduce((total, p) => total + p, 0);
    const base = somaProporcoes > 0 ? proporcoes : proporcoes.map(() => 1);
    const totalBase = somaProporcoes > 0 ? somaProporcoes : proporcoes.length;

    const exatos = base.map(p => (p / totalBase) * ESCALA_PESO);
    const unidades = exatos.map(Math.floor);

    const sobra = ESCALA_PESO - unidades.reduce((total, u) => total + u, 0);
    const maioresRestos = exatos
        .map((exato, indice) => ({ indice, resto: exato - unidades[indice] }))
        .sort((a, b) => b.resto - a.resto);

    for (let i = 0; i < sobra; i++) {
        unidades[maioresRestos[i].indice]++;
    }

    return unidades.map(u => u / ESCALA_PESO);
}
