import request from "supertest";
import { app } from "../../src/app";
import { AppDataSource } from "../../src/database/data-source";
import { Perfil } from "../../src/models/Usuario";
import { usarBancoDeTeste, admin, criarUsuario, criarMunicipio } from "../helpers/banco";

const SALVADOR = { nome: "Salvador", uf: "BA", populacao: 2417678, idh: 0.759, latitude: -12.9714, longitude: -38.5014 };

describe("Municípios (UC01)", () => {
    usarBancoDeTeste();

    describe("POST /api/municipios", () => {
        test("administrador cadastra município; IDH volta como número e coordenadas como latitude/longitude", async () => {
            const { token } = await admin();

            const res = await request(app).post("/api/municipios").set("Authorization", token).send({ ...SALVADOR, nome: " Salvador ", uf: "ba" });

            expect(res.status).toBe(201);
            expect(res.body).toMatchObject({ ...SALVADOR, id: expect.any(Number) });
            expect(res.body).not.toHaveProperty("coordenadas");
        });

        test("coordenadas são gravadas como POINT(longitude latitude)", async () => {
            const { token } = await admin();
            const { body } = await request(app).post("/api/municipios").set("Authorization", token).send(SALVADOR);

            const [linha] = await AppDataSource.query("SELECT ST_X(coordenadas) x, ST_Y(coordenadas) y FROM municipios WHERE id = ?", [body.id]);

            expect(linha).toEqual({ x: -38.5014, y: -12.9714 });
        });

        test("mesmo nome e UF (com outra caixa) retorna 409", async () => {
            const { token } = await admin();
            await criarMunicipio({ nome: "Salvador" });

            const res = await request(app).post("/api/municipios").set("Authorization", token).send({ nome: "SALVADOR", uf: "BA" });

            expect(res.status).toBe(409);
        });

        test.each([
            ["sem nome", { uf: "BA" }],
            ["nome longo demais", { nome: "a".repeat(201), uf: "BA" }],
            ["UF inexistente", { nome: "X", uf: "XX" }],
            ["população negativa", { nome: "X", uf: "BA", populacao: -1 }],
            ["população fracionada", { nome: "X", uf: "BA", populacao: 1.5 }],
            ["IDH acima de 1", { nome: "X", uf: "BA", idh: 1.2 }],
            ["latitude sem longitude", { nome: "X", uf: "BA", latitude: -12 }],
            ["latitude fora do intervalo", { nome: "X", uf: "BA", latitude: -91, longitude: 0 }],
            ["longitude fora do intervalo", { nome: "X", uf: "BA", latitude: 0, longitude: 181 }],
        ])("%s retorna 400", async (_, corpo) => {
            const { token } = await admin();

            const res = await request(app).post("/api/municipios").set("Authorization", token).send(corpo);

            expect(res.status).toBe(400);
        });

        test("perfil diferente de ADMINISTRADOR retorna 403", async () => {
            const gestor = await criarUsuario(Perfil.GESTOR_PUBLICO);

            const res = await request(app).post("/api/municipios").set("Authorization", gestor.token).send(SALVADOR);

            expect(res.status).toBe(403);
        });
    });

    describe("consultas (qualquer perfil autenticado)", () => {
        test("GET /api/municipios lista paginada por nome, com filtro por UF", async () => {
            const gestor = await criarUsuario(Perfil.GESTOR_PUBLICO);
            await criarMunicipio({ nome: "Salvador" });
            await criarMunicipio({ nome: "Feira de Santana" });
            await criarMunicipio({ nome: "Recife", uf: "PE" });

            const todos = await request(app).get("/api/municipios").set("Authorization", gestor.token);
            const bahia = await request(app).get("/api/municipios?uf=ba&limit=1").set("Authorization", gestor.token);

            expect(todos.body.data.map((m: { nome: string }) => m.nome)).toEqual(["Feira de Santana", "Recife", "Salvador"]);
            expect(bahia.body).toMatchObject({ total: 2, page: 1, limit: 1 });
            expect(bahia.body.data[0].nome).toBe("Feira de Santana");
        });

        test.each([["?uf=XX"], ["?limit=501"], ["?page=0"]])("GET /api/municipios%s retorna 400", async parametros => {
            const gestor = await criarUsuario(Perfil.GESTOR_PUBLICO);

            expect((await request(app).get(`/api/municipios${parametros}`).set("Authorization", gestor.token)).status).toBe(400);
        });

        test("aceita limit de até 500 (seleção de municípios do TOPSIS)", async () => {
            const gestor = await criarUsuario(Perfil.GESTOR_PUBLICO);

            expect((await request(app).get("/api/municipios?limit=500").set("Authorization", gestor.token)).status).toBe(200);
        });

        test("GET /api/municipios/:id encontra o município ou retorna 404/400; sem token, 401", async () => {
            const gestor = await criarUsuario(Perfil.GESTOR_PUBLICO);
            const municipio = await criarMunicipio({ nome: "Salvador" });

            expect((await request(app).get(`/api/municipios/${municipio.id}`).set("Authorization", gestor.token)).body.nome).toBe("Salvador");
            expect((await request(app).get("/api/municipios/999").set("Authorization", gestor.token)).status).toBe(404);
            expect((await request(app).get("/api/municipios/abc").set("Authorization", gestor.token)).status).toBe(400);
            expect((await request(app).get("/api/municipios")).status).toBe(401);
        });
    });

    describe("PUT /api/municipios/:id", () => {
        test("substitui o registro inteiro: campos omitidos viram null", async () => {
            const { token } = await admin();
            const municipio = await criarMunicipio({ nome: "Salvador", populacao: 100, idh: 0.7 });

            const res = await request(app).put(`/api/municipios/${municipio.id}`).set("Authorization", token).send({ nome: "Salvador", uf: "BA", idh: 0.8 });

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ idh: 0.8, populacao: null, latitude: null, longitude: null });
        });

        test("nome e UF de outro município retornam 409; inexistente, 404", async () => {
            const { token } = await admin();
            await criarMunicipio({ nome: "Salvador" });
            const feira = await criarMunicipio({ nome: "Feira de Santana" });

            expect((await request(app).put(`/api/municipios/${feira.id}`).set("Authorization", token).send({ nome: "Salvador", uf: "BA" })).status).toBe(409);
            expect((await request(app).put("/api/municipios/999").set("Authorization", token).send({ nome: "Outro", uf: "BA" })).status).toBe(404);
        });
    });

    describe("DELETE /api/municipios/:id", () => {
        test("remove o município", async () => {
            const { token } = await admin();
            const municipio = await criarMunicipio({ nome: "Salvador" });

            expect((await request(app).delete(`/api/municipios/${municipio.id}`).set("Authorization", token)).status).toBe(204);
            expect((await request(app).delete(`/api/municipios/${municipio.id}`).set("Authorization", token)).status).toBe(404);
        });

        test("município com valores na matriz de decisão não pode ser removido (409)", async () => {
            const { token } = await admin();
            const municipio = await criarMunicipio({ nome: "Salvador" });
            await AppDataSource.query("INSERT INTO matriz_decisao (municipio_id, criterio_id, valor, ano_referencia) VALUES (?, 1, 10, 2022)", [municipio.id]);

            const res = await request(app).delete(`/api/municipios/${municipio.id}`).set("Authorization", token);

            expect(res.status).toBe(409);
        });
    });
});
