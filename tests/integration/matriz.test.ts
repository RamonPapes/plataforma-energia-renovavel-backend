import request from "supertest";
import { app } from "../../src/app";
import { AppDataSource } from "../../src/database/data-source";
import { Perfil } from "../../src/models/Usuario";
import { usarBancoDeTeste, criarUsuario, criarMunicipio } from "../helpers/banco";

describe("Matriz de decisão", () => {
    usarBancoDeTeste();

    let pesquisador: Awaited<ReturnType<typeof criarUsuario>>;
    let salvador: number;
    let feira: number;
    beforeEach(async () => {
        pesquisador = await criarUsuario(Perfil.PESQUISADOR);
        salvador = (await criarMunicipio({ nome: "Salvador" })).id;
        feira = (await criarMunicipio({ nome: "Feira de Santana" })).id;
    });

    const gravar = (corpo: object) => request(app).post("/api/matriz").set("Authorization", pesquisador.token).send(corpo);

    test("grava em lote e devolve a matriz como tabela (null onde não há valor)", async () => {
        const res = await gravar({ ano: 2022, valores: [
            { municipioId: salvador, criterioId: 1, valor: 12.5 },
            { municipioId: salvador, criterioId: 2, valor: 0.8 },
            { municipioId: feira, criterioId: 1, valor: 20 },
        ] });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ gravados: 3, removidos: 0 });

        const matriz = await request(app).get("/api/matriz?ano=2022&criterios=1,2").set("Authorization", pesquisador.token);
        expect(matriz.body.criterios.map((c: { id: number }) => c.id)).toEqual([1, 2]);
        expect(matriz.body.linhas).toEqual([
            { municipio: { id: feira, nome: "Feira de Santana", uf: "BA" }, valores: [20, null] },
            { municipio: { id: salvador, nome: "Salvador", uf: "BA" }, valores: [12.5, 0.8] },
        ]);
    });

    test("gravar a mesma célula atualiza o valor (upsert), sem duplicar", async () => {
        await gravar({ ano: 2022, valores: [{ municipioId: salvador, criterioId: 1, valor: 10 }] });
        await gravar({ ano: 2022, valores: [{ municipioId: salvador, criterioId: 1, valor: 99 }] });

        const [{ total, valor }] = await AppDataSource.query("SELECT COUNT(*) total, MAX(valor) valor FROM matriz_decisao");

        expect(Number(total)).toBe(1);
        expect(Number(valor)).toBe(99);
    });

    test("valor null remove a célula", async () => {
        await gravar({ ano: 2022, valores: [{ municipioId: salvador, criterioId: 1, valor: 10 }] });

        const res = await gravar({ ano: 2022, valores: [{ municipioId: salvador, criterioId: 1, valor: null }] });

        expect(res.body).toEqual({ gravados: 0, removidos: 1 });
    });

    test("o ano pode vir em cada item; GET /matriz/anos lista do mais recente ao mais antigo", async () => {
        await gravar({ valores: [
            { municipioId: salvador, criterioId: 1, ano: 2021, valor: 1 },
            { municipioId: salvador, criterioId: 1, ano: 2022, valor: 2 },
        ] });

        const anos = await request(app).get("/api/matriz/anos").set("Authorization", pesquisador.token);
        const semAno = await request(app).get("/api/matriz?municipios=" + salvador).set("Authorization", pesquisador.token);

        expect(anos.body).toEqual([2022, 2021]);
        // sem ano, usa o mais recente
        expect(semAno.body.ano).toBe(2022);
        expect(semAno.body.linhas[0].valores[0]).toBe(2);
    });

    test("matriz vazia devolve ano null", async () => {
        const res = await request(app).get("/api/matriz").set("Authorization", pesquisador.token);

        expect(res.body).toEqual({ ano: null, criterios: [], linhas: [] });
    });

    test("GET /municipios/:id/indicadores lista os valores do município com o critério", async () => {
        await gravar({ ano: 2022, valores: [{ municipioId: salvador, criterioId: 3, valor: 1850 }] });

        const res = await request(app).get(`/api/municipios/${salvador}/indicadores?ano=2022`).set("Authorization", pesquisador.token);

        expect(res.body).toEqual([{ ano: 2022, criterio: { id: 3, nome: "Renda per capita", tipo: "BENEFICIO", unidade: "R$" }, valor: 1850 }]);
        expect((await request(app).get("/api/municipios/999/indicadores").set("Authorization", pesquisador.token)).status).toBe(404);
        expect((await request(app).get(`/api/municipios/${salvador}/indicadores`).set("Authorization", pesquisador.token)).body).toHaveLength(1);
    });

    test.each([
        ["sem lista", { ano: 2022 }, 400],
        ["sem ano", { valores: [{ municipioId: 1, criterioId: 1, valor: 1 }] }, 400],
        ["valor não numérico", { ano: 2022, valores: [{ municipioId: 1, criterioId: 1, valor: "abc" }] }, 400],
        ["célula repetida", { ano: 2022, valores: [{ municipioId: 1, criterioId: 1, valor: 1 }, { municipioId: 1, criterioId: 1, valor: 2 }] }, 400],
        ["município inexistente", { ano: 2022, valores: [{ municipioId: 999, criterioId: 1, valor: 1 }] }, 404],
        ["critério inexistente", { ano: 2022, valores: [{ municipioId: 1, criterioId: 999, valor: 1 }] }, 404],
    ])("%s retorna %s", async (_, corpo, status) => {
        expect((await gravar(corpo)).status).toBe(status);
    });

    test("mais de 5.000 valores retorna 400; filtro com município inexistente, 404", async () => {
        const valores = Array.from({ length: 5001 }, (_, i) => ({ municipioId: 1, criterioId: 1, ano: 1900 + (i % 200), valor: i }));

        expect((await gravar({ valores })).status).toBe(400);
        expect((await request(app).get("/api/matriz?ano=2022&municipios=999").set("Authorization", pesquisador.token)).status).toBe(404);
    });

    test("gestor público só consulta: 403 ao gravar", async () => {
        const gestor = await criarUsuario(Perfil.GESTOR_PUBLICO);

        const res = await request(app).post("/api/matriz").set("Authorization", gestor.token)
            .send({ ano: 2022, valores: [{ municipioId: salvador, criterioId: 1, valor: 1 }] });

        expect(res.status).toBe(403);
    });
});
