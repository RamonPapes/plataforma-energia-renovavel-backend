import { compare } from "bcryptjs";
import jwt from "jsonwebtoken";
import { UsuarioRepository } from "../repository/usuarioRepository";

interface IAuthRequest{
    email: string;
    senha: string;
}

class AuthService {
    async login({email, senha}:IAuthRequest){

        // por questão de segurança, senha tem o campo select:false, 
        // para comparar a senha é necessário adicionar no select com o QueryBuilder
        const usuario = await UsuarioRepository.createQueryBuilder("u")
            .addSelect("u.senha")
            .where("u.email = :email", {email})
            .getOne();

        if(!usuario || !(await compare(senha, usuario.senha))){
            throw new Error("E-mail ou senha inválidos");
        }

        const token = jwt.sign(
            {perfil: usuario.perfil},
            process.env.JWT_SECRET as string,
            {
                subject: String(usuario.id),
                expiresIn: (process.env.JWT_EXPIRES_IN) as jwt.SignOptions["expiresIn"],
            }
        );

        return{
            token,
            usuario: { id:usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
        };
    }
}

export { AuthService };