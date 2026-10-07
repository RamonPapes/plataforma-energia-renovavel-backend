import "reflect-metadata";
import path from "path";
import { DataSource } from "typeorm";
import { Municipio } from "../models/Municipio";
import { Usuario } from "../models/Usuario";

export const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ?? "plataforma-energia-renovavel",
    synchronize: false,
    logging: false,
    // Entidades importadas diretamente para funcionar tanto com tsx (src/*.ts) quanto com o build (dist/*.js)
    entities: [Municipio, Usuario],
    // __dirname aponta para src/database (tsx) ou dist/database (build), por isso aceita .ts e .js
    migrations: [path.join(__dirname, "migrations", "*.{ts,js}")],
    subscribers: [],
})
