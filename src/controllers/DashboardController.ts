import { Request, Response } from "express";
import { DashboardService } from "../services/DashboardService";
import { GeoService } from "../services/GeoService";
import { AppError } from "../errors/AppError";
import { parseAno, parseInteiroPositivo } from "../utils/parametros";

// tipo de conteúdo oficial do GeoJSON (RFC 7946)
const CONTENT_TYPE_GEOJSON = "application/geo+json";

class DashboardController {
    async resumoHandle(req: Request, res: Response) {
        const { simulacaoId } = req.query;

        const dashboardService = new DashboardService();

        const resumo = await dashboardService.getResumo(
            simulacaoId === undefined ? undefined : parseInteiroPositivo(simulacaoId, "simulacaoId")
        );

        return res.status(200).json(resumo);
    }

    async geoMunicipiosHandle(req: Request, res: Response) {
        const geoService = new GeoService();

        const geojson = await geoService.getMunicipios();

        return res.status(200).type(CONTENT_TYPE_GEOJSON).json(geojson);
    }

    async geoSimulacaoHandle(req: Request, res: Response) {
        const id = parseInteiroPositivo(req.params.id, "id");

        const geoService = new GeoService();

        const geojson = await geoService.getSimulacao(id);

        return res.status(200).type(CONTENT_TYPE_GEOJSON).json(geojson);
    }

    async geoIndicadorHandle(req: Request, res: Response) {
        const { criterio, ano } = req.query;

        if (criterio === undefined) {
            throw new AppError("Informe o critério: /matriz/geojson?criterio=1.");
        }

        const geoService = new GeoService();

        const geojson = await geoService.getIndicador(
            parseInteiroPositivo(criterio, "criterio"),
            ano === undefined ? undefined : parseAno(ano)
        );

        return res.status(200).type(CONTENT_TYPE_GEOJSON).json(geojson);
    }
}

export { DashboardController };
