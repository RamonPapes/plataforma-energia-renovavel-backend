import request from "supertest";
import { app } from "../../src/app";
import { AppDataSource } from "../../src/database/data-source";
import { Perfil } from "../../src/models/Usuario";
import { usarBancoDeTeste, criarUsuario, criarMunicipio, cadastrarExemploRoteiro, EXEMPLO_ROTEIRO } from "../helpers/banco";

describe("TOPSIS e simulações (UC03, RF04, RF10)", () => {
    usarBancoDeTeste();

    let gestor: Awaited<ReturnType<typeof criarUsuario>>;
    let municipios: { A: number; B: number; C: number };
    beforeEach(async () => {
        gestor = await criarUsuario(Perfil.GESTOR_PUBLICO);
        municipios = await cadastrarExemploRoteiro();
    });

    const executar = (corpo?: object) => request(app).post("/api/topsis/executar").set("Authorization", gestor.token).send(corpo);
    const exemplo = { ano: EXEMPLO_ROTEIRO.ano, criterios: [1, 2, 3, 4, 5], pesos: EXEMPLO_ROTEIRO.pesos };

    test("exemplo 7.3 do roteiro pela API: B > A > C, com Ci, distâncias e faixas", async () => {
        const res = await executar(exemplo);

        expect(res.status).toBe(201);
        expect(res.body.ranking.map((r: { municipio: { nome: string } }) => r.municipio.nome)).toEqual(["Município B", "Município A", "Município C"]);
        const [b, a, c] = res.body.ranking;
        expect(a.ci).toBeCloseTo(0.336058, 6);
        expect(b).toMatchObject({ posicao: 1, ci: 1, faixa: "BAIXA" });
        expect(c).toMatchObject({ posicao: 3, ci: 0, faixa: "MUITO_ALTA" });
        expect(res.body.usuario).toEqual({ id: gestor.id, nome: "Usuário GESTOR_PUBLICO" });
    });

    test("guarda uma cópia dos parâmetros: alterar os critérios depois não muda a simulação", async () => {
        const { body } = await executar(exemplo);
        await AppDataSource.query("UPDATE criterios SET nome = 'Renomeado' WHERE id = 1");

        const salva = await request(app).get(`/api/simulacoes/${body.id}`).set("Authorization", gestor.token);

        expect(salva.body.parametros).toMatchObject({ ano: 2022, municipiosSelecionados: null, pesosPersonalizados: true, ignorados: [] });
        expect(salva.body.parametros.criterios[0]).toMatchObject({ id: 1, nome: "% domicílios sem acesso à eletricidade", peso: 0.2 });
    });

    test("sem pesos na requisição, usa os pesos salvos reescalados para os critérios escolhidos", async () => {
        const res = await executar({ criterios: [1, 2, 3, 4, 5] });

        expect(res.status).toBe(201);
        expect(res.body.ano_referencia).toBe(2022);
        expect(res.body.parametros.pesosPersonalizados).toBe(false);
        expect(res.body.parametros.criterios.map((c: { peso: number }) => c.peso)).toEqual([0.2, 0.2, 0.2, 0.2, 0.2]);
    });

    test("município sem todos os valores fica fora do ranking e aparece em ignorados", async () => {
        const incompleto = await criarMunicipio({ nome: "Município D" });
        await AppDataSource.query("INSERT INTO matriz_decisao (municipio_id, criterio_id, valor, ano_referencia) VALUES (?, 1, 8, 2022)", [incompleto.id]);

        const res = await executar({ criterios: [1, 2, 3, 4, 5] });

        expect(res.body.ranking).toHaveLength(3);
        expect(res.body.parametros.ignorados).toEqual([{ id: incompleto.id, nome: "Município D", uf: "BA", criteriosFaltando: [2, 3, 4, 5] }]);
    });

    test("filtra os municípios da simulação", async () => {
        const res = await executar({ ...exemplo, municipios: [municipios.A, municipios.C] });

        expect(res.body.ranking.map((r: { municipio: { id: number } }) => r.municipio.id)).toEqual([municipios.A, municipios.C]);
        expect(res.body.parametros.municipiosSelecionados).toEqual([municipios.A, municipios.C]);
    });

    test.each([
        ["pesos somando 0.9", { ...exemplo, pesos: EXEMPLO_ROTEIRO.pesos.map((p, i) => (i === 0 ? { ...p, peso: 0.1 } : p)) }, 400],
        ["peso de critério fora da simulação", { criterios: [1, 2], pesos: [{ id: 1, peso: 0.5 }, { id: 3, peso: 0.5 }] }, 400],
        ["faltando peso de critério da simulação", { criterios: [1, 2], pesos: [{ id: 1, peso: 1 }] }, 400],
        ["critério inexistente", { criterios: [999] }, 404],
        ["município inexistente", { municipios: [999] }, 404],
        ["ano sem dados", { ano: 1901 }, 422],
    ])("%s retorna %s", async (_, corpo, status) => {
        expect((await executar(corpo)).status).toBe(status);
    });

    test("com menos de 2 municípios completos retorna 422", async () => {
        const res = await executar({ ...exemplo, municipios: [municipios.A] });

        expect(res.status).toBe(422);
        expect(res.body.error).toMatch(/ao menos 2 municípios/);
    });

    test("critérios selecionados com peso 0 e matriz vazia retornam 422", async () => {
        await AppDataSource.query("UPDATE criterios SET peso = 0 WHERE id IN (1, 2)");
        expect((await executar({ criterios: [1, 2] })).status).toBe(422);

        await AppDataSource.query("DELETE FROM matriz_decisao");
        expect((await executar()).status).toBe(422);
    });

    test("sem critérios cadastrados retorna 422", async () => {
        await AppDataSource.query("DELETE FROM matriz_decisao");
        await AppDataSource.query("DELETE FROM criterios");

        expect((await executar({ ano: 2022 })).status).toBe(422);
    });

    test("sem token retorna 401", async () => {
        expect((await request(app).post("/api/topsis/executar").send(exemplo)).status).toBe(401);
    });

    describe("histórico (RF10)", () => {
        test("lista da mais recente para a mais antiga, com filtros por usuário e ano", async () => {
            const pesquisador = await criarUsuario(Perfil.PESQUISADOR);
            const primeira = (await executar(exemplo)).body;
            const segunda = (await request(app).post("/api/topsis/executar").set("Authorization", pesquisador.token).send(exemplo)).body;

            const todas = await request(app).get("/api/simulacoes").set("Authorization", gestor.token);
            const doPesquisador = await request(app).get(`/api/simulacoes?usuarioId=${pesquisador.id}`).set("Authorization", gestor.token);
            const outroAno = await request(app).get("/api/simulacoes?ano=2000").set("Authorization", gestor.token);

            expect(todas.body.data.map((s: { id: number }) => s.id)).toEqual([segunda.id, primeira.id]);
            expect(todas.body.data[0]).toMatchObject({ ano_referencia: 2022, status: "CONCLUIDA", totalMunicipios: 3, usuario: { id: pesquisador.id } });
            expect(doPesquisador.body.total).toBe(1);
            expect(outroAno.body).toMatchObject({ data: [], total: 0 });
        });

        test("simulação inexistente retorna 404", async () => {
            expect((await request(app).get("/api/simulacoes/999").set("Authorization", gestor.token)).status).toBe(404);
        });
    });

    test("RNF01: TOPSIS com 500 municípios x 7 critérios responde em menos de 3 segundos", async () => {
        await AppDataSource.query(
            "INSERT INTO municipios (nome, uf) VALUES " + Array.from({ length: 500 }, (_, i) => `('Município ${i}', 'SP')`).join(",")
        );
        await AppDataSource.query(
            "INSERT INTO matriz_decisao (municipio_id, criterio_id, valor, ano_referencia) " +
            "SELECT m.id, c.id, (m.id * 7 + c.id * 13) % 101, 2030 FROM municipios m CROSS JOIN criterios c WHERE m.uf = 'SP'"
        );

        const inicio = performance.now();
        const res = await executar({ ano: 2030 });

        expect(res.status).toBe(201);
        expect(res.body.ranking).toHaveLength(500);
        expect(performance.now() - inicio).toBeLessThan(3000);
    });
});
