import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ensureAuthenticated } from "../../src/middlewares/ensureAuthenticated";
import { ensureRole } from "../../src/middlewares/ensureRole";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { AppError } from "../../src/errors/AppError";
import { Perfil } from "../../src/models/Usuario";

function mockResponse() {
    const res = {} as Response;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe("ensureAuthenticated", () => {
    test("token válido preenche req.usuario e chama next", () => {
        const token = jwt.sign({ perfil: Perfil.PESQUISADOR }, process.env.JWT_SECRET as string, { subject: "42" });
        const req = { headers: { authorization: `Bearer ${token}` } } as Request;
        const next = jest.fn();

        ensureAuthenticated(req, mockResponse(), next);

        expect(next).toHaveBeenCalled();
        expect(req.usuario).toEqual({ id: 42, perfil: Perfil.PESQUISADOR });
    });

    test.each([
        ["sem header", undefined],
        ["header sem Bearer", "Basic abc"],
        ["token inválido", "Bearer token-invalido"],
        ["token assinado com outro segredo", `Bearer ${jwt.sign({ perfil: Perfil.ADMINISTRADOR }, "outro-segredo", { subject: "1" })}`],
        ["token expirado", `Bearer ${jwt.sign({ perfil: Perfil.ADMINISTRADOR, exp: Math.floor(Date.now() / 1000) - 60 }, "segredo-dos-testes", { subject: "1" })}`],
    ])("%s retorna 401", (_, authorization) => {
        const req = { headers: { authorization } } as Request;
        const res = mockResponse();
        const next = jest.fn();

        ensureAuthenticated(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });
});

describe("ensureRole", () => {
    test("perfil permitido chama next", () => {
        const next = jest.fn();

        ensureRole(Perfil.ADMINISTRADOR, Perfil.PESQUISADOR)({ usuario: { id: 1, perfil: Perfil.PESQUISADOR } } as Request, mockResponse(), next);

        expect(next).toHaveBeenCalled();
    });

    test("perfil não permitido ou requisição sem usuário retorna 403", () => {
        for (const req of [{ usuario: { id: 1, perfil: Perfil.GESTOR_PUBLICO } }, {}] as Request[]) {
            const res = mockResponse();
            const next = jest.fn();

            ensureRole(Perfil.ADMINISTRADOR)(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        }
    });
});

describe("errorHandler", () => {
    const next = jest.fn() as NextFunction;

    test("AppError usa o statusCode do erro (400 por padrão)", () => {
        const res = mockResponse();
        errorHandler(new AppError("Duplicado", 409), {} as Request, res, next);
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({ error: "Duplicado" });

        const res400 = mockResponse();
        errorHandler(new AppError("Inválido"), {} as Request, res400, next);
        expect(res400.status).toHaveBeenCalledWith(400);
    });

    test("erro desconhecido retorna 500 sem expor a mensagem interna", () => {
        const res = mockResponse();
        jest.spyOn(console, "error").mockImplementation(() => {});

        errorHandler(new Error("detalhe interno do banco"), {} as Request, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "Erro interno inesperado." });
    });
});
