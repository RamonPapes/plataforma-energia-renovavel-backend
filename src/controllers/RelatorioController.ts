import { Request, Response } from "express";
import { RelatorioService } from "../services/RelatorioService";
import { parseInteiroPositivo } from "../utils/parametros";

class RelatorioController {
    async csvHandle(req: Request, res: Response) {
        const id = parseInteiroPositivo(req.params.id, "id");

        const relatorioService = new RelatorioService();

        const csv = await relatorioService.gerarCsv(id);

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="simulacao-${id}.csv"`);
        return res.status(200).send(csv);
    }

    async pdfHandle(req: Request, res: Response) {
        const id = parseInteiroPositivo(req.params.id, "id");

        const relatorioService = new RelatorioService();

        // o PDF é montado antes de enviar qualquer cabeçalho, então uma simulação inexistente ainda vira 404
        const pdf = await relatorioService.gerarPdf(id);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="simulacao-${id}.pdf"`);
        pdf.pipe(res);
    }
}

export { RelatorioController };
