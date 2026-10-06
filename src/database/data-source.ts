import "reflect-metadata";
import path from "path";
import { DataSource } from "typeorm";

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
    entities: ["src/models/*.ts"],
    migrations: ["src/database/migrations/*.ts"],
    subscribers: [],
})


export const initializeDataSource = async () => {
    try{
        await AppDataSource.initialize();
        console.log("Data Source has been initialized!");
    }
    catch(err){
        console.error("Error during Data Source initialization", err)
    }
}