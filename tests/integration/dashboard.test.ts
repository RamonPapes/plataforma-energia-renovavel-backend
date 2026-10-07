import request from "supertest";
import { app } from "../../src/app";
import { AppDataSource } from "../../src/database/data-source";
import { Perfil } from "../../src/models/Usuario";
import { usarBancoDeTeste, criarUsuario, criarMunicipio, cadastrarExemploRoteiro, EXEMPLO_ROTEIRO } from "../helpers/banco";

describe("Dashboard e mapa (RF05, RF07)", () => {
    usarBancoDeTeste();

    let gestor: Awaited<ReturnType<typeof criarUsuario>>;
    let municipios: { A: number; B: number; C: number };
    beforeEach(async () => {
        gestor = await criarUsuario(Perfil.GESTOR_PUBLICO);
        municipios = await cadastrarExemploRoteiro();
    });

    const executar = async () => (await request(app).post("/api/topsis/executar").set("Authorization", gestor.token)
        .send({ ano: EXEMPLO_ROTEIRO.ano, criterios: [1, 2, 3, 4, 5], pesos: EXEMPLO_ROTEIRO.pesos })).body;

    describe("GET /api/dashboard/resumo", () => {
        test("sem simulações, traz os totais e simulacao null", async () => {
            const res = await request(app).get("/api/dashboard/resumo").set("Authorization", gestor.token);

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ totais: { municipios: 3, criterios: 7, simulacoes: 0, anosComDados: [2022] }, simulacao: null });
        });

        test("resume a simulação mais recente: Ci médio, mais e menos vulnerável e faixas", async () => {
            await executar();
            const ultima = await executar();

            const { body } = await request(app).get("/api/dashboard/resumo").set("Authorization", gestor.token);

            expect(body.totais.simulacoes).toBe(2);
            expect(body.simulacao).toMatchObject({
                id: ultima.id,
                totalMunicipios: 3,
                municipiosIgnorados: 0,
                maisVulneravel: { municipio: { id: municipios.C }, posicao: 3, faixa: "MUITO_ALTA" },
                menosVulneravel: { municipio: { id: municipios.B }, posicao: 1, faixa: "BAIXA" },
            });
            expect(body.simulacao.ciMedio).toBeCloseTo((1 + 0.336058 + 0) / 3, 5);
            expect(body.simulacao.faixas.map((f: { faixa: string; quantidade: number }) => [f.faixa, f.quantidade]))
                .toEqual([["MUITO_ALTA", 1], ["ALTA", 1], ["MEDIA", 0], ["BAIXA", 1]]);
        });

        test("aceita uma simulação específica; inexistente retorna 404", async () => {
            const primeira = await executar();
            await executar();

            const res = await request(app).get(`/api/dashboard/resumo?simulacaoId=${primeira.id}`).set("Authorization", gestor.token);

            expect(res.body.simulacao.id).toBe(primeira.id);
            expect((await request(app).get("/api/dashboard/resumo?simulacaoId=999").set("Authorization", gestor.token)).status).toBe(404);
        });

        test("simulação sem resultados retorna 422", async () => {
            await AppDataSource.query("INSERT INTO simulacoes (usuario_id, ano_referencia, parametros) VALUES (?, 2022, ?)",
                [gestor.id, JSON.stringify({ ignorados: [], criterios: [] })]);

            expect((await request(app).get("/api/dashboard/resumo").set("Authorization", gestor.token)).status).toBe(422);
        });
    });

    describe("GeoJSON", () => {
        test("resultado da simulação: pontos [longitude, latitude] com Ci e faixa; sem coordenadas vai para metadados", async () => {
            const semCoordenadas = await criarMunicipio({ nome: "Sem coordenadas" });
            for (const [j, valor] of [10, 1.2, 1200, 0.7, 5.5].entries()) {
                await AppDataSource.query("INSERT INTO matriz_decisao (municipio_id, criterio_id, valor, ano_referencia) VALUES (?, ?, ?, 2022)", [semCoordenadas.id, j + 1, valor]);
            }
            const simulacao = await executar();

            const res = await request(app).get(`/api/simulacoes/${simulacao.id}/geojson`).set("Authorization", gestor.token);

            expect(res.status).toBe(200);
            expect(res.headers["content-type"]).toMatch(/application\/geo\+json/);
            expect(res.body.type).toBe("FeatureCollection");
            expect(res.body.features).toHaveLength(3);
            expect(res.body.features[0]).toEqual({
                type: "Feature",
                geometry: { type: "Point", coordinates: [-38.97, -12.27] },
                properties: { municipioId: municipios.B, nome: "Município B", uf: "BA", posicao: 1, ci: 1, faixa: "BAIXA", rotuloFaixa: "Vulnerabilidade baixa" },
            });
            expect(res.body.metadados).toMatchObject({ simulacaoId: simulacao.id, ano: 2022, totalMunicipios: 4 });
            expect(res.body.metadados.semCoordenadas).toEqual([{ id: semCoordenadas.id, nome: "Sem coordenadas", uf: "BA" }]);
            expect((await request(app).get("/api/simulacoes/999/geojson").set("Authorization", gestor.token)).status).toBe(404);
        });

        test("mapa base com todos os municípios", async () => {
            await criarMunicipio({ nome: "Sem coordenadas" });

            const res = await request(app).get("/api/municipios/geojson").set("Authorization", gestor.token);

            expect(res.body.features.map((f: { properties: { nome: string } }) => f.properties.nome)).toEqual(["Município A", "Município B", "Município C"]);
            expect(res.body.metadados.semCoordenadas).toHaveLength(1);
        });

        test("camada de um indicador com valor mínimo e máximo", async () => {
            const res = await request(app).get("/api/matriz/geojson?criterio=3&ano=2022").set("Authorization", gestor.token);

            expect(res.body.features.map((f: { properties: { valor: number } }) => f.properties.valor)).toEqual([980, 1850, 650]);
            expect(res.body.metadados).toMatchObject({
                ano: 2022,
                criterio: { id: 3, nome: "Renda per capita" },
                valorMinimo: 650,
                valorMaximo: 1850,
                semCoordenadas: [],
            });
        });

        test("camada de indicador: sem ano usa o mais recente; critério sem valores devolve coleção vazia", async () => {
            const res = await request(app).get("/api/matriz/geojson?criterio=7").set("Authorization", gestor.token);

            expect(res.status).toBe(200);
            expect(res.body.features).toEqual([]);
            expect(res.body.metadados).toMatchObject({ ano: 2022, valorMinimo: null, valorMaximo: null });
        });

        test("camada de indicador: sem critério retorna 400, inexistente 404 e matriz vazia 422", async () => {
            expect((await request(app).get("/api/matriz/geojson").set("Authorization", gestor.token)).status).toBe(400);
            expect((await request(app).get("/api/matriz/geojson?criterio=999").set("Authorization", gestor.token)).status).toBe(404);

            await AppDataSource.query("DELETE FROM matriz_decisao");
            expect((await request(app).get("/api/matriz/geojson?criterio=1").set("Authorization", gestor.token)).status).toBe(422);
        });
    });
});
