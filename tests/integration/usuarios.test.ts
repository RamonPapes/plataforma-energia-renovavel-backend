import request from "supertest";
import { app } from "../../src/app";
import { AppDataSource } from "../../src/database/data-source";
import { Perfil } from "../../src/models/Usuario";
import { usarBancoDeTeste, admin, criarUsuario, token, SENHA_PADRAO } from "../helpers/banco";

describe("Usuários", () => {
    usarBancoDeTeste();

    describe("POST /api/usuarios", () => {
        test("administrador cadastra usuário (e-mail normalizado, perfil padrão PESQUISADOR, sem expor a senha)", async () => {
            const { token: tokenAdmin } = await admin();

            const res = await request(app).post("/api/usuarios").set("Authorization", tokenAdmin)
                .send({ nome: " Maria ", email: " Maria@Teste.Local ", senha: "senha123" });

            expect(res.status).toBe(201);
            expect(res.body).toMatchObject({ nome: "Maria", email: "maria@teste.local", perfil: "PESQUISADOR" });
            expect(res.body).not.toHaveProperty("senha");
        });

        test("e-mail duplicado (com outra caixa) retorna 409", async () => {
            const { token: tokenAdmin } = await admin();

            const res = await request(app).post("/api/usuarios").set("Authorization", tokenAdmin)
                .send({ nome: "Outro", email: "ADMIN@teste.local", senha: "senha123" });

            expect(res.status).toBe(409);
        });

        test.each([
            ["sem nome", { email: "a@teste.local", senha: "senha123" }],
            ["nome longo demais", { nome: "a".repeat(151), email: "a@teste.local", senha: "senha123" }],
            ["e-mail inválido", { nome: "A", email: "invalido", senha: "senha123" }],
            ["e-mail longo demais", { nome: "A", email: `${"a".repeat(150)}@t.com`, senha: "senha123" }],
            ["senha curta", { nome: "A", email: "a@teste.local", senha: "123" }],
            ["perfil inválido", { nome: "A", email: "a@teste.local", senha: "senha123", perfil: "ROOT" }],
        ])("%s retorna 400", async (_, corpo) => {
            const { token: tokenAdmin } = await admin();

            const res = await request(app).post("/api/usuarios").set("Authorization", tokenAdmin).send(corpo);

            expect(res.status).toBe(400);
        });

        test("perfil diferente de ADMINISTRADOR retorna 403 e sem token, 401", async () => {
            const pesquisador = await criarUsuario(Perfil.PESQUISADOR);
            const corpo = { nome: "A", email: "a@teste.local", senha: "senha123" };

            expect((await request(app).post("/api/usuarios").set("Authorization", pesquisador.token).send(corpo)).status).toBe(403);
            expect((await request(app).post("/api/usuarios").send(corpo)).status).toBe(401);
        });
    });

    describe("consultas", () => {
        test("GET /api/usuarios lista paginada ordenada por nome, com filtro por perfil", async () => {
            const { token: tokenAdmin } = await admin();
            await criarUsuario(Perfil.PESQUISADOR);
            await criarUsuario(Perfil.GESTOR_PUBLICO);

            const todos = await request(app).get("/api/usuarios").set("Authorization", tokenAdmin);
            const gestores = await request(app).get("/api/usuarios?perfil=GESTOR_PUBLICO").set("Authorization", tokenAdmin);
            const pagina = await request(app).get("/api/usuarios?limit=1&page=2").set("Authorization", tokenAdmin);

            expect(todos.body).toMatchObject({ total: 3, page: 1, limit: 50 });
            expect(todos.body.data.map((u: { nome: string }) => u.nome)).toEqual(["Admin Teste", "Usuário GESTOR_PUBLICO", "Usuário PESQUISADOR"]);
            expect(gestores.body.data).toHaveLength(1);
            expect(pagina.body.data).toHaveLength(1);
            expect((await request(app).get("/api/usuarios?perfil=XX").set("Authorization", tokenAdmin)).status).toBe(400);
        });

        test("GET /api/usuarios/me devolve o usuário do token", async () => {
            const gestor = await criarUsuario(Perfil.GESTOR_PUBLICO);

            const res = await request(app).get("/api/usuarios/me").set("Authorization", gestor.token);

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ id: gestor.id, perfil: "GESTOR_PUBLICO" });
        });

        test("GET /api/usuarios/:id encontra o usuário ou retorna 404/400", async () => {
            const { token: tokenAdmin } = await admin();

            expect((await request(app).get("/api/usuarios/1").set("Authorization", tokenAdmin)).status).toBe(200);
            expect((await request(app).get("/api/usuarios/999").set("Authorization", tokenAdmin)).status).toBe(404);
            expect((await request(app).get("/api/usuarios/abc").set("Authorization", tokenAdmin)).status).toBe(400);
        });
    });

    describe("PUT /api/usuarios/:id", () => {
        test("administrador edita nome, e-mail e perfil", async () => {
            const { token: tokenAdmin } = await admin();
            const pesquisador = await criarUsuario(Perfil.PESQUISADOR);

            const res = await request(app).put(`/api/usuarios/${pesquisador.id}`).set("Authorization", tokenAdmin)
                .send({ nome: "Gestora", email: "gestora@teste.local", perfil: "GESTOR_PUBLICO" });

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ nome: "Gestora", email: "gestora@teste.local", perfil: "GESTOR_PUBLICO" });
        });

        test("e-mail de outro usuário retorna 409 e usuário inexistente, 404", async () => {
            const { token: tokenAdmin } = await admin();
            const pesquisador = await criarUsuario(Perfil.PESQUISADOR);
            const corpo = { nome: "X", email: "admin@teste.local", perfil: "PESQUISADOR" };

            expect((await request(app).put(`/api/usuarios/${pesquisador.id}`).set("Authorization", tokenAdmin).send(corpo)).status).toBe(409);
            expect((await request(app).put("/api/usuarios/999").set("Authorization", tokenAdmin).send({ ...corpo, email: "x@teste.local" })).status).toBe(404);
        });

        test("administrador não pode rebaixar o próprio perfil (403)", async () => {
            const { token: tokenAdmin } = await admin();

            const res = await request(app).put("/api/usuarios/1").set("Authorization", tokenAdmin)
                .send({ nome: "Admin", email: "admin@teste.local", perfil: "PESQUISADOR" });

            expect(res.status).toBe(403);
        });

        test("pode rebaixar outro administrador quando há mais de um", async () => {
            const { token: tokenAdmin } = await admin();
            const outroAdmin = await criarUsuario(Perfil.ADMINISTRADOR);

            const res = await request(app).put(`/api/usuarios/${outroAdmin.id}`).set("Authorization", tokenAdmin)
                .send({ nome: "Ex-admin", email: outroAdmin.email, perfil: "PESQUISADOR" });

            expect(res.status).toBe(200);
        });

        test("o sistema não pode ficar sem administrador, mesmo com token antigo de um ex-admin (409)", async () => {
            const exAdmin = await criarUsuario(Perfil.PESQUISADOR);
            // token emitido quando ele ainda era ADMINISTRADOR
            const tokenAntigo = token(exAdmin.id, Perfil.ADMINISTRADOR);

            const rebaixar = await request(app).put("/api/usuarios/1").set("Authorization", tokenAntigo)
                .send({ nome: "Admin", email: "admin@teste.local", perfil: "PESQUISADOR" });
            const remover = await request(app).delete("/api/usuarios/1").set("Authorization", tokenAntigo);

            expect(rebaixar.status).toBe(409);
            expect(remover.status).toBe(409);
        });
    });

    describe("DELETE /api/usuarios/:id", () => {
        test("administrador remove usuário", async () => {
            const { token: tokenAdmin } = await admin();
            const pesquisador = await criarUsuario(Perfil.PESQUISADOR);

            expect((await request(app).delete(`/api/usuarios/${pesquisador.id}`).set("Authorization", tokenAdmin)).status).toBe(204);
            expect((await request(app).get(`/api/usuarios/${pesquisador.id}`).set("Authorization", tokenAdmin)).status).toBe(404);
        });

        test("administrador não pode remover a própria conta (403) e usuário inexistente retorna 404", async () => {
            const { token: tokenAdmin } = await admin();

            expect((await request(app).delete("/api/usuarios/1").set("Authorization", tokenAdmin)).status).toBe(403);
            expect((await request(app).delete("/api/usuarios/999").set("Authorization", tokenAdmin)).status).toBe(404);
        });
    });

    describe("PATCH /api/usuarios/me/senha", () => {
        test("troca a própria senha conferindo a atual", async () => {
            const pesquisador = await criarUsuario(Perfil.PESQUISADOR);

            const res = await request(app).patch("/api/usuarios/me/senha").set("Authorization", pesquisador.token)
                .send({ senhaAtual: SENHA_PADRAO, novaSenha: "novaSenha1" });

            expect(res.status).toBe(204);
            expect((await request(app).post("/api/login").send({ email: pesquisador.email, senha: "novaSenha1" })).status).toBe(200);
        });

        test("senha atual errada retorna 400 (não 401, para o front não deslogar)", async () => {
            const pesquisador = await criarUsuario(Perfil.PESQUISADOR);

            const res = await request(app).patch("/api/usuarios/me/senha").set("Authorization", pesquisador.token)
                .send({ senhaAtual: "errada", novaSenha: "novaSenha1" });

            expect(res.status).toBe(400);
        });

        test("sem a senha atual ou com nova senha curta retorna 400; usuário do token inexistente, 404", async () => {
            const pesquisador = await criarUsuario(Perfil.PESQUISADOR);
            const tokenUsuarioApagado = token(999, Perfil.PESQUISADOR);

            expect((await request(app).patch("/api/usuarios/me/senha").set("Authorization", pesquisador.token).send({ novaSenha: "novaSenha1" })).status).toBe(400);
            expect((await request(app).patch("/api/usuarios/me/senha").set("Authorization", pesquisador.token).send({ senhaAtual: SENHA_PADRAO, novaSenha: "1" })).status).toBe(400);
            expect((await request(app).patch("/api/usuarios/me/senha").set("Authorization", tokenUsuarioApagado).send({ senhaAtual: SENHA_PADRAO, novaSenha: "novaSenha1" })).status).toBe(404);
        });
    });

    test("usuário que executou simulação não pode ser removido (409)", async () => {
        const { token: tokenAdmin } = await admin();
        const pesquisador = await criarUsuario(Perfil.PESQUISADOR);
        await AppDataSource.query(
            "INSERT INTO simulacoes (usuario_id, ano_referencia, parametros) VALUES (?, 2022, '{}')", [pesquisador.id]
        );

        const res = await request(app).delete(`/api/usuarios/${pesquisador.id}`).set("Authorization", tokenAdmin);

        expect(res.status).toBe(409);
    });
});
