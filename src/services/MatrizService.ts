import { In } from "typeorm";
import { AppError } from "../errors/AppError";
import { AppDataSource } from "../database/data-source";
import { MatrizDecisao } from "../models/MatrizDecisao";
import { MatrizDecisaoRepository } from "../repository/matrizDecisaoRepository";
import { MunicipioRepository } from "../repository/municipioRepository";
import { CriterioRepository } from "../repository/criterioRepository";
import { MunicipioService } from "./MunicipioService";

interface IValorMatrizRequest {
    municipioId: number;
    criterioId: number;
    ano: number;
    valor: number | null; // null remove o valor da célula
}

interface ICarregarMatrizRequest {
    ano: number;
    municipioIds?: number[];
    criterioIds?: number[];
}

// quantidade de linhas por INSERT, para não montar um único comando gigante
const TAMANHO_LOTE = 1000;

class MatrizService {
    // Grava (insere ou atualiza) e remove valores da matriz em uma única transação
    async salvarValores(valores: IValorMatrizRequest[]) {
        await this.garantirMunicipiosExistem(valores.map(v => v.municipioId));
        await this.garantirCriteriosExistem(valores.map(v => v.criterioId));

        const gravar = valores.filter(v => v.valor !== null);
        const remover = valores.filter(v => v.valor === null);

        return AppDataSource.transaction(async manager => {
            for (let i = 0; i < gravar.length; i += TAMANHO_LOTE) {
                // upsert: a chave única (município, critério, ano) decide entre inserir e atualizar
                await manager.upsert(
                    MatrizDecisao,
                    gravar.slice(i, i + TAMANHO_LOTE).map(v => ({
                        municipio_id: v.municipioId,
                        criterio_id: v.criterioId,
                        ano_referencia: v.ano,
                        valor: v.valor as number,
                    })),
                    ["municipio_id", "criterio_id", "ano_referencia"]
                );
            }

            let removidos = 0;
            if (remover.length) {
                const resultado = await manager.createQueryBuilder()
                    .delete()
                    .from(MatrizDecisao)
                    .where(remover.map(v => ({ municipio_id: v.municipioId, criterio_id: v.criterioId, ano_referencia: v.ano })))
                    .execute();
                removidos = resultado.affected ?? 0;
            }

            return { gravados: gravar.length, removidos };
        });
    }

    async getAnos() {
        const linhas = await MatrizDecisaoRepository.createQueryBuilder("m")
            .select("DISTINCT m.ano_referencia", "ano")
            .orderBy("ano", "DESC")
            .getRawMany<{ ano: number }>();

        return linhas.map(linha => Number(linha.ano));
    }

    async getAnoMaisRecente() {
        const [ano] = await this.getAnos();
        return ano;
    }

    // Monta a matriz de um ano: valores[i][j] = valor do municipios[i] no criterios[j] (null se não informado).
    // Sem municipioIds, entram os municípios com ao menos um valor no ano; sem criterioIds, todos os critérios.
    async carregarMatriz({ ano, municipioIds, criterioIds }: ICarregarMatrizRequest) {
        const criterios = criterioIds
            ? await this.garantirCriteriosExistem(criterioIds)
            : await CriterioRepository.find({ order: { id: "ASC" } });

        const municipios = municipioIds
            ? await this.garantirMunicipiosExistem(municipioIds)
            : await MunicipioRepository.createQueryBuilder("m")
                .where("m.id IN (SELECT DISTINCT md.municipio_id FROM matriz_decisao md WHERE md.ano_referencia = :ano)", { ano })
                .orderBy("m.nome", "ASC")
                .getMany();

        const celulas = municipios.length && criterios.length
            ? await MatrizDecisaoRepository.findBy({
                ano_referencia: ano,
                municipio_id: In(municipios.map(m => m.id)),
                criterio_id: In(criterios.map(c => c.id)),
            })
            : [];

        const valorPorCelula = new Map(celulas.map(c => [`${c.municipio_id}:${c.criterio_id}`, c.valor]));

        const valores = municipios.map(municipio =>
            criterios.map(criterio => valorPorCelula.get(`${municipio.id}:${criterio.id}`) ?? null)
        );

        return { ano, criterios, municipios, valores };
    }

    // Matriz no formato de tabela para o front: uma linha por município, um valor por critério
    async getMatriz(filtros: Omit<ICarregarMatrizRequest, "ano"> & { ano?: number }) {
        const ano = filtros.ano ?? await this.getAnoMaisRecente();

        if (ano === undefined) {
            return { ano: null, criterios: [], linhas: [] };
        }

        const { criterios, municipios, valores } = await this.carregarMatriz({ ...filtros, ano });

        return {
            ano,
            criterios: criterios.map(({ id, nome, tipo, peso, unidade }) => ({ id, nome, tipo, peso, unidade })),
            linhas: municipios.map((municipio, i) => ({
                municipio: { id: municipio.id, nome: municipio.nome, uf: municipio.uf },
                valores: valores[i],
            })),
        };
    }

    async getIndicadoresMunicipio(municipioId: number, ano?: number) {
        await new MunicipioService().getMunicipioById(municipioId);

        const celulas = await MatrizDecisaoRepository.find({
            where: ano === undefined ? { municipio_id: municipioId } : { municipio_id: municipioId, ano_referencia: ano },
            relations: { criterio: true },
            order: { ano_referencia: "DESC", criterio_id: "ASC" },
        });

        return celulas.map(celula => ({
            ano: celula.ano_referencia,
            criterio: { id: celula.criterio.id, nome: celula.criterio.nome, tipo: celula.criterio.tipo, unidade: celula.criterio.unidade },
            valor: celula.valor,
        }));
    }

    // Devolve os municípios na ordem dos ids informados (sem repetição); 404 se algum não existir
    private async garantirMunicipiosExistem(ids: number[]) {
        const unicos = [...new Set(ids)];
        const encontrados = await MunicipioRepository.findBy({ id: In(unicos) });
        const porId = new Map(encontrados.map(m => [m.id, m]));

        const faltando = unicos.filter(id => !porId.has(id));
        if (faltando.length) {
            throw new AppError(`Municípios não encontrados: ${faltando.join(", ")}.`, 404);
        }

        return unicos.map(id => porId.get(id)!);
    }

    // Devolve os critérios na ordem dos ids informados (sem repetição); 404 se algum não existir
    private async garantirCriteriosExistem(ids: number[]) {
        const unicos = [...new Set(ids)];
        const encontrados = await CriterioRepository.findBy({ id: In(unicos) });
        const porId = new Map(encontrados.map(c => [c.id, c]));

        const faltando = unicos.filter(id => !porId.has(id));
        if (faltando.length) {
            throw new AppError(`Critérios não encontrados: ${faltando.join(", ")}.`, 404);
        }

        return unicos.map(id => porId.get(id)!);
    }
}

export { MatrizService };
