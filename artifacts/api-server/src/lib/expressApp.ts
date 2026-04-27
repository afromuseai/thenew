import express, { type Express } from "express";
import expressWs from "express-ws";

export const app: Express = express();
export const wsInstance = expressWs(app);
