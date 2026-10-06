import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

export enum Perfil {
    ADMINISTRADOR = "ADMINISTRADOR",
    PESQUISADOR = "PESQUISADOR",
    GESTOR_PUBLICO = "GESTOR_PUBLICO"
}

@Entity("usuarios")
export class Usuario {

    @PrimaryGeneratedColumn("increment")
    readonly id: number;

    @Column({ type: "varchar", length: 150 })
    nome: string;

    @Column({ type: "varchar", length: 150, unique: true })
    email: string;

    @Column({ type: "varchar", length: 255, select: false })
    senha: string;

    toJSON(){
        const { senha, ...rest } = this;
        return rest;
    }

    @Column({ type: "enum", enum: Perfil, default: Perfil.PESQUISADOR })
    perfil: Perfil

    @CreateDateColumn()
    created_at: Date;
}