import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Healthcheck — utile pour le monitoring en production
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// NOTE : l'authentification (téléphone + OTP) et la persistance des données
// sont désormais entièrement gérées par Supabase (Auth + Postgres + RLS),
// directement depuis le frontend via src/lib/supabase.ts.
// Ce serveur Express ne sert plus qu'à livrer le frontend.

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Development mode: Vite middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production mode: Static files served from dist/.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical: Failed to launch server", err);
});
