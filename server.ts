import app from "./api/app.ts";
import { createServer as createViteServer } from "vite";
import { ensureDbReady, db } from "./api/firebase.ts";
import path from "path";
import fs from "fs";
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
    const publicPath = path.join(__dirname, "public");
    app.use(express.static(distPath));
    app.use(express.static(publicPath));

    // Dynamic SEO for Social Media Sharing
    const handleDynamicSEO = async (req: any, res: any) => {
      const indexHtmlPath = path.join(distPath, "index.html");
      if (!fs.existsSync(indexHtmlPath)) {
        return res.sendFile(indexHtmlPath);
      }

      let indexHtml = fs.readFileSync(indexHtmlPath, "utf-8");
      const pathName = req.path;
      const origin = `${req.protocol}://${req.get('host')}`;

      try {
        let title = 'Verdiq | Music Critic';
        let description = 'Professional music reviews, spectral audits, and industry podcasts for independent artists.';
        let imageUrl = `${origin}/logo.svg`;

        if (pathName.startsWith('/review/')) {
          const id = pathName.split('/review/')[1];
          const doc = await db.collection('reviews').doc(id).get();
          if (doc.exists) {
            const review = doc.data();
            const artist = review.artistName || 'Unknown Artist';
            const track = review.songTitle || review.trackName || 'Untitled Track';
            title = `${track} by ${artist} | Verdiq Review`;
            description = `Read the professional AI-powered editorial review of "${track}" by ${artist} on Verdiq.`;
            imageUrl = review.imageUrl || review.featuredPhoto || imageUrl;
          }
        } else if (pathName.startsWith('/podcasts/')) {
          const id = pathName.split('/podcasts/')[1];
          const doc = await db.collection('reviews').doc(id).get();
          if (doc.exists) {
            const podcast = doc.data();
            const artist = podcast.artistName || 'Unknown Artist';
            const track = podcast.songTitle || podcast.trackName || 'Untitled Track';
            title = `${track} by ${artist} | Verdiq Session Podcast`;
            description = `Listen to the Verdiq Session for "${track}" by ${artist}. Wolf & Sloane debate the production and market fit.`;
            imageUrl = podcast.featuredImage || podcast.imageUrl || imageUrl;
          }
        }

        // Ensure image URL is absolute
        if (imageUrl.startsWith('/')) {
          imageUrl = `${origin}${imageUrl}`;
        }

        // Replace meta tags
        indexHtml = indexHtml
          .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
          .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${description}" />`)
          .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${title}" />`)
          .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${description}" />`)
          .replace(/<meta property="og:image" content=".*?" \/>/, `<meta property="og:image" content="${imageUrl}" />`)
          .replace(/<meta name="twitter:image" content=".*?" \/>/, `<meta name="twitter:image" content="${imageUrl}" />`);
          
        // Add missing twitter tags if they don't exist
        if (!indexHtml.includes('twitter:title')) {
          indexHtml = indexHtml.replace('</head>', `    <meta name="twitter:title" content="${title}" />\n    <meta name="twitter:description" content="${description}" />\n  </head>`);
        } else {
          indexHtml = indexHtml
            .replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${title}" />`)
            .replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${description}" />`);
        }

      } catch (e) {
        console.error("Error generating dynamic SEO:", e);
      }

      res.send(indexHtml);
    };

    app.get("/review/:id", handleDynamicSEO);
    app.get("/podcasts/:id", handleDynamicSEO);

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
