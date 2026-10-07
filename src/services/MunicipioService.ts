import { AppError } from "../errors/AppError";
import { MunicipioRepository } from "../repository/municipioRepository";

interface IMunicipioRequest {
    nome: string;
    uf: string;
    populacao: number;
    idh: number;
    coordenadas: string;
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

        const municipio = await MunicipioRepository.create({
            nome,
            uf,
            populacao,
            idh,
            coordenadas
        });

        await MunicipioRepository.save(municipio);

        return municipio;
    }

    async getMunicipios() {
        return await MunicipioRepository.find();
    }

}

export { MunicipioService };