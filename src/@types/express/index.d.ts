import { Perfil } from "../../models/Usuario";

declare global {
    namespace Express {
        interface Request {
            usuario?: { id: number; perfil: Perfil };
        }
    }
}

export {};
