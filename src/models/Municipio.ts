import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";
import { Coordenadas, decimalTransformer, pointTransformer } from "../database/transformers";

@Entity("municipios")
export class Municipio{

    @PrimaryGeneratedColumn("increment")
    readonly id: number;

    @Column({ type: "varchar", length: 200 })
    nome: string;

    @Column({ type: "char", length: 2 })
    uf: string;

    @Column({ type: "int", nullable: true })
    populacao: number | null;

    @Column({ type: "decimal", precision: 4, scale: 3, nullable: true, transformer: decimalTransformer })
    idh: number | null;

    @Column({ type: "point", nullable: true, transformer: pointTransformer })
    coordenadas: Coordenadas | null;

    @CreateDateColumn()
    created_at: Date;

    // a API recebe e devolve latitude/longitude no mesmo nível dos outros campos
    toJSON(){
        const { coordenadas, ...rest } = this;
        return {
            ...rest,
            latitude: coordenadas?.latitude ?? null,
            longitude: coordenadas?.longitude ?? null,
        };
    }
}
