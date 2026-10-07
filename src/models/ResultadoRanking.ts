import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from "typeorm";
import { decimalTransformer } from "../database/transformers";
import { Simulacao } from "./Simulacao";
import { Municipio } from "./Municipio";

@Entity("resultados_ranking")
@Unique("UQ_resultado_simulacao_municipio", ["simulacao_id", "municipio_id"])
export class ResultadoRanking {

    @PrimaryGeneratedColumn("increment")
    readonly id: number;

    @Column({ type: "int" })
    simulacao_id: number;

    @ManyToOne(() => Simulacao, simulacao => simulacao.resultados, { onDelete: "CASCADE" })
    @JoinColumn({ name: "simulacao_id" })
    simulacao: Simulacao;

    @Column({ type: "int" })
    municipio_id: number;

    @ManyToOne(() => Municipio, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "municipio_id" })
    municipio: Municipio;

    // Ci: quanto maior, menos vulnerável
    @Column({ type: "decimal", precision: 10, scale: 8, transformer: decimalTransformer })
    coeficiente_ci: number;

    @Column({ type: "decimal", precision: 10, scale: 8, transformer: decimalTransformer })
    distancia_positiva: number;

    @Column({ type: "decimal", precision: 10, scale: 8, transformer: decimalTransformer })
    distancia_negativa: number;

    @Column({ type: "int" })
    posicao: number;
}
