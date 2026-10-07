import { Request, Response } from "express";
import { AuthService } from "../services/AuthService";

class AuthController {
    async loginHandle(req: Request, res: Response) {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ error: "Email e Senha são obrigatórios" });
        }

        if (email.length > 150) {
            return res.status(400).json({ error: "O campo email não pode conter mais que 150 caracteres" });
        }

        const authService = new AuthService();

        const { token, usuario } = await authService.login({ email, senha });

        return res.status(200).json({ token, usuario });
    }
}

export { AuthController };