import { Request, Response } from "express";
import { UsuarioService } from "../services/UsuarioService";
import { Perfil } from "../models/Usuario";
import { AppError } from "../errors/AppError";
import { parseInteiroPositivo, parsePaginacao } from "../utils/parametros";
import { validarSenha } from "../utils/senha";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarNome(nome: unknown) {
    if (typeof nome !== "string" || !nome.trim()) throw new AppError("O nome é obrigatório.");
    if (nome.trim().length > 150) throw new AppError("O nome deve ter no máximo 150 caracteres.");
    return nome.trim();
}

function validarEmail(email: unknown) {
    if (typeof email !== "string" || !email.trim()) throw new AppError("O e-mail é obrigatório.");
    if (email.trim().length > 150) throw new AppError("O e-mail deve ter no máximo 150 caracteres.");
    if (!EMAIL_REGEX.test(email.trim())) throw new AppError("E-mail inválido.");
    return email.trim().toLowerCase();
}

function validarPerfil(perfil: unknown) {
    if (!Object.values(Perfil).includes(perfil as Perfil)) throw new AppError("Perfil inválido.");
    return perfil as Perfil;
}

class UsuarioController {
    async createUserHandle(req: Request, res: Response) {
        const { nome, email, senha, perfil = Perfil.PESQUISADOR } = req.body ?? {};

        const usuarioService = new UsuarioService();

        const user = await usuarioService.createUsuario({
            nome: validarNome(nome),
            email: validarEmail(email),
            senha: validarSenha(senha),
            perfil: validarPerfil(perfil),
        })

        return res.status(201).json(user);
    }

    async getUsuariosHandle(req: Request, res: Response) {
        const { perfil } = req.query;
        const { page, limit } = parsePaginacao(req.query);

        const usuarioService = new UsuarioService();

        const usuarios = await usuarioService.getUsuarios({
            perfil: perfil === undefined ? undefined : validarPerfil(perfil),
            page,
            limit,
        });

        return res.status(200).json(usuarios);
    }

    async getMeHandle(req: Request, res: Response) {
        const usuarioService = new UsuarioService();

        // req.usuario é preenchido pelo ensureAuthenticated a partir do token
        const usuario = await usuarioService.getUsuarioById(req.usuario!.id);

        return res.status(200).json(usuario);
    }

    async getUsuarioByIdHandle(req: Request, res: Response) {
        const id = parseInteiroPositivo(req.params.id, "id");

        const usuarioService = new UsuarioService();

        const usuario = await usuarioService.getUsuarioById(id);

        return res.status(200).json(usuario);
    }

    async updateUsuarioHandle(req: Request, res: Response) {
        const id = parseInteiroPositivo(req.params.id, "id");
        const { nome, email, perfil } = req.body ?? {};

        const usuarioService = new UsuarioService();

        // a senha não é alterada aqui: cada usuário troca a própria em PATCH /usuarios/me/senha
        const usuario = await usuarioService.updateUsuario(id, {
            nome: validarNome(nome),
            email: validarEmail(email),
            perfil: validarPerfil(perfil),
        }, req.usuario!.id);

        return res.status(200).json(usuario);
    }

    async deleteUsuarioHandle(req: Request, res: Response) {
        const id = parseInteiroPositivo(req.params.id, "id");

        const usuarioService = new UsuarioService();

        await usuarioService.deleteUsuario(id, req.usuario!.id);

        return res.status(204).send();
    }

    async alterarSenhaHandle(req: Request, res: Response) {
        const { senhaAtual, novaSenha } = req.body ?? {};

        if (typeof senhaAtual !== "string" || !senhaAtual) {
            throw new AppError("A senha atual é obrigatória.");
        }

        const usuarioService = new UsuarioService();

        await usuarioService.alterarSenha(req.usuario!.id, {
            senhaAtual,
            novaSenha: validarSenha(novaSenha, "A nova senha"),
        });

        return res.status(204).send();
    }
}

export { UsuarioController };
