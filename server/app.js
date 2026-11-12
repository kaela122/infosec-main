import express from "express";
import cors from "cors";
import api from "./routes/api.js";

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") ?? true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", api);

  // Express recognises error handlers by their 4-argument signature.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    const status = err.name === "ValidationError" || err.name === "CastError" ? 400 : 500;
    res.status(status).json({ error: status === 400 ? err.message : "Internal server error" });
  });
  return app;
}
