import { AppDataSource } from "../database/data-source";
import { MatrizDecisao } from "../models/MatrizDecisao";

const MatrizDecisaoRepository = AppDataSource.getRepository(MatrizDecisao);

export { MatrizDecisaoRepository };
