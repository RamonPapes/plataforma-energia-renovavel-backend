import { AppDataSource } from "../database/data-source";
import { ResultadoRanking } from "../models/ResultadoRanking";

const ResultadoRankingRepository = AppDataSource.getRepository(ResultadoRanking);

export { ResultadoRankingRepository };
