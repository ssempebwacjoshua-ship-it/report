import "dotenv/config";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { healthRoutes } from "./routes/healthRoutes";
import { reportsRoutes } from "./routes/reportsRoutes";
import { importsRoutes } from "./routes/importsRoutes";

export function createServer() {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? true }));
  app.use(express.json({ limit: "2mb" }));

  app.use(healthRoutes());
  app.use(reportsRoutes());
  app.use(importsRoutes());

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ZodError) {
      res.status(400).json({ error: "Invalid request", issues: error.issues });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Unexpected server error" });
  };
  app.use(errorHandler);

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 4300);
  createServer().listen(port, () => {
    console.log(`Reports lab API listening on http://localhost:${port}`);
  });
}
