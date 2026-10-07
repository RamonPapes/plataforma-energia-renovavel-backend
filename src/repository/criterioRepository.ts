import { AppDataSource } from "../database/data-source";
import { Criterio } from "../models/Criterio";

const CriterioRepository = AppDataSource.getRepository(Criterio);

export { CriterioRepository };
