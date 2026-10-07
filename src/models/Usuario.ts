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

    // código de "esqueci minha senha" (hash) e sua validade; nunca são devolvidos pela API
    @Column({ type: "char", length: 64, nullable: true, unique: true, select: false })
    reset_senha_token: string | null;

    @Column({ type: "datetime", nullable: true, select: false })
    reset_senha_expira_em: Date | null;

    toJSON(){
        const { senha, reset_senha_token, reset_senha_expira_em, ...rest } = this;
        return rest;
    }

    @Column({ type: "enum", enum: Perfil, default: Perfil.PESQUISADOR })
    perfil: Perfil

    @CreateDateColumn()
    created_at: Date;
}