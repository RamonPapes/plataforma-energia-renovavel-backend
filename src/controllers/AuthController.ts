import { Request, Response } from "express";
import { AuthService } from "../services/AuthService";
import { AppError } from "../errors/AppError";
import { validarSenha } from "../utils/senha";

class AuthController {
    async loginHandle(req: Request, res: Response) {
        const { email, senha } = req.body ?? {};

        if (typeof email !== "string" || typeof senha !== "string" || !email || !senha) {
            throw new AppError("Email e Senha são obrigatórios");
        }

        if (email.length > 150) {
            throw new AppError("O campo email não pode conter mais que 150 caracteres");
        }

        const authService = new AuthService();

        const { token, usuario } = await authService.login({ email: email.trim().toLowerCase(), senha });

        return res.status(200).json({ token, usuario });
    }

    async esqueciSenhaHandle(req: Request, res: Response) {
        const { email } = req.body ?? {};

        if (typeof email !== "string" || !email.trim()) {
            throw new AppError("O e-mail é obrigatório.");
        }

        const authService = new AuthService();

        const { token, expiraEm } = await authService.solicitarRedefinicaoSenha(email.trim().toLowerCase());

        // IMPLEMENTAÇÃO FUTURA: o token será enviado por e-mail e deixará de ser devolvido aqui
        return res.status(200).json({
            mensagem: "Código de redefinição gerado. Use-o em POST /api/redefinir-senha.",
            token,
            expiraEm,
        });
    }

    async redefinirSenhaHandle(req: Request, res: Response) {
        const { token, novaSenha } = req.body ?? {};

        if (typeof token !== "string" || !token) {
            throw new AppError("O código de redefinição é obrigatório.");
        }

        const authService = new AuthService();

        await authService.redefinirSenha({ token, novaSenha: validarSenha(novaSenha, "A nova senha") });

        return res.status(204).send();
    }
}

export { AuthController };
