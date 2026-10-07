import { Not } from "typeorm";
import { AppError } from "../errors/AppError";
import { Coordenadas } from "../database/transformers";
import { isRegistroReferenciado } from "../database/errors";
import { MunicipioRepository } from "../repository/municipioRepository";

interface IMunicipioRequest {
    nome: string;
    uf: string;
    populacao: number | null;
    idh: number | null;
    coordenadas: Coordenadas | null;
}

interface IListarMunicipiosRequest {
    uf?: string;
    page: number;
    limit: number;
}

class MunicipioService {
    async createMunicipio({ nome, uf, populacao, idh, coordenadas }: IMunicipioRequest) {
        const municipioAlreadyExists = await MunicipioRepository.findOneBy({
            nome,
            uf
        });

        if (municipioAlreadyExists) {
            throw new AppError("Este município já está cadastrado para esta UF.", 409);
        }

        const municipio = MunicipioRepository.create({
            nome,
            uf,
            populacao,
            idh,
            coordenadas
        });

        await MunicipioRepository.save(municipio);

        return municipio;
    }

    async getMunicipios({ uf, page, limit }: IListarMunicipiosRequest) {
        const [data, total] = await MunicipioRepository.findAndCount({
            where: uf ? { uf } : {},
            order: { nome: "ASC" },
            skip: (page - 1) * limit,
            take: limit,
        });

        return { data, total, page, limit };
    }

    async getMunicipioById(id: number) {
        const municipio = await MunicipioRepository.findOneBy({ id });

        if (!municipio) {
            throw new AppError("Município não encontrado.", 404);
        }

        return municipio;
    }

    async updateMunicipio(id: number, dados: IMunicipioRequest) {
        const municipio = await this.getMunicipioById(id);

        const municipioAlreadyExists = await MunicipioRepository.findOneBy({
            nome: dados.nome,
            uf: dados.uf,
            id: Not(id),
        });

        if (municipioAlreadyExists) {
            throw new AppError("Este município já está cadastrado para esta UF.", 409);
        }

        Object.assign(municipio, dados);

        await MunicipioRepository.save(municipio);

        return municipio;
    }

    async deleteMunicipio(id: number) {
        await this.getMunicipioById(id);

        try {
            await MunicipioRepository.delete({ id });
        } catch (error) {
            // matriz de decisão e resultados de simulações referenciam o município
            if (isRegistroReferenciado(error)) {
                throw new AppError("O município possui dados vinculados (matriz de decisão ou simulações) e não pode ser removido.", 409);
            }
            throw error;
        }
    }

}

export { MunicipioService };
