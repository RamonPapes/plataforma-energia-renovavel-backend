import { ValueTransformer } from "typeorm";

export interface Coordenadas {
    latitude: number;
    longitude: number;
}

// O mysql2 devolve colunas DECIMAL como string ("0.759");
export const decimalTransformer: ValueTransformer = {
    to: (value?: number | null) => value,
    from: (value?: string | null) => (value == null ? null : Number(value)),
};

export const pointTransformer: ValueTransformer = {
    to: (value?: Coordenadas | null) => {
        if (value == null) return value;
        return `POINT(${value.longitude} ${value.latitude})`;
    },
    from: (value?: string | null): Coordenadas | null => {
        const match = value?.match(/^POINT\(\s*(\S+)\s+(\S+)\s*\)$/);
        if (!match) return null;
        return { longitude: Number(match[1]), latitude: Number(match[2]) };
    },
};
