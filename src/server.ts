import "reflect-metadata";
import express, { NextFunction, Request, Response, response } from "express";
// import { router } from "./routes";

const PORT = 3000;

const app = express();

app.listen(PORT, () => {
    console.log(`Server is running in port ${PORT}`);
})

