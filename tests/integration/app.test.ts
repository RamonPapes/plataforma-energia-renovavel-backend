import request from "supertest";
import { app } from "../../src/app";
import { usarBancoDeTeste, admin } from "../helpers/banco";

describe("Aplicação", () => {
    usarBancoDeTeste();

    test("rota inexistente retorna 404 em JSON", async () => {
        const res = await request(app).get("/api/rota-que-nao-existe");

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Rota não encontrada." });
    });

    test("rotas sem o prefixo /api não existem", async () => {
        const res = await request(app).get("/municipios");

        expect(res.status).toBe(404);
    });

    test("JSON malformado retorna 400", async () => {
        const res = await request(app).post("/api/login").set("Content-Type", "application/json").send("{ email: ");

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "JSON inválido no corpo da requisição." });
    });

    test("corpo maior que 1 MB retorna 413", async () => {
        const { token } = await admin();

        const res = await request(app)
            .post("/api/matriz")
            .set("Authorization", token)
            .set("Content-Type", "application/json")
            .send(JSON.stringify({ texto: "a".repeat(1_100_000) }));

        expect(res.status).toBe(413);
    });

    test("serve o Swagger UI e a especificação OpenAPI", async () => {
        const pagina = await request(app).get("/api/docs/");
        const especificacao = await request(app).get("/api/docs.json");

        expect(pagina.status).toBe(200);
        expect(pagina.headers["content-type"]).toMatch(/text\/html/);
        expect(especificacao.status).toBe(200);
        expect(especificacao.body.openapi).toBe("3.0.3");
    });
});
