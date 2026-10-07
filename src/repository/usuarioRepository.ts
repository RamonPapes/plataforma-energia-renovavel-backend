import { AppDataSource } from "../database/data-source";
import { Usuario } from "../models/Usuario";

const UsuarioRepository = AppDataSource.getRepository(Usuario);

export { UsuarioRepository };