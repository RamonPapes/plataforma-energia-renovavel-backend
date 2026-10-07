import request from "supertest";
import { app } from "../../src/app";
import { AppDataSource } from "../../src/database/data-source";
import { Perfil } from "../../src/models/Usuario";
import { usarBancoDeTeste, criarUsuario, SENHA_PADRAO } from "../helpers/banco";

describe("Autenticação", () => {
    usarBancoDeTeste();

    describe("POST /api/login", () => {
        test("credenciais válidas devolvem token e dados do usuário, sem a senha", async () => {
            const res = await request(app).post("/api/login").send({ email: "admin@teste.local", senha: "admin123" });

            expect(res.status).toBe(200);
            expect(res.body.token).toEqual(expect.any(String));
            expect(res.body.usuario).toEqual({ id: 1, nome: "Admin Teste", email: "admin@teste.local", perfil: "ADMINISTRADOR" });
        });

        test("e-mail não diferencia maiúsculas e espaços nas pontas", async () => {
            const res = await request(app).post("/api/login").send({ email: "  ADMIN@Teste.Local ", senha: "admin123" });

            expect(res.status).toBe(200);
        });

        test("o token devolvido dá acesso às rotas protegidas", async () => {
            const login = await request(app).post("/api/login").send({ email: "admin@teste.local", senha: "admin123" });

            const res = await request(app).get("/api/usuarios/me").set("Authorization", `Bearer ${login.body.token}`);

            expect(res.status).toBe(200);
            expect(res.body.email).toBe("admin@teste.local");
        });

        test.each([
            ["senha errada", { email: "admin@teste.local", senha: "errada" }],
            ["e-mail inexistente", { email: "ninguem@teste.local", senha: "admin123" }],
        ])("%s retorna 401", async (_, corpo) => {
            const res = await request(app).post("/api/login").send(corpo);

            expect(res.status).toBe(401);
            expect(res.body).toEqual({ error: "E-mail ou senha inválidos" });
        });

        test.each([
            ["sem corpo", undefined],
            ["sem senha", { email: "admin@teste.local" }],
            ["e-mail longo demais", { email: "a".repeat(151), senha: "123456" }],
        ])("%s retorna 400", async (_, corpo) => {
            const res = await request(app).post("/api/login").send(corpo);

            expect(res.status).toBe(400);
        });
    });

    describe("Esqueci minha senha", () => {
        async function solicitarCodigo(email = "pesquisador@teste.local") {
            return request(app).post("/api/esqueci-senha").send({ email });
        }

        beforeEach(async () => {
            await criarUsuario(Perfil.PESQUISADOR);
        });

        test("gera um código e guarda apenas o hash dele no banco", async () => {
            const res = await solicitarCodigo();

            expect(res.status).toBe(200);
            expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);
            expect(new Date(res.body.expiraEm).getTime()).toBeGreaterThan(Date.now());

            const [linha] = await AppDataSource.query("SELECT reset_senha_token FROM usuarios WHERE email = 'pesquisador@teste.local'");
            expect(linha.reset_senha_token).toHaveLength(64);
            expect(linha.reset_senha_token).not.toBe(res.body.token);
        });

        test("redefine a senha com o código: a nova senha passa a valer e a antiga não", async () => {
            const { body } = await solicitarCodigo();

            const res = await request(app).post("/api/redefinir-senha").send({ token: body.token, novaSenha: "novaSenha1" });

            expect(res.status).toBe(204);
            expect((await request(app).post("/api/login").send({ email: "pesquisador@teste.local", senha: "novaSenha1" })).status).toBe(200);
            expect((await request(app).post("/api/login").send({ email: "pesquisador@teste.local", senha: SENHA_PADRAO })).status).toBe(401);
        });

        test("o código só pode ser usado uma vez", async () => {
            const { body } = await solicitarCodigo();
            await request(app).post("/api/redefinir-senha").send({ token: body.token, novaSenha: "novaSenha1" });

            const res = await request(app).post("/api/redefinir-senha").send({ token: body.token, novaSenha: "outraSenha1" });

            expect(res.status).toBe(400);
        });

        test("um novo pedido invalida o código anterior", async () => {
            const primeiro = await solicitarCodigo();
            await solicitarCodigo();

            const res = await request(app).post("/api/redefinir-senha").send({ token: primeiro.body.token, novaSenha: "novaSenha1" });

            expect(res.status).toBe(400);
        });

        test("código expirado é recusado", async () => {
            const { body } = await solicitarCodigo();
            await AppDataSource.query("UPDATE usuarios SET reset_senha_expira_em = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE)");

            const res = await request(app).post("/api/redefinir-senha").send({ token: body.token, novaSenha: "novaSenha1" });

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/inválido ou expirado/);
        });

        test("e-mail não cadastrado retorna 404 e e-mail ausente, 400", async () => {
            expect((await solicitarCodigo("ninguem@teste.local")).status).toBe(404);
            expect((await request(app).post("/api/esqueci-senha").send({})).status).toBe(400);
        });

        test("código ausente ou nova senha curta retornam 400", async () => {
            const { body } = await solicitarCodigo();

            expect((await request(app).post("/api/redefinir-senha").send({ novaSenha: "novaSenha1" })).status).toBe(400);
            expect((await request(app).post("/api/redefinir-senha").send({ token: body.token, novaSenha: "123" })).status).toBe(400);
        });
    });
});
