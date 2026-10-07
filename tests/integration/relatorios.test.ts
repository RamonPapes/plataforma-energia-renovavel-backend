import request from "supertest";
import { Stream } from "stream";
import { app } from "../../src/app";
import { AppDataSource } from "../../src/database/data-source";
import { Perfil } from "../../src/models/Usuario";
import { usarBancoDeTeste, criarUsuario, criarMunicipio, cadastrarExemploRoteiro, EXEMPLO_ROTEIRO } from "../helpers/banco";

// o supertest não junta respostas binárias (PDF) sozinho
function binario(res: Stream, callback: (erro: Error | null, corpo: Buffer) => void) {
    const partes: Buffer[] = [];
    res.on("data", (parte: Buffer) => partes.push(parte));
    res.on("end", () => callback(null, Buffer.concat(partes)));
}

describe("Relatórios (UC04, RF06)", () => {
    usarBancoDeTeste();

    let gestor: Awaited<ReturnType<typeof criarUsuario>>;
    let simulacaoId: number;
    beforeEach(async () => {
        gestor = await criarUsuario(Perfil.GESTOR_PUBLICO);
        await cadastrarExemploRoteiro();
        // município com ; e aspas no nome, para testar o escape do CSV
        const especial = await criarMunicipio({ nome: 'São João; "Teste"' });
        for (const [j, valor] of [10, 1.2, 1200, 0.7, 5.5].entries()) {
            await AppDataSource.query("INSERT INTO matriz_decisao (municipio_id, criterio_id, valor, ano_referencia) VALUES (?, ?, ?, 2022)", [especial.id, j + 1, valor]);
        }
        const { body } = await request(app).post("/api/topsis/executar").set("Authorization", gestor.token)
            .send({ ano: EXEMPLO_ROTEIRO.ano, criterios: [1, 2, 3, 4, 5], pesos: EXEMPLO_ROTEIRO.pesos });
        simulacaoId = body.id;
    });

    test("CSV no formato do Excel em português: BOM, separador ;, vírgula decimal e escape de aspas", async () => {
        const res = await request(app).get(`/api/relatorios/${simulacaoId}/csv`).set("Authorization", gestor.token);

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toBe("text/csv; charset=utf-8");
        expect(res.headers["content-disposition"]).toBe(`attachment; filename="simulacao-${simulacaoId}.csv"`);
        expect(res.text.charCodeAt(0)).toBe(0xfeff);

        const linhas = res.text.slice(1).trim().split("\r\n");
        expect(linhas[0]).toBe("Posição;Município;UF;Coeficiente Ci;Distância D+;Distância D-");
        expect(linhas).toHaveLength(5);
        expect(linhas[1]).toBe("1;Município B;BA;1,00000000;0,00000000;0,20265918");
        expect(linhas).toContain('2;"São João; ""Teste""";BA;0,57222948;0,08863378;0,11856558');
    });

    test("PDF com o cabeçalho certo e conteúdo de PDF válido", async () => {
        const res = await request(app).get(`/api/relatorios/${simulacaoId}/pdf`).set("Authorization", gestor.token).buffer(true).parse(binario);

        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toBe("application/pdf");
        expect(res.headers["content-disposition"]).toBe(`attachment; filename="simulacao-${simulacaoId}.pdf"`);
        expect(res.body.subarray(0, 5).toString()).toBe("%PDF-");
        expect(res.body.subarray(-6).toString()).toMatch(/%%EOF/);
    });

    test("PDF com municípios fora do ranking e várias páginas", async () => {
        const incompleto = await criarMunicipio({ nome: "Incompleto" });
        await AppDataSource.query("INSERT INTO matriz_decisao (municipio_id, criterio_id, valor, ano_referencia) VALUES (?, 1, 1, 2022)", [incompleto.id]);
        await AppDataSource.query("INSERT INTO municipios (nome, uf) VALUES " + Array.from({ length: 120 }, (_, i) => `('M${i}', 'SP')`).join(","));
        await AppDataSource.query(
            "INSERT INTO matriz_decisao (municipio_id, criterio_id, valor, ano_referencia) " +
            "SELECT m.id, c.id, (m.id * 7 + c.id * 13) % 101 + 1, 2022 FROM municipios m CROSS JOIN criterios c WHERE m.uf = 'SP' AND c.id <= 5"
        );
        const { body } = await request(app).post("/api/topsis/executar").set("Authorization", gestor.token).send({ ano: 2022, criterios: [1, 2, 3, 4, 5] });

        const res = await request(app).get(`/api/relatorios/${body.id}/pdf`).set("Authorization", gestor.token).buffer(true).parse(binario);
        const paginas = (res.body.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;

        expect(body.parametros.ignorados).toHaveLength(1);
        expect(res.status).toBe(200);
        expect(paginas).toBeGreaterThan(1);
    });

    test.each([["pdf"], ["csv"]])("%s de simulação inexistente retorna 404 em JSON; id inválido, 400; sem token, 401", async formato => {
        const inexistente = await request(app).get(`/api/relatorios/999/${formato}`).set("Authorization", gestor.token);

        expect(inexistente.status).toBe(404);
        expect(inexistente.body).toEqual({ error: "Simulação não encontrada." });
        expect((await request(app).get(`/api/relatorios/abc/${formato}`).set("Authorization", gestor.token)).status).toBe(400);
        expect((await request(app).get(`/api/relatorios/${simulacaoId}/${formato}`)).status).toBe(401);
    });
});
