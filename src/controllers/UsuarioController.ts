import { Request, Response } from "express";
import { UsuarioService } from "../services/UsuarioService";
import { Perfil } from "../models/Usuario";


class UsuarioController {
    async createUserHandle(req: Request, res: Response) {
        const { nome, email, senha, perfil = Perfil.PESQUISADOR } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ error: "Nome, Email e Senha são obrigatórios" });
        }

        if (nome.length > 150) {
            return res.status(400).json({ error: "O campo nome deve ter no máximo 150 caracteres" });
        }

        if (email.length > 150) {
            return res.status(400).json({ error: "O campo email deve ter no máximo 150 caracteres" });
        }

        if (!Object.values(Perfil).includes(perfil)) {
            return res.status(400).json({ error: "Perfil inválido." });
        }


        const usuarioService = new UsuarioService();

        try {
            const user = await usuarioService.createUsuario({
                nome, email, senha, perfil
            })

            return res.status(201).json(user);
        } catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            return res.status(400).json({ error: "Erro interno inesperado." });
        }

    }
}

export { UsuarioController };