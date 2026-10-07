import { EntityManager, Not } from "typeorm";
import { AppError } from "../errors/AppError";
import { AppDataSource } from "../database/data-source";
import { isRegistroReferenciado } from "../database/errors";
import { CriterioRepository } from "../repository/criterioRepository";
import { Criterio, TipoCriterio } from "../models/Criterio";
import { IPeso, distribuirPesos, garantirSomaIgualAUm } from "../utils/pesos";

interface ICriterioRequest {
    nome: string;
    descricao: string | null;
    tipo: TipoCriterio;
    unidade: string | null;
}

interface IListarCriteriosRequest {
    tipo?: TipoCriterio;
    page: number;
    limit: number;
}

class CriterioService {
    async createCriterio(dados: ICriterioRequest) {
        await this.garantirNomeDisponivel(dados.nome);

        return AppDataSource.transaction(async manager => {
            const existentes = await manager.find(Criterio, { order: { id: "ASC" } });
            const somaAtual = existentes.reduce((total, c) => total + c.peso, 0);

            // o novo critério recebe 1/n e os existentes são reduzidos na mesma proporção,
            // mantendo a relação entre os pesos que o pesquisador configurou
            const proporcoes = somaAtual > 0
                ? [...existentes.map(c => (c.peso / somaAtual) * existentes.length), 1]
                : [...existentes.map(() => 1), 1];

            const pesos = distribuirPesos(proporcoes);

            const criterio = manager.create(Criterio, { ...dados, peso: pesos[pesos.length - 1] });
            await manager.save(criterio);

            await this.aplicarPesos(manager, existentes, pesos);

            return criterio;
        });
    }

    async getCriterios({ tipo, page, limit }: IListarCriteriosRequest) {
        const [data, total] = await CriterioRepository.findAndCount({
            where: tipo ? { tipo } : {},
            order: { id: "ASC" },
            skip: (page - 1) * limit,
            take: limit,
        });

        return { data, total, page, limit };
    }

    async getCriterioById(id: number) {
        const criterio = await CriterioRepository.findOneBy({ id });

        if (!criterio) {
            throw new AppError("Critério não encontrado.", 404);
        }

        return criterio;
    }

    async updateCriterio(id: number, dados: ICriterioRequest) {
        const criterio = await this.getCriterioById(id);

        await this.garantirNomeDisponivel(dados.nome, id);

        Object.assign(criterio, dados);

        await CriterioRepository.save(criterio);

        return criterio;
    }

    async deleteCriterio(id: number) {
        await this.getCriterioById(id);

        try {
            await AppDataSource.transaction(async manager => {
                await manager.delete(Criterio, { id });

                // o peso do critério removido é dividido entre os restantes, na proporção de cada um
                const restantes = await manager.find(Criterio, { order: { id: "ASC" } });
                await this.aplicarPesos(manager, restantes, distribuirPesos(restantes.map(c => c.peso)));
            });
        } catch (error) {
            // valores da matriz de decisão referenciam o critério
            if (isRegistroReferenciado(error)) {
                throw new AppError("O critério possui valores na matriz de decisão e não pode ser removido.", 409);
            }
            throw error;
        }
    }

    // RF03: os pesos de todos os critérios são atualizados juntos para manter a soma igual a 1
    async atualizarPesos(pesos: IPeso[]) {
        const criterios = await CriterioRepository.find();
        const idsExistentes = new Set(criterios.map(c => c.id));
        const idsInformados = new Set(pesos.map(p => p.id));

        const desconhecidos = pesos.filter(p => !idsExistentes.has(p.id)).map(p => p.id);
        if (desconhecidos.length) {
            throw new AppError(`Critérios não encontrados: ${desconhecidos.join(", ")}.`, 404);
        }

        const faltando = criterios.filter(c => !idsInformados.has(c.id)).map(c => c.id);
        if (faltando.length) {
            throw new AppError(`Informe o peso de todos os critérios. Faltando: ${faltando.join(", ")}.`);
        }

        garantirSomaIgualAUm(pesos.map(p => p.peso));

        return AppDataSource.transaction(async manager => {
            for (const { id, peso } of pesos) {
                await manager.update(Criterio, { id }, { peso });
            }
            return manager.find(Criterio, { order: { id: "ASC" } });
        });
    }

    // grava pesos[i] em criterios[i], só para os que mudaram
    private async aplicarPesos(manager: EntityManager, criterios: Criterio[], pesos: number[]) {
        for (const [indice, criterio] of criterios.entries()) {
            if (criterio.peso !== pesos[indice]) {
                await manager.update(Criterio, { id: criterio.id }, { peso: pesos[indice] });
            }
        }
    }

    private async garantirNomeDisponivel(nome: string, ignorarId?: number) {
        const criterioExistente = await CriterioRepository.findOneBy(
            ignorarId ? { nome, id: Not(ignorarId) } : { nome }
        );

        if (criterioExistente) {
            throw new AppError("Já existe um critério com este nome.", 409);
        }
    }
}

export { CriterioService };
