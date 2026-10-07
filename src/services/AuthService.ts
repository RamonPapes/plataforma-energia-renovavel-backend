import { compare } from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppError } from "../errors/AppError";
import { UsuarioRepository } from "../repository/usuarioRepository";
import { gerarHashSenha, gerarTokenRedefinicao, hashTokenRedefinicao } from "../utils/senha";

interface IAuthRequest{
    email: string;
    senha: string;
}

interface IRedefinirSenhaRequest {
    token: string;
    novaSenha: string;
}

const VALIDADE_TOKEN_REDEFINICAO_MS = 30 * 60 * 1000; // 30 minutos

class AuthService {
    async login({email, senha}:IAuthRequest){

        // por questão de segurança, senha tem o campo select:false, 
        // para comparar a senha é necessário adicionar no select com o QueryBuilder
        const usuario = await UsuarioRepository.createQueryBuilder("u")
            .addSelect("u.senha")
            .where("u.email = :email", {email})
            .getOne();

        if(!usuario || !(await compare(senha, usuario.senha))){
            throw new AppError("E-mail ou senha inválidos", 401);
        }

        const token = jwt.sign(
            {perfil: usuario.perfil},
            process.env.JWT_SECRET as string,
            {
                subject: String(usuario.id),
                // sem JWT_EXPIRES_IN o jwt.sign lança erro, por isso o padrão de 1 dia
                expiresIn: (process.env.JWT_EXPIRES_IN ?? "1d") as jwt.SignOptions["expiresIn"],
            }
        );

        return{
            token,
            usuario: { id:usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
        };
    }

    // Etapa 1 do "esqueci minha senha": gera um código de uso único com validade de 30 minutos.
    //
    // IMPLEMENTAÇÃO FUTURA: verificação por e-mail.
    // Hoje o código é devolvido na resposta, então qualquer pessoa que saiba um e-mail cadastrado
    // consegue redefinir a senha dessa conta. Quando houver serviço de e-mail:
    //   1. enviar o código por e-mail (link para a tela de redefinição) e NÃO devolvê-lo na resposta;
    //   2. responder sempre a mesma mensagem, exista ou não o e-mail, para não revelar quais
    //      e-mails estão cadastrados (hoje um e-mail inexistente retorna 404).
    async solicitarRedefinicaoSenha(email: string) {
        const usuario = await UsuarioRepository.findOneBy({ email });

        if (!usuario) {
            throw new AppError("E-mail não encontrado.", 404);
        }

        const token = gerarTokenRedefinicao();
        const expiraEm = new Date(Date.now() + VALIDADE_TOKEN_REDEFINICAO_MS);

        // um novo pedido substitui o código anterior
        await UsuarioRepository.update({ id: usuario.id }, {
            reset_senha_token: hashTokenRedefinicao(token),
            reset_senha_expira_em: expiraEm,
        });

        return { token, expiraEm };
    }

    // Etapa 2: troca a senha usando o código recebido na etapa 1
    async redefinirSenha({ token, novaSenha }: IRedefinirSenhaRequest) {
        // reset_senha_expira_em tem select:false, por isso o addSelect
        const usuario = await UsuarioRepository.createQueryBuilder("u")
            .addSelect("u.reset_senha_expira_em")
            .where("u.reset_senha_token = :tokenHash", { tokenHash: hashTokenRedefinicao(token) })
            .getOne();

        if (!usuario?.reset_senha_expira_em || usuario.reset_senha_expira_em < new Date()) {
            throw new AppError("Código de redefinição inválido ou expirado.", 400);
        }

        // limpa o código para que ele não possa ser usado de novo
        await UsuarioRepository.update({ id: usuario.id }, {
            senha: await gerarHashSenha(novaSenha),
            reset_senha_token: null,
            reset_senha_expira_em: null,
        });
    }
}

export { AuthService };