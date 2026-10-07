import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";
import { decimalTransformer } from "../database/transformers";

export enum TipoCriterio {
    BENEFICIO = "BENEFICIO", // quanto maior o valor, melhor (menos vulnerável)
    CUSTO = "CUSTO",         // quanto menor o valor, melhor
}

@Entity("criterios")
export class Criterio {

    @PrimaryGeneratedColumn("increment")
    readonly id: number;

    @Column({ type: "varchar", length: 150, unique: true })
    nome: string;

    @Column({ type: "text", nullable: true })
    descricao: string | null;

    @Column({ type: "enum", enum: TipoCriterio })
    tipo: TipoCriterio;

    // a soma dos pesos de todos os critérios é sempre 1: ajustados em conjunto em PUT /criterios/pesos
    // e redistribuídos automaticamente quando um critério é criado ou removido
    @Column({ type: "decimal", precision: 5, scale: 4, default: 0, transformer: decimalTransformer })
    peso: number;

    @Column({ type: "varchar", length: 50, nullable: true })
    unidade: string | null;

    @CreateDateColumn()
    created_at: Date;
}
