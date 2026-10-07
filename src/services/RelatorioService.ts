import PDFDocument from "pdfkit";
import { SimulacaoService } from "./SimulacaoService";
import { TipoCriterio } from "../models/Criterio";

type SimulacaoDetalhada = Awaited<ReturnType<SimulacaoService["getSimulacaoById"]>>;

interface IColuna {
    titulo: string;
    largura: number;
    alinhamento?: "left" | "right" | "center";
    quebrarLinha?: boolean; // texto que não pode ser cortado: a linha da tabela cresce para caber
}

const FUSO_HORARIO = "America/Sao_Paulo";
const MARGEM = 50;
const ALTURA_LINHA = 18;
const COR_TEXTO = "#1f2937";
const COR_SECUNDARIA = "#6b7280";
const COR_CABECALHO_TABELA = "#e5e7eb";
const COR_LINHA_ALTERNADA = "#f9fafb";

const NOME_TIPO: Record<TipoCriterio, string> = {
    [TipoCriterio.BENEFICIO]: "Benefício",
    [TipoCriterio.CUSTO]: "Custo",
};

function formatarData(data: Date) {
    return new Date(data).toLocaleString("pt-BR", { timeZone: FUSO_HORARIO });
}

// número com vírgula decimal, como o Excel em português espera
function formatarNumero(valor: number, casas: number) {
    return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas, useGrouping: false });
}

// CSV: campos com ; " ou quebra de linha vão entre aspas, com as aspas internas duplicadas
function campoCsv(valor: string | number) {
    const texto = String(valor);
    return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

class RelatorioService {
    // RF06: ranking da simulação em CSV (separador ; e vírgula decimal, para abrir direto no Excel em português)
    async gerarCsv(simulacaoId: number) {
        const simulacao = await new SimulacaoService().getSimulacaoById(simulacaoId);

        const cabecalho = ["Posição", "Município", "UF", "Coeficiente Ci", "Distância D+", "Distância D-"];
        const linhas = simulacao.ranking.map(r => [
            r.posicao,
            r.municipio.nome,
            r.municipio.uf,
            formatarNumero(r.ci, 8),
            formatarNumero(r.distanciaPositiva, 8),
            formatarNumero(r.distanciaNegativa, 8),
        ]);

        const conteudo = [cabecalho, ...linhas].map(linha => linha.map(campoCsv).join(";")).join("\r\n");

        // o BOM faz o Excel reconhecer o arquivo como UTF-8 (sem ele, os acentos aparecem quebrados)
        return "﻿" + conteudo + "\r\n";
    }

    // RF06: relatório completo da simulação em PDF. O documento já é devolvido finalizado,
    // pronto para ser enviado com doc.pipe(res)
    async gerarPdf(simulacaoId: number) {
        const simulacao = await new SimulacaoService().getSimulacaoById(simulacaoId);

        const doc = new PDFDocument({
            size: "A4",
            margin: MARGEM,
            bufferPages: true, // necessário para escrever "Página X de Y" no final
            info: { Title: `Relatório da simulação TOPSIS nº ${simulacao.id}`, Author: "Plataforma Energia Renovável" },
        });

        this.escreverCabecalho(doc, simulacao);
        this.escreverCriterios(doc, simulacao);
        this.escreverRanking(doc, simulacao);
        this.escreverIgnorados(doc, simulacao);
        this.escreverRodapes(doc);

        doc.end();

        return doc;
    }

    private escreverCabecalho(doc: PDFKit.PDFDocument, simulacao: SimulacaoDetalhada) {
        doc.fillColor(COR_TEXTO).font("Helvetica-Bold").fontSize(18)
            .text("Relatório de Simulação TOPSIS");
        doc.fillColor(COR_SECUNDARIA).font("Helvetica").fontSize(10)
            .text("Vulnerabilidade social energética: Plataforma Energia Renovável");
        doc.moveDown();

        const informacoes: [string, string][] = [
            ["Simulação", `nº ${simulacao.id}`],
            ["Ano de referência dos dados", String(simulacao.ano_referencia)],
            ["Executada em", formatarData(simulacao.data_execucao)],
            ["Executada por", simulacao.usuario.nome],
            ["Municípios no ranking", String(simulacao.ranking.length)],
            ["Gerado em", formatarData(new Date())],
        ];

        for (const [rotulo, valor] of informacoes) {
            doc.fillColor(COR_TEXTO).fontSize(10)
                .font("Helvetica-Bold").text(`${rotulo}: `, { continued: true })
                .font("Helvetica").text(valor);
        }

        doc.moveDown();
    }

    private escreverCriterios(doc: PDFKit.PDFDocument, simulacao: SimulacaoDetalhada) {
        this.escreverTitulo(doc, "Critérios e pesos utilizados");

        const origemPesos = simulacao.parametros.pesosPersonalizados
            ? "Pesos definidos na execução da simulação."
            : "Pesos configurados nos critérios (reescalados para somar 1 quando apenas parte dos critérios foi usada).";
        doc.fillColor(COR_SECUNDARIA).font("Helvetica").fontSize(9).text(origemPesos);
        doc.moveDown(0.5);

        this.desenharTabela(doc, [
            { titulo: "Critério", largura: 245 },
            { titulo: "Tipo", largura: 80 },
            { titulo: "Unidade", largura: 100 },
            { titulo: "Peso", largura: 70, alinhamento: "right" },
        ], simulacao.parametros.criterios.map(c => [
            c.nome,
            NOME_TIPO[c.tipo],
            c.unidade ?? "-",
            formatarNumero(c.peso, 4),
        ]));
    }

    private escreverRanking(doc: PDFKit.PDFDocument, simulacao: SimulacaoDetalhada) {
        this.escreverTitulo(doc, "Ranking de vulnerabilidade");

        doc.fillColor(COR_SECUNDARIA).font("Helvetica").fontSize(9).text(
            "Ci (coeficiente de proximidade) varia de 0 a 1: quanto MAIOR o Ci, MENOS vulnerável o município. " +
            "A 1ª posição é a menos vulnerável e a última, a mais vulnerável. " +
            "D+ e D- são as distâncias até as soluções ideal positiva e negativa."
        );
        doc.moveDown(0.5);

        this.desenharTabela(doc, [
            { titulo: "Posição", largura: 50, alinhamento: "center" },
            { titulo: "Município", largura: 185 },
            { titulo: "UF", largura: 35, alinhamento: "center" },
            { titulo: "Ci", largura: 75, alinhamento: "right" },
            { titulo: "D+", largura: 75, alinhamento: "right" },
            { titulo: "D-", largura: 75, alinhamento: "right" },
        ], simulacao.ranking.map(r => [
            `${r.posicao}º`,
            r.municipio.nome,
            r.municipio.uf,
            formatarNumero(r.ci, 4),
            formatarNumero(r.distanciaPositiva, 4),
            formatarNumero(r.distanciaNegativa, 4),
        ]));
    }

    private escreverIgnorados(doc: PDFKit.PDFDocument, simulacao: SimulacaoDetalhada) {
        const { ignorados, criterios } = simulacao.parametros;
        if (ignorados.length === 0) return;

        const nomeCriterio = new Map(criterios.map(c => [c.id, c.nome]));

        this.escreverTitulo(doc, "Municípios fora do ranking");
        doc.fillColor(COR_SECUNDARIA).font("Helvetica").fontSize(9)
            .text("Não entraram no cálculo por não terem valores para todos os critérios no ano de referência.");
        doc.moveDown(0.5);

        this.desenharTabela(doc, [
            { titulo: "Município", largura: 185 },
            { titulo: "UF", largura: 35, alinhamento: "center" },
            { titulo: "Critérios sem valor", largura: 275, quebrarLinha: true },
        ], ignorados.map(m => [
            m.nome,
            m.uf,
            m.criteriosFaltando.map(id => nomeCriterio.get(id) ?? `#${id}`).join(", "),
        ]));
    }

    private escreverTitulo(doc: PDFKit.PDFDocument, titulo: string) {
        // título não fica sozinho no fim da página: se não couber com algumas linhas, começa na próxima
        if (doc.y + ALTURA_LINHA * 4 > this.limiteInferior(doc)) doc.addPage();

        doc.x = MARGEM;
        doc.fillColor(COR_TEXTO).font("Helvetica-Bold").fontSize(13).text(titulo);
        doc.moveDown(0.3);
    }

    // Tabela simples: repete o cabeçalho quando muda de página e trunca textos longos com "..."
    private desenharTabela(doc: PDFKit.PDFDocument, colunas: IColuna[], linhas: string[][]) {
        let y = doc.y;

        const alturaDaLinha = (celulas: string[]) => {
            doc.font("Helvetica").fontSize(9);
            return colunas.reduce((maior, coluna, i) => coluna.quebrarLinha
                ? Math.max(maior, doc.heightOfString(celulas[i] ?? "", { width: coluna.largura - 8 }) + 10)
                : maior, ALTURA_LINHA);
        };

        const escreverLinha = (celulas: string[], negrito: boolean, fundo?: string) => {
            const altura = negrito ? ALTURA_LINHA : alturaDaLinha(celulas);
            const larguraTotal = colunas.reduce((total, c) => total + c.largura, 0);
            if (fundo) doc.rect(MARGEM, y, larguraTotal, altura).fill(fundo);

            let x = MARGEM;
            doc.fillColor(COR_TEXTO).font(negrito ? "Helvetica-Bold" : "Helvetica").fontSize(9);
            colunas.forEach((coluna, i) => {
                const opcoes = { width: coluna.largura - 8, align: coluna.alinhamento ?? "left" } as const;
                doc.text(celulas[i] ?? "", x + 4, y + 5, coluna.quebrarLinha && !negrito
                    ? opcoes
                    : { ...opcoes, height: ALTURA_LINHA - 5, ellipsis: true, lineBreak: false });
                x += coluna.largura;
            });
            y += altura;
        };

        const escreverCabecalhoTabela = () => escreverLinha(colunas.map(c => c.titulo), true, COR_CABECALHO_TABELA);

        escreverCabecalhoTabela();

        linhas.forEach((linha, i) => {
            if (y + alturaDaLinha(linha) > this.limiteInferior(doc)) {
                doc.addPage();
                y = doc.page.margins.top;
                escreverCabecalhoTabela();
            }
            escreverLinha(linha, false, i % 2 ? COR_LINHA_ALTERNADA : undefined);
        });

        doc.x = MARGEM;
        doc.y = y;
        doc.moveDown();
    }

    private escreverRodapes(doc: PDFKit.PDFDocument) {
        const { start, count } = doc.bufferedPageRange();

        for (let i = start; i < start + count; i++) {
            doc.switchToPage(i);

            // o rodapé fica dentro da margem inferior; sem zerá-la, o pdfkit criaria uma página nova
            const margemInferior = doc.page.margins.bottom;
            doc.page.margins.bottom = 0;

            doc.fillColor(COR_SECUNDARIA).font("Helvetica").fontSize(8).text(
                `Página ${i + 1} de ${count}`,
                MARGEM,
                doc.page.height - MARGEM + 15,
                { width: doc.page.width - MARGEM * 2, align: "center", lineBreak: false }
            );

            doc.page.margins.bottom = margemInferior;
        }
    }

    private limiteInferior(doc: PDFKit.PDFDocument) {
        return doc.page.height - doc.page.margins.bottom;
    }
}

export { RelatorioService };
