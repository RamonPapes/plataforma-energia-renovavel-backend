import { AppDataSource } from "../database/data-source";
import { Municipio } from "../models/Municipio";

const MunicipioRepository = AppDataSource.getRepository(Municipio);

export { MunicipioRepository };

