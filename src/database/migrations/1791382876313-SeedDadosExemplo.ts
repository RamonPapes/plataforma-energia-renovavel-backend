import { MigrationInterface, QueryRunner } from "typeorm";
import { hash } from "bcryptjs";

// Base de exemplo para executar o TOPSIS assim que o sistema sobe: municípios, valores dos
// 7 indicadores (C1 a C7 do seed de critérios) e um usuário de cada perfil além do administrador.
// Os valores são ilustrativos, não são dados oficiais do IBGE/ANEEL/INPE.

const ANO = 2024;

// Ordem dos valores: C1 a C7, como em SeedCriterios
const CRITERIOS = [
    "% domicílios sem acesso à eletricidade",   // C1 custo (%)
    "Capacidade instalada solar",               // C2 benefício (kW/hab)
    "Renda per capita",                         // C3 benefício (R$)
    "Tarifa média de energia",                  // C4 custo (R$/kWh)
    "Índice de irradiação solar",               // C5 benefício (kWh/m²/dia)
    "% população em extrema pobreza",           // C6 custo (%)
    "Nº projetos de energia renovável ativos",  // C7 benefício (projetos)
];

interface IMunicipioExemplo {
    nome: string;
    uf: string;
    populacao: number | null;
    idh: number | null;
    latitude: number;
    longitude: number;
    valores: number[];
}

const MUNICIPIOS: IMunicipioExemplo[] = [
    // Exemplo numérico 7.3 do roteiro: C1 a C5 são os valores da tabela. C6 e C7 foram completados
    // mantendo B como o melhor e C como o pior em todos os critérios, então B > A > C com qualquer peso.
    // Para reproduzir o exemplo (Ci de A = 0,336058): selecione só A, B e C e use os pesos
    // 0,20 / 0,20 / 0,15 / 0,25 / 0,20 em C1 a C5 e 0 em C6 e C7.
    { nome: "Município A", uf: "BA", populacao: null, idh: null, latitude: -12.97, longitude: -38.5, valores: [15, 0.8, 980, 0.75, 5.2, 18, 6] },
    { nome: "Município B", uf: "BA", populacao: null, idh: null, latitude: -12.27, longitude: -38.97, valores: [5, 2.1, 1850, 0.62, 5.8, 8, 14] },
    { nome: "Município C", uf: "BA", populacao: null, idh: null, latitude: -14.86, longitude: -40.84, valores: [22, 0.3, 650, 0.89, 4.9, 27, 2] },

    // Municípios do modo de demonstração do frontend (src/services/mockData.js): população, IDH,
    // coordenadas, C1 e C6 (pobreza) vêm de lá; C2 (lá em kW/1000 hab) foi dividido por 10 para ficar
    // na escala do exemplo do roteiro; C3, C4, C5 e C7 foram estimados para a região.
    { nome: "Juazeiro", uf: "BA", populacao: 237000, idh: 0.68, latitude: -9.41, longitude: -40.5, valores: [2.1, 1.4, 750, 0.82, 5.9, 31, 12] },
    { nome: "Uauá", uf: "BA", populacao: 25000, idh: 0.59, latitude: -9.83, longitude: -39.48, valores: [6.4, 0.4, 430, 0.82, 6.0, 52, 3] },
    { nome: "Cametá", uf: "PA", populacao: 134000, idh: 0.58, latitude: -2.24, longitude: -49.5, valores: [9.8, 0.15, 360, 0.95, 4.9, 58, 2] },
    { nome: "Barcelos", uf: "AM", populacao: 27000, idh: 0.5, latitude: -0.97, longitude: -62.93, valores: [18.5, 0.08, 300, 0.93, 4.6, 61, 1] },
    { nome: "Jordão", uf: "AC", populacao: 8000, idh: 0.47, latitude: -9.19, longitude: -72.79, valores: [22.3, 0.03, 250, 0.89, 4.7, 66, 0] },
    { nome: "Araçuaí", uf: "MG", populacao: 37000, idh: 0.63, latitude: -16.85, longitude: -42.06, valores: [3.7, 0.9, 560, 0.86, 5.6, 44, 6] },
    { nome: "Chapecó", uf: "SC", populacao: 254000, idh: 0.79, latitude: -27.1, longitude: -52.61, valores: [0.3, 3.1, 1650, 0.72, 4.6, 8, 25] },
];

// Credenciais vêm do .env, como as do administrador; usuário sem e-mail ou senha definidos não é criado
const USUARIOS = [
    { prefixo: "PESQUISADOR", nomePadrao: "Pesquisador", perfil: "PESQUISADOR" },
    { prefixo: "GESTOR", nomePadrao: "Gestor Público", perfil: "GESTOR_PUBLICO" },
];

function credenciais(prefixo: string, nomePadrao: string) {
    return {
        nome: process.env[`${prefixo}_NOME`] ?? nomePadrao,
        email: process.env[`${prefixo}_EMAIL`]?.trim().toLowerCase(),
        senha: process.env[`${prefixo}_SENHA`],
    };
}

export class SeedDadosExemplo1791382876313 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const criterioIds = await this.criterioIds(queryRunner);

        for (const m of MUNICIPIOS) {
            const { insertId } = await queryRunner.query(
                "INSERT INTO municipios (nome, uf, populacao, idh, coordenadas) VALUES (?, ?, ?, ?, ST_GeomFromText(?))",
                [m.nome, m.uf, m.populacao, m.idh, `POINT(${m.longitude} ${m.latitude})`]
            );

            await queryRunner.query(
                `INSERT INTO matriz_decisao (municipio_id, criterio_id, valor, ano_referencia) VALUES ${m.valores.map(() => "(?, ?, ?, ?)").join(", ")}`,
                m.valores.flatMap((valor, j) => [insertId, criterioIds[j], valor, ANO])
            );
        }

        for (const { prefixo, nomePadrao, perfil } of USUARIOS) {
            const { nome, email, senha } = credenciais(prefixo, nomePadrao);

            if (!email || !senha) {
                console.warn(`${prefixo}_EMAIL/${prefixo}_SENHA não definidos no .env: usuário ${perfil} de exemplo não criado.`);
                continue;
            }

            await queryRunner.query(
                "INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)",
                [nome, email, await hash(senha, 10), perfil]
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const nomes = MUNICIPIOS.map(m => m.nome);
        const marcadores = nomes.map(() => "?").join(", ");

        // simulações que usaram esses municípios ou foram executadas por esses usuários impedem a remoção (RESTRICT)
        await queryRunner.query(
            `DELETE md FROM matriz_decisao md JOIN municipios m ON m.id = md.municipio_id WHERE md.ano_referencia = ? AND m.nome IN (${marcadores})`,
            [ANO, ...nomes]
        );
        await queryRunner.query(`DELETE FROM municipios WHERE nome IN (${marcadores})`, nomes);

        const emails = USUARIOS.map(u => credenciais(u.prefixo, u.nomePadrao).email).filter(Boolean);
        if (emails.length) {
            await queryRunner.query(`DELETE FROM usuarios WHERE email IN (${emails.map(() => "?").join(", ")})`, emails);
        }
    }

    // ids dos critérios C1 a C7 buscados pelo nome, sem depender da ordem de inserção
    private async criterioIds(queryRunner: QueryRunner) {
        const linhas: { id: number; nome: string }[] = await queryRunner.query(
            `SELECT id, nome FROM criterios WHERE nome IN (${CRITERIOS.map(() => "?").join(", ")})`,
            CRITERIOS
        );
        const porNome = new Map(linhas.map(l => [l.nome, l.id]));

        return CRITERIOS.map(nome => {
            const id = porNome.get(nome);
            if (id === undefined) throw new Error(`Critério "${nome}" não encontrado: rode antes a migration SeedCriterios.`);
            return id;
        });
    }
}
