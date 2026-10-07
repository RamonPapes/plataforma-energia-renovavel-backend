import { Request, Response } from "express";
import { MunicipioService } from "../services/MunicipioService";

class MunicipioController {
    async createMunicipioHandle(req: Request, res: Response) {
        const { nome, uf, populacao, idh, coordenadas } = req.body;

        if (!nome) return res.status(400).json({ error: "O nome do município é obrigatório." });
        if (!uf) return res.status(400).json({ error: "A UF é obrigatória." });
        if (uf.length !== 2) return res.status(400).json({ error: "A UF deve conter exatamente 2 caracteres." });
        if (nome.length > 200) return res.status(400).json({ error: "O nome não pode exceder 200 caracteres." });
        if (idh !== undefined && (idh < 0 || idh > 1)) return res.status(400).json({ error: "IDH inválido." });

        const municipioService: MunicipioService = new MunicipioService();

        try {
            const municipio = await municipioService.createMunicipio({
                nome, uf, populacao, idh, coordenadas
            })

            return res.status(200).json(municipio);
        }
        catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }

            return res.status(400).json({ error: "Erro interno inesperado" });
        }
    }

    async getMunicipiosHandle(req: Request, res: Response) {

        const municipioService = new MunicipioService();

        try {
            const municipios = await municipioService.getMunicipios();

            return res.status(200).json(municipios);
        }
        catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }

            return res.status(400).json({ error: "Erro interno inesperado" });
        }

    }
}


export { MunicipioController }