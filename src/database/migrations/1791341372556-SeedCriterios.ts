import { MigrationInterface, QueryRunner } from "typeorm";

// Indicadores de vulnerabilidade social energética do capítulo 7.1 do roteiro.
// Pesos iniciais iguais (1/7, arredondado para 4 casas e ajustado no último para a soma dar 1);
// o pesquisador os reconfigura em PUT /criterios/pesos.
const CRITERIOS = [
    { nome: "% domicílios sem acesso à eletricidade", tipo: "CUSTO", unidade: "%", fonte: "IBGE", peso: 0.1429 },
    { nome: "Capacidade instalada solar", tipo: "BENEFICIO", unidade: "kW/hab", fonte: "ANEEL", peso: 0.1429 },
    { nome: "Renda per capita", tipo: "BENEFICIO", unidade: "R$", fonte: "IBGE", peso: 0.1429 },
    { nome: "Tarifa média de energia", tipo: "CUSTO", unidade: "R$/kWh", fonte: "ANEEL", peso: 0.1429 },
    { nome: "Índice de irradiação solar", tipo: "BENEFICIO", unidade: "kWh/m²/dia", fonte: "INPE", peso: 0.1429 },
    { nome: "% população em extrema pobreza", tipo: "CUSTO", unidade: "%", fonte: "IBGE", peso: 0.1429 },
    { nome: "Nº projetos de energia renovável ativos", tipo: "BENEFICIO", unidade: "projetos", fonte: "ANEEL", peso: 0.1426 },
];

export class SeedCriterios1791341372556 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { nome, tipo, unidade, fonte, peso } of CRITERIOS) {
            await queryRunner.query(
                "INSERT INTO criterios (nome, descricao, tipo, peso, unidade) VALUES (?, ?, ?, ?, ?)",
                [nome, `Fonte: ${fonte}`, tipo, peso, unidade]
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DELETE FROM criterios WHERE nome IN (${CRITERIOS.map(() => "?").join(", ")})`,
            CRITERIOS.map(c => c.nome)
        );
    }

}
