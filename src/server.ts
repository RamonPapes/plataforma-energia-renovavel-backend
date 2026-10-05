import "reflect-metadata";
import express, { NextFunction, Request, Response, response } from "express";
import { initializeDataSource } from "./database/data-source";
// import { router } from "./routes";

const PORT = Number(process.env.PORT ?? 3000);



initializeDataSource()
    .then(() =>{
        const app = express();

        app.use(express.json());

        app.listen(3000, () => {
            console.log(`Server is running`);
        })
    })
    .catch((err) => {
        console.error("Failed to initialize the Data Source and start the server:", err);
    })