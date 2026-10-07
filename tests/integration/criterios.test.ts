import request from "supertest";
import { app } from "../../src/app";
import { AppDataSource } from "../../src/database/data-source";
import { Perfil } from "../../src/models/Usuario";
import { usarBancoDeTeste, criarUsuario, criarMunicipio } from "../helpers/banco";

async function pesos(token: string) {
    const { body } = await request(app).get("/api/criterios").set("Authorization", token);
    return body.data.map((c: { peso: number }) => c.peso) as number[];
}

const soma = (valores: number[]) => Math.round(valores.reduce((t, v) => t + v, 0) * 10000);

describe("Critérios (UC02)", () => {
    usarBancoDeTeste();

    let pesquisador: Awaited<ReturnType<typeof criarUsuario>>;
    beforeEach(async () => {
        pesquisador = await criarUsuario(Perfil.PESQUISADOR);
    });

    test("o seed cadastra os 7 indicadores do roteiro com pesos somando 1", async () => {
        const res = await request(app).get("/api/criterios").set("Authorization", pesquisador.token);

        expect(res.body.total).toBe(7);
        expect(res.body.data.map((c: { tipo: string }) => c.tipo)).toEqual(["CUSTO", "BENEFICIO", "BENEFICIO", "CUSTO", "BENEFICIO", "CUSTO", "BENEFICIO"]);
        expect(soma(await pesos(pesquisador.token))).toBe(10000);
    });

    test("filtra por tipo (aceita minúsculas) e busca por id", async () => {
        const custos = await request(app).get("/api/criterios?tipo=custo").set("Authorization", pesquisador.token);
        const criterio = await request(app).get("/api/criterios/3").set("Authorization", pesquisador.token);

        expect(custos.body.total).toBe(3);
        expect(criterio.body).toMatchObject({ id: 3, nome: "Renda per capita", tipo: "BENEFICIO", peso: 0.1429 });
        expect((await request(app).get("/api/criterios/999").set("Authorization", pesquisador.token)).status).toBe(404);
        expect((await request(app).get("/api/criterios?tipo=neutro").set("Authorization", pesquisador.token)).status).toBe(400);
    });

    describe("cadastro, edição e remoção", () => {
        test("novo critério recebe 1/n e os demais são reduzidos na mesma proporção", async () => {
            const res = await request(app).post("/api/criterios").set("Authorization", pesquisador.token)
                .send({ nome: " Acesso à internet ", tipo: "beneficio", unidade: "%" });

            expect(res.status).toBe(201);
            expect(res.body).toMatchObject({ nome: "Acesso à internet", tipo: "BENEFICIO", peso: 0.125, descricao: null });
            const novosPesos = await pesos(pesquisador.token);
            expect(novosPesos).toHaveLength(8);
            expect(soma(novosPesos)).toBe(10000);
        });

        test("remover critério redistribui o peso dele proporcionalmente entre os restantes", async () => {
            await request(app).put("/api/criterios/pesos").set("Authorization", pesquisador.token)
                .send({ pesos: [0.4, 0.2, 0.1, 0.1, 0.1, 0.05, 0.05].map((peso, i) => ({ id: i + 1, peso })) });

            const res = await request(app).delete("/api/criterios/1").set("Authorization", pesquisador.token);

            expect(res.status).toBe(204);
            // os 0.4 removidos são divididos na proporção 0.2 : 0.1 : 0.1 : 0.1 : 0.05 : 0.05
            expect(await pesos(pesquisador.token)).toEqual([0.3333, 0.1667, 0.1667, 0.1667, 0.0833, 0.0833]);
        });

        test("edita nome, descrição, tipo e unidade", async () => {
            const res = await request(app).put("/api/criterios/1").set("Authorization", pesquisador.token)
                .send({ nome: "Domicílios sem energia", descricao: "Fonte: IBGE", tipo: "CUSTO", unidade: "" });

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ nome: "Domicílios sem energia", unidade: null, peso: 0.1429 });
        });

        test.each([
            ["sem nome", { tipo: "CUSTO" }],
            ["nome longo demais", { nome: "a".repeat(151), tipo: "CUSTO" }],
            ["tipo inválido", { nome: "X", tipo: "neutro" }],
            ["descrição que não é texto", { nome: "X", tipo: "CUSTO", descricao: 10 }],
            ["unidade longa demais", { nome: "X", tipo: "CUSTO", unidade: "a".repeat(51) }],
            ["peso no corpo", { nome: "X", tipo: "CUSTO", peso: 0.5 }],
        ])("%s retorna 400", async (_, corpo) => {
            expect((await request(app).post("/api/criterios").set("Authorization", pesquisador.token).send(corpo)).status).toBe(400);
        });

        test("nome repetido (com outra caixa) retorna 409 no cadastro e na edição", async () => {
            expect((await request(app).post("/api/criterios").set("Authorization", pesquisador.token).send({ nome: "RENDA PER CAPITA", tipo: "CUSTO" })).status).toBe(409);
            expect((await request(app).put("/api/criterios/1").set("Authorization", pesquisador.token).send({ nome: "Renda per capita", tipo: "CUSTO" })).status).toBe(409);
        });

        test("critério com valores na matriz não pode ser removido (409) e os pesos não mudam", async () => {
            const municipio = await criarMunicipio({ nome: "Salvador" });
            await AppDataSource.query("INSERT INTO matriz_decisao (municipio_id, criterio_id, valor, ano_referencia) VALUES (?, 1, 10, 2022)", [municipio.id]);
            const antes = await pesos(pesquisador.token);

            const res = await request(app).delete("/api/criterios/1").set("Authorization", pesquisador.token);

            expect(res.status).toBe(409);
            expect(await pesos(pesquisador.token)).toEqual(antes);
        });

        test("gestor público só consulta (403 ao cadastrar); inexistente retorna 404", async () => {
            const gestor = await criarUsuario(Perfil.GESTOR_PUBLICO);

            expect((await request(app).post("/api/criterios").set("Authorization", gestor.token).send({ nome: "X", tipo: "CUSTO" })).status).toBe(403);
            expect((await request(app).put("/api/criterios/999").set("Authorization", pesquisador.token).send({ nome: "X", tipo: "CUSTO" })).status).toBe(404);
            expect((await request(app).delete("/api/criterios/999").set("Authorization", pesquisador.token)).status).toBe(404);
        });
    });

    describe("PUT /api/criterios/pesos (RF03)", () => {
        const todos = (valores: number[]) => ({ pesos: valores.map((peso, i) => ({ id: i + 1, peso })) });

        test("atualiza os pesos de todos os critérios; 0.3333 + 0.3333 + 0.3334 soma exatamente 1", async () => {
            const res = await request(app).put("/api/criterios/pesos").set("Authorization", pesquisador.token).send(todos([0.3333, 0.3333, 0.3334, 0, 0, 0, 0]));

            expect(res.status).toBe(200);
            expect(res.body.map((c: { peso: number }) => c.peso)).toEqual([0.3333, 0.3333, 0.3334, 0, 0, 0, 0]);
        });

        test.each([
            ["soma diferente de 1", todos([0.5, 0.5, 0.5, 0, 0, 0, 0]), 400],
            ["faltando critério", todos([0.5, 0.5]), 400],
            ["critério inexistente", { pesos: [...todos([1, 0, 0, 0, 0, 0, 0]).pesos, { id: 99, peso: 0 }] }, 404],
            ["mais de 4 casas decimais", todos([0.12345, 0.87655, 0, 0, 0, 0, 0]), 400],
            ["sem lista", {}, 400],
        ])("%s retorna %s", async (_, corpo, status) => {
            expect((await request(app).put("/api/criterios/pesos").set("Authorization", pesquisador.token).send(corpo)).status).toBe(status);
        });
    });
});
