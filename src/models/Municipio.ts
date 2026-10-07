import { Entity, PrimaryGeneratedColumn, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("municipios")
export class Municipio{

    @PrimaryGeneratedColumn("increment")
    readonly id: number;

    @Column({ type: "varchar", length: 200 })
    nome: string;

    @Column({ type: "char", length: 2 })
    uf: string;

    @Column({ type: "int", nullable: true })
    populacao: number;

    @Column({ type: "decimal", precision: 4, scale: 3, nullable: true })
    idh: number;

    @Column({ type: "point", nullable: true })
    coordenadas: string; // O MySQL retorna/recebe o Point num formato de string (WKT)
 
    @CreateDateColumn()
    created_at: Date;

}