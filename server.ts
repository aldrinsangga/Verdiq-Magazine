import app from "./server/app.ts";
import { createServer as createViteServer } from "vite";
import { ensureDbReady } from "./server/firebase.ts";

async function startServer() {
  const PORT = 3000;

  console.log("Checking database connectivity (non-blocking)...");
  ensureDbReady().then(() => {
    console.log("Database check complete.");
  }).catch(err => {
    console.error("Database check failed:", err);
  });
  
  console.log("Starting server...");

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const express = (await import('express')).default;
    app.use(express.static("dist"));
    app.get("/{*path}", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("CRITICAL: FAILED TO START SERVER");
  console.error(err);
});
