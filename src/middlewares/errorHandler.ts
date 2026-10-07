import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message });
    }

    if ((err as { type?: string }).type === "entity.parse.failed") {
        return res.status(400).json({ error: "JSON inválido no corpo da requisição." });
    }

    if ((err as { type?: string }).type === "entity.too.large") {
        return res.status(413).json({ error: "O corpo da requisição é grande demais." });
    }

    console.error(err);
    return res.status(500).json({ error: "Erro interno inesperado." });
}
