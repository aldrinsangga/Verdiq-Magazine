import app from "./api/app.ts";
import { createServer as createViteServer } from "vite";
import { ensureDbReady } from "./api/firebase.ts";
import path from "path";
import { fileURLToPath } from "url";

// Global error handlers for the main process
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Main Process] Uncaught Exception:', err);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const PORT = process.env.PORT || 3000;

  console.log("Checking database connectivity...");
  try {
    await ensureDbReady();
    console.log("Database check complete.");
  } catch (err) {
    console.error("Database check failed:", err);
    // Continue anyway, but log the failure
  }
  
  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode...`);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const express = (await import('express')).default;
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("CRITICAL: FAILED TO START SERVER");
  console.error(err);
});
