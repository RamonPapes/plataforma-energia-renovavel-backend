import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, CreateDateColumn } from "typeorm";
import { Usuario } from "./Usuario";
import { ResultadoRanking } from "./ResultadoRanking";
import { TipoCriterio } from "./Criterio";

// Cópia dos parâmetros usados no cálculo: alterar critérios ou pesos depois não muda simulações antigas
export interface IParametrosSimulacao {
    ano: number;
    municipiosSelecionados: number[] | null; // null = todos os municípios com dados no ano
    pesosPersonalizados: boolean;            // true = pesos enviados na requisição, false = pesos salvos dos critérios
    criterios: { id: number; nome: string; tipo: TipoCriterio; unidade: string | null; peso: number }[];
    ignorados: { id: number; nome: string; uf: string; criteriosFaltando: number[] }[];
}

@Entity("simulacoes")
export class Simulacao {

    @PrimaryGeneratedColumn("increment")
    readonly id: number;

    @Column({ type: "int" })
    usuario_id: number;

    @ManyToOne(() => Usuario, { onDelete: "RESTRICT" })
    @JoinColumn({ name: "usuario_id" })
    usuario: Usuario;

    @Column({ type: "int" })
    ano_referencia: number;

    @Column({ type: "json" })
    parametros: IParametrosSimulacao;

    @Column({ type: "varchar", length: 20, default: "CONCLUIDA" })
    status: string;

    @CreateDateColumn({ name: "data_execucao" })
    data_execucao: Date;

    @OneToMany(() => ResultadoRanking, resultado => resultado.simulacao)
    resultados: ResultadoRanking[];
}
