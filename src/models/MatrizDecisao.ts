import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, Index, CreateDateColumn } from "typeorm";
import { decimalTransformer } from "../database/transformers";
import { Municipio } from "./Municipio";
import { Criterio } from "./Criterio";

// Valor de um indicador (critério) para um município em um ano: cada linha é uma célula da matriz do TOPSIS
@Entity("matriz_decisao")
@Unique("UQ_matriz_municipio_criterio_ano", ["municipio_id", "criterio_id", "ano_referencia"])
@Index("IDX_matriz_ano", ["ano_referencia"])
export class MatrizDecisao {

    @PrimaryGeneratedColumn("increment")
    readonly id: number;

    @Column({ type: "int" })
    municipio_id: number;

    @ManyToOne(() => Municipio, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "municipio_id" })
    municipio: Municipio;

    @Column({ type: "int" })
    criterio_id: number;

    @ManyToOne(() => Criterio, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "criterio_id" })
    criterio: Criterio;

    @Column({ type: "decimal", precision: 15, scale: 4, transformer: decimalTransformer })
    valor: number;

    @Column({ type: "int" })
    ano_referencia: number;

    @CreateDateColumn()
    created_at: Date;
}
