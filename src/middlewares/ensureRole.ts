import { NextFunction, Request, Response } from "express";
import { Perfil } from "../models/Usuario";

export function ensureRole(...perfisPermitidos: Perfil[]){
    return (req: Request, res: Response, next: NextFunction) => {
        if(!req.usuario || !perfisPermitidos.includes(req.usuario.perfil)) {
            return res.status(403).json({ error: "Acesso negado." });
        }
        return next();
    }
}