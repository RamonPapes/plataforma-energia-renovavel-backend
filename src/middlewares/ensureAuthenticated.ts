import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Perfil } from "../models/Usuario";

interface IPayload {
    sub: string,
    perfil: Perfil
}

export function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token não informado" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const { sub, perfil } = jwt.verify(token, process.env.JWT_SECRET as string) as IPayload;
        req.usuario = { id: Number(sub), perfil };
        return next();
    } catch {
        return res.status(401).json({error: "Token inválido ou expirado."});
    }
}