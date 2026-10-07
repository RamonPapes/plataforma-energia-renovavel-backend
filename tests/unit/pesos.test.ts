import { distribuirPesos, garantirSomaIgualAUm, validarListaPesos } from "../../src/utils/pesos";
import { AppError } from "../../src/errors/AppError";

const soma = (pesos: number[]) => Math.round(pesos.reduce((t, p) => t + p, 0) * 10000);

describe("distribuirPesos", () => {
    test("mantém a proporção entre os pesos e soma exatamente 1", () => {
        const pesos = distribuirPesos([0.4, 0.2, 0.2]);

        expect(pesos).toEqual([0.5, 0.25, 0.25]);
        expect(soma(pesos)).toBe(10000);
    });

    test("método do maior resto: 1/3 de cada vira 0.3334 + 0.3333 + 0.3333", () => {
        const pesos = distribuirPesos([1, 1, 1]);

        expect(pesos).toEqual([0.3334, 0.3333, 0.3333]);
        expect(soma(pesos)).toBe(10000);
    });

    test("1/7 de cada soma exatamente 1", () => {
        expect(soma(distribuirPesos(Array(7).fill(1)))).toBe(10000);
    });

    test("proporções todas zero viram pesos iguais", () => {
        expect(distribuirPesos([0, 0, 0, 0])).toEqual([0.25, 0.25, 0.25, 0.25]);
    });

    test("lista vazia devolve lista vazia", () => {
        expect(distribuirPesos([])).toEqual([]);
    });
});

describe("garantirSomaIgualAUm", () => {
    test("aceita 0.3333 + 0.3333 + 0.3334 sem erro de ponto flutuante", () => {
        expect(() => garantirSomaIgualAUm([0.3333, 0.3333, 0.3334])).not.toThrow();
    });

    test("recusa soma diferente de 1", () => {
        expect(() => garantirSomaIgualAUm([0.5, 0.4])).toThrow("soma informada: 0.9");
    });
});

describe("validarListaPesos", () => {
    test("devolve a lista validada", () => {
        expect(validarListaPesos([{ id: 1, peso: 0.6 }, { id: "2", peso: 0.4 }])).toEqual([{ id: 1, peso: 0.6 }, { id: 2, peso: 0.4 }]);
    });

    test.each([
        ["não é lista", { id: 1 }, "Informe a lista de pesos"],
        ["lista vazia", [], "Informe a lista de pesos"],
        ["id inválido", [{ id: 0, peso: 1 }], "id deve ser um número inteiro positivo"],
        ["id repetido", [{ id: 1, peso: 0.5 }, { id: 1, peso: 0.5 }], "mais de uma vez"],
        ["peso não numérico", [{ id: 1, peso: "1" }], "entre 0 e 1"],
        ["peso maior que 1", [{ id: 1, peso: 1.5 }], "entre 0 e 1"],
        ["mais de 4 casas decimais", [{ id: 1, peso: 0.12345 }], "4 casas decimais"],
    ])("recusa: %s", (_, entrada, mensagem) => {
        expect(() => validarListaPesos(entrada)).toThrow(AppError);
        expect(() => validarListaPesos(entrada)).toThrow(mensagem);
    });
});
