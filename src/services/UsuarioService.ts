import { hash } from "bcryptjs";
import { UsuarioRepository } from "../repository/usuarioRepository";
import { Perfil } from "../models/Usuario";

interface IUsuarioRequest {
    nome: string;
    email: string;
    senha: string;
    perfil?: Perfil;
}

class UsuarioService {
    async createUsuario({ nome, email, senha, perfil }: IUsuarioRequest) {
        const usuarioAlreadyExists = await UsuarioRepository.findOneBy({ email });

        if (usuarioAlreadyExists) {
            throw new Error("E-mail já cadastrado.");
        }

        const senhaHash = await hash(senha, 10); // 10 = salt rounds

        const usuario = UsuarioRepository.create({ nome, email, senha: senhaHash, perfil });

        await UsuarioRepository.save(usuario);

        return usuario;
    }
}

export { UsuarioService };
