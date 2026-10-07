import { compare } from "bcryptjs";
import { Not } from "typeorm";
import { AppError } from "../errors/AppError";
import { isRegistroReferenciado } from "../database/errors";
import { UsuarioRepository } from "../repository/usuarioRepository";
import { Perfil } from "../models/Usuario";
import { gerarHashSenha } from "../utils/senha";

interface IUsuarioRequest {
    nome: string;
    email: string;
    senha: string;
    perfil?: Perfil;
}

interface IUpdateUsuarioRequest {
    nome: string;
    email: string;
    perfil: Perfil;
}

interface IListarUsuariosRequest {
    perfil?: Perfil;
    page: number;
    limit: number;
}

interface IAlterarSenhaRequest {
    senhaAtual: string;
    novaSenha: string;
}

class UsuarioService {
    async createUsuario({ nome, email, senha, perfil }: IUsuarioRequest) {
        const usuarioAlreadyExists = await UsuarioRepository.findOneBy({ email });

        if (usuarioAlreadyExists) {
            throw new AppError("E-mail já cadastrado.", 409);
        }

        const senhaHash = await gerarHashSenha(senha);

        const usuario = UsuarioRepository.create({ nome, email, senha: senhaHash, perfil });

        await UsuarioRepository.save(usuario);

        return usuario;
    }

    async getUsuarios({ perfil, page, limit }: IListarUsuariosRequest) {
        const [data, total] = await UsuarioRepository.findAndCount({
            where: perfil ? { perfil } : {},
            order: { nome: "ASC" },
            skip: (page - 1) * limit,
            take: limit,
        });

        return { data, total, page, limit };
    }

    async getUsuarioById(id: number) {
        const usuario = await UsuarioRepository.findOneBy({ id });

        if (!usuario) {
            throw new AppError("Usuário não encontrado.", 404);
        }

        return usuario;
    }

    // solicitanteId é o administrador logado que está fazendo a alteração
    async updateUsuario(id: number, dados: IUpdateUsuarioRequest, solicitanteId: number) {
        const usuario = await this.getUsuarioById(id);

        const emailEmUso = await UsuarioRepository.findOneBy({ email: dados.email, id: Not(id) });

        if (emailEmUso) {
            throw new AppError("E-mail já cadastrado.", 409);
        }

        const deixaDeSerAdministrador = usuario.perfil === Perfil.ADMINISTRADOR && dados.perfil !== Perfil.ADMINISTRADOR;

        if (deixaDeSerAdministrador) {
            if (id === solicitanteId) {
                throw new AppError("Você não pode alterar o seu próprio perfil de administrador.", 403);
            }
            await this.garantirOutroAdministrador();
        }

        Object.assign(usuario, dados);

        await UsuarioRepository.save(usuario);

        return usuario;
    }

    async deleteUsuario(id: number, solicitanteId: number) {
        if (id === solicitanteId) {
            throw new AppError("Você não pode remover a sua própria conta.", 403);
        }

        const usuario = await this.getUsuarioById(id);

        if (usuario.perfil === Perfil.ADMINISTRADOR) {
            await this.garantirOutroAdministrador();
        }

        try {
            await UsuarioRepository.delete({ id });
        } catch (error) {
            // simulações executadas pelo usuário o referenciam
            if (isRegistroReferenciado(error)) {
                throw new AppError("O usuário possui simulações vinculadas e não pode ser removido.", 409);
            }
            throw error;
        }
    }

    async alterarSenha(id: number, { senhaAtual, novaSenha }: IAlterarSenhaRequest) {
        // senha tem select:false, então precisa ser incluída explicitamente para a comparação
        const usuario = await UsuarioRepository.createQueryBuilder("u")
            .addSelect("u.senha")
            .where("u.id = :id", { id })
            .getOne();

        if (!usuario) {
            throw new AppError("Usuário não encontrado.", 404);
        }

        // 400 e não 401: um 401 faria o front entender que o token expirou e deslogar o usuário
        if (!(await compare(senhaAtual, usuario.senha))) {
            throw new AppError("Senha atual incorreta.", 400);
        }

        await UsuarioRepository.update({ id }, { senha: await gerarHashSenha(novaSenha) });
    }

    // o sistema nunca pode ficar sem nenhum administrador
    private async garantirOutroAdministrador() {
        const totalAdministradores = await UsuarioRepository.countBy({ perfil: Perfil.ADMINISTRADOR });

        if (totalAdministradores <= 1) {
            throw new AppError("O sistema precisa ter ao menos um administrador.", 409);
        }
    }
}

export { UsuarioService };
