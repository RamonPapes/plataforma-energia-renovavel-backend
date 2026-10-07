import { AppDataSource } from "../database/data-source";
import { Simulacao } from "../models/Simulacao";

const SimulacaoRepository = AppDataSource.getRepository(Simulacao);

export { SimulacaoRepository };
