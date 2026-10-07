import { QueryFailedError } from "typeorm";

// O MySQL recusa apagar um registro ainda referenciado por uma FK (RESTRICT/NO ACTION, o padrão)
export function isRegistroReferenciado(error: unknown) {
    return error instanceof QueryFailedError
        && (error.driverError as { code?: string }).code === "ER_ROW_IS_REFERENCED_2";
}
