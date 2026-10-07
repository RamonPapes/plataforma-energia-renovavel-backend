import jwt from "jsonwebtoken";
import { hashSync } from "bcryptjs";
import { AppDataSource } from "../../src/database/data-source";
import { Perfil, Usuario } from "../../src/models/Usuario";
import { Municipio } from "../../src/models/Municipio";
import { SeedAdminUsuario1791299440444 } from "../../src/database/migrations/1791299440444-SeedAdminUsuario";
import { SeedCriterios1791341372556 } from "../../src/database/migrations/1791341372556-SeedCriterios";

const TABELAS = ["resultados_ranking", "simulacoes", "matriz_decisao", "municipios", "criterios", "usuarios"];

export const SENHA_PADRAO = "senha123";
// hash calculado uma vez: o bcrypt é lento de propósito e deixaria cada teste mais demorado
const HASH_SENHA_PADRAO = hashSync(SENHA_PADRAO, 4);

export function token(id: number, perfil: Perfil) {
    return "Bearer " + jwt.sign({ perfil }, process.env.JWT_SECRET as string, { subject: String(id) });
}

// Apaga todos os dados e recria os do seed: admin (id 1) e critérios C1 a C7 (ids 1 a 7, pesos iguais)
export async function resetarBanco() {
    // trava de segurança: nunca limpar um banco que não seja o de teste
    if (!AppDataSource.options.database?.toString().endsWith("_test")) {
        throw new Error(`Os testes só podem rodar em um banco *_test (atual: ${AppDataSource.options.database}).`);
    }

    // a mesma conexão para todos os comandos: FOREIGN_KEY_CHECKS vale só para a sessão
    const queryRunner = AppDataSource.createQueryRunner();
    try {
        await queryRunner.query("SET FOREIGN_KEY_CHECKS = 0");
        for (const tabela of TABELAS) {
            await queryRunner.query(`TRUNCATE TABLE \`${tabela}\``);
        }
        await queryRunner.query("SET FOREIGN_KEY_CHECKS = 1");

        await new SeedAdminUsuario1791299440444().up(queryRunner);
        await new SeedCriterios1791341372556().up(queryRunner);
    } finally {
        await queryRunner.release();
    }
}

export async function admin() {
    const usuario = await AppDataSource.getRepository(Usuario).findOneByOrFail({ email: process.env.ADMIN_EMAIL });
    return { ...usuario, token: token(usuario.id, Perfil.ADMINISTRADOR) };
}

export async function criarUsuario(perfil: Perfil, email = `${perfil.toLowerCase()}@teste.local`) {
    const repositorio = AppDataSource.getRepository(Usuario);
    const usuario = await repositorio.save(repositorio.create({ nome: `Usuário ${perfil}`, email, senha: HASH_SENHA_PADRAO, perfil }));
    return { id: usuario.id, email, perfil, token: token(usuario.id, perfil) };
}

export async function criarMunicipio(dados: Partial<Municipio> & { nome: string }) {
    const repositorio = AppDataSource.getRepository(Municipio);
    return repositorio.save(repositorio.create({ uf: "BA", ...dados }));
}

// Exemplo numérico 7.3 do roteiro: municípios A, B e C nos critérios C1 a C5 (resultado esperado: B > A > C)
export const EXEMPLO_ROTEIRO = {
    ano: 2022,
    valores: {
        A: [15, 0.8, 980, 0.75, 5.2],
        B: [5, 2.1, 1850, 0.62, 5.8],
        C: [22, 0.3, 650, 0.89, 4.9],
    },
    pesos: [0.2, 0.2, 0.15, 0.25, 0.2].map((peso, j) => ({ id: j + 1, peso })),
};

export async function cadastrarExemploRoteiro() {
    const ids: Record<string, number> = {};
    const coordenadas: Record<string, { latitude: number; longitude: number }> = {
        A: { latitude: -12.97, longitude: -38.5 },
        B: { latitude: -12.27, longitude: -38.97 },
        C: { latitude: -14.86, longitude: -40.84 },
    };

    for (const [nome, valores] of Object.entries(EXEMPLO_ROTEIRO.valores)) {
        const municipio = await criarMunicipio({ nome: `Município ${nome}`, coordenadas: coordenadas[nome] });
        ids[nome] = municipio.id;
        for (const [j, valor] of valores.entries()) {
            await AppDataSource.query(
                "INSERT INTO matriz_decisao (municipio_id, criterio_id, valor, ano_referencia) VALUES (?, ?, ?, ?)",
                [municipio.id, j + 1, valor, EXEMPLO_ROTEIRO.ano]
            );
        }
    }

    return ids as { A: number; B: number; C: number };
}

// Para os arquivos de teste de integração: conecta uma vez e limpa o banco antes de cada teste
export function usarBancoDeTeste() {
    beforeAll(async () => {
        await AppDataSource.initialize();
    });

    beforeEach(async () => {
        await resetarBanco();
    });

    afterAll(async () => {
        await AppDataSource.destroy();
    });
}
