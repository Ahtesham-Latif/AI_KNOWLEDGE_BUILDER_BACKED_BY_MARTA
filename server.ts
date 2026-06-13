/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs"; // Import fs for debugging
import dotenv from "dotenv";
import { AzureCliCredential } from "@azure/identity";
import puppeteer from "puppeteer";
import rateLimit from "express-rate-limit";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true, limit: "15mb" }));

  // API route for health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const generateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many requests. System cooling down. Please wait 15 minutes before generating again.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  function validateMartaResponse(data: any): { valid: boolean; missing: string[] } {
    const requiredStrings = ['title', 'layman', 'definition', 'when_to_use', 'conclusion', 'youtube_id', 'youtube_fallback'];
    const requiredArrays = ['how_to_make', 'types', 'points_to_ponder', 'sources'];
    
    const missing: string[] = [];
    
    for (const key of requiredStrings) {
      if (!data[key] || typeof data[key] !== 'string' || data[key].trim() === '') {
        missing.push(key);
      }
    }
    
    for (const key of requiredArrays) {
      if (!data[key] || !Array.isArray(data[key]) || data[key].length === 0) {
        missing.push(key);
      }
    }
    
    return { valid: missing.length === 0, missing };
  }

  // API route for structured knowledge generation (MARTA — Azure Foundry Agent)
  // API route for structured knowledge generation
  app.post("/api/generate", generateLimiter, async (req, res) => {
    try {
      const { topic, audience } = req.body;
      if (!topic || !audience) {
        return res.status(400).json({ error: "Topic and audience are required" });
      }

      const foundryEndpoint = process.env.FOUNDRY_ENDPOINT;
      console.log("Received generation request for topic:", topic, "and audience:", audience);
      
      if (!foundryEndpoint) {
        console.error("FOUNDRY_ENDPOINT environment variable is missing!");
        return res.status(500).json({ error: "Missing Foundry Agent configuration on server setup" });
        return res.status(500).json({ error: "Missing Knowledge Engine configuration on server setup" });
      }

      const credential = new AzureCliCredential();
      const tokenResponse = await credential.getToken("https://ai.azure.com");
      const token = tokenResponse!.token;

      const response = await fetch(
        `${foundryEndpoint}?api-version=2025-05-15-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            input: `Topic: ${topic}\nTarget Audience: ${audience}`
          })
        }
      );

      const data = await response.json();
     // console.log('MARTA RAW OUTPUT:', JSON.stringify(data.output, null, 2));
      const messageOutput = data.output?.find((o: any) => o.type === 'message');
      const raw = messageOutput?.content?.[0]?.text;
      const textContent = typeof raw === 'object' ? raw?.value : raw;

      if (!textContent) {
        return res.status(400).json({ 
          error: 'Request blocked by safety guardrails. Please enter a valid educational topic.' 
        });
      }

      const cleanJson = textContent.replace(/```json|```/g, '').trim();
      const result = JSON.parse(cleanJson);

      const validation = validateMartaResponse(result);
      if (!validation.valid) {
        throw new Error(`MARTA response missing required fields: ${validation.missing.join(', ')}`);
      }

      return res.json(result);
    } catch (error: any) {
      console.error("Azure Foundry Agent Error:", error);
      console.error("Knowledge Generation Error:", error);
      return res.status(500).json({ error: error.message || "Internal Server Error during generation" });
    }
  });

  // API route to export full report of Knowledge Builder as PDF via Headless Puppeteer
  app.post("/api/export-pdf", async (req, res) => {
    let browser: any = null;
    try {
      let { data, isDark } = req.body;

      // Handle URL-encoded standard Form data as well as standard JSON
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch (e: any) {
          console.error("Error parsing stringified 'data' parameter:", e);
          return res.status(400).json({ error: "Invalid JSON format in data parameter" });
        }
      }

      if (typeof isDark === "string") {
        isDark = isDark === "true";
      }

      if (!data || !data.title) {
        return res.status(400).json({ error: "Missing required data for PDF generation" });
      }

      // Safe helper to handle any malformed strings or arrays returned from MARTA — Azure Foundry Agent
      // Safe helper to handle any malformed strings or arrays returned from the generation engine
      const ensureArray = (val: any): string[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === "string") {
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed;
          } catch (_) {}
          return [val];
        }
        return [];
      };

      console.log(`Generating server-side Puppeteer PDF for report: "${data.title}"...`);
      const rawYoutubeId = data.youtube_id || '';
      const youtubeVideoId = rawYoutubeId.includes('/embed/')
        ? rawYoutubeId.split('/embed/')[1]?.split('?')[0] || ''
        : rawYoutubeId;

      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu"
        ]
      });

      const page = await browser.newPage();

      await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${data.title}</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <script>
            tailwind.config = {
              theme: {
                extend: {
                  fontFamily: {
                    sans: ['Inter', 'sans-serif'],
                    mono: ['JetBrains Mono', 'monospace']
                  },
                  colors: {
                    deepGreen: '#013E37',
                    paleCream: '#FFEFB3',
                  }
                }
              }
            }
          </script>
          <style>
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
            body {
              font-family: 'Inter', sans-serif;
            }
            .font-mono {
              font-family: 'JetBrains Mono', monospace;
            }
            .card-border {
              border: 4px solid ${isDark ? '#FFEFB3' : '#013E37'};
            }
            .shadow-bento {
              box-shadow: 4px 4px 0px ${isDark ? '#FFEFB3' : '#013E37'};
            }
          </style>
        </head>
        <body class="${isDark ? 'bg-[#013E37] text-[#FFEFB3]' : 'bg-[#FFEFB3] text-[#013E37]'} min-h-screen p-8">
          <div class="max-w-5xl mx-auto">
            <!-- Header -->
            <div class="text-center mb-10 border-b-4 pb-6 ${isDark ? 'border-[#FFEFB3]/20' : 'border-[#013E37]/10'}">
              <span class="font-mono text-[10px] uppercase tracking-[0.4em] font-bold block opacity-75">
                STRUCTURED_KNOWLEDGE_DASHBOARD
              </span>
              <h1 class="text-4xl font-black uppercase tracking-tighter leading-tight mt-2">
                ${data.title}
              </h1>
            </div>

            <!-- Bento Grid -->
            <div class="grid grid-cols-4 gap-6">
              
              <!-- LAYMAN (col-span-2) -->
              <div class="col-span-2 flex flex-col card-border shadow-bento ${isDark ? 'bg-[#012b26]' : 'bg-[#fffdf5]'}">
                <div class="p-3 border-b-4 flex items-center justify-between ${isDark ? 'border-[#FFEFB3] bg-[#FFEFB3] text-[#013E37]' : 'border-[#013E37] bg-[#013E37] text-[#FFEFB3]'}">
                  <div class="flex items-center gap-2">
                    <span class="text-base">🧒</span>
                    <h3 class="font-black text-[10px] uppercase tracking-widest">Layman Term</h3>
                  </div>
                </div>
                <div class="p-5 flex-1 leading-relaxed text-sm">
                  ${data.layman}
                </div>
              </div>

              <!-- DEFINITION (col-span-1) -->
              <div class="col-span-1 flex flex-col card-border shadow-bento ${isDark ? 'bg-[#012b26]' : 'bg-[#fffdf5]'}">
                <div class="p-3 border-b-4 flex items-center justify-between ${isDark ? 'border-[#FFEFB3] bg-[#FFEFB3] text-[#013E37]' : 'border-[#013E37] bg-[#013E37] text-[#FFEFB3]'}">
                  <div class="flex items-center gap-2">
                    <span class="text-base">📡</span>
                    <h3 class="font-black text-[10px] uppercase tracking-widest">Definition</h3>
                  </div>
                </div>
                <div class="p-5 flex-1 leading-relaxed text-sm italic border-l-4 ${isDark ? 'bg-[#012b26] border-teal-400' : 'bg-[#FFF5D1] border-[#013E37]'}">
                  ${data.definition}
                </div>
              </div>

              <!-- WHEN TO USE (col-span-1) -->
              <div class="col-span-1 flex flex-col card-border shadow-bento ${isDark ? 'bg-[#012b26]' : 'bg-[#fffdf5]'}">
                <div class="p-3 border-b-4 flex items-center justify-between ${isDark ? 'border-[#FFEFB3] bg-[#FFEFB3] text-[#013E37]' : 'border-[#013E37] bg-[#013E37] text-[#FFEFB3]'}">
                  <div class="flex items-center gap-2">
                    <span class="text-base">⏱️</span>
                    <h3 class="font-black text-[10px] uppercase tracking-widest">When to Use</h3>
                  </div>
                </div>
                <div class="p-5 flex-1 leading-relaxed text-sm">
                  ${data.when_to_use}
                </div>
              </div>

              <!-- HOW TO MAKE (col-span-1 row-span-2) -->
              <div class="col-span-1 row-span-2 flex flex-col card-border shadow-bento ${isDark ? 'bg-[#012b26]' : 'bg-[#fffdf5]'}">
                <div class="p-3 border-b-4 flex items-center justify-between ${isDark ? 'border-[#FFEFB3] bg-[#FFEFB3] text-[#013E37]' : 'border-[#013E37] bg-[#013E37] text-[#FFEFB3]'}">
                  <div class="flex items-center gap-2">
                    <span class="text-base">🛠️</span>
                    <h3 class="font-black text-[10px] uppercase tracking-widest">How to Make</h3>
                  </div>
                </div>
                <div class="p-5 flex-1 leading-relaxed text-sm">
                  <ul class="space-y-3">
                    ${ensureArray(data.how_to_make).map((item: string) => `
                      <li class="flex items-start space-x-2 text-xs">
                        <span class="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-teal-400' : 'bg-[#013E37]'}"></span>
                        <span>${item}</span>
                      </li>
                    `).join("")}
                  </ul>
                </div>
              </div>

              <!-- TYPES (col-span-1) -->
              <div class="col-span-1 flex flex-col card-border shadow-bento ${isDark ? 'bg-[#012b26]' : 'bg-[#fffdf5]'}">
                <div class="p-3 border-b-4 flex items-center justify-between ${isDark ? 'border-[#FFEFB3] bg-[#FFEFB3] text-[#013E37]' : 'border-[#013E37] bg-[#013E37] text-[#FFEFB3]'}">
                  <div class="flex items-center gap-2">
                    <span class="text-base">🧩</span>
                    <h3 class="font-black text-[10px] uppercase tracking-widest">Types</h3>
                  </div>
                </div>
                <div class="p-5 flex-1 leading-relaxed text-sm">
                  <ul class="space-y-2">
                    ${ensureArray(data.types).map((item: string) => `
                      <li class="flex items-start space-x-2 text-xs">
                        <span class="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-teal-400' : 'bg-[#013E37]'}"></span>
                        <span>${item}</span>
                      </li>
                    `).join("")}
                  </ul>
                </div>
              </div>

              <!-- POINTS TO PONDER (col-span-2) -->
              <div class="col-span-2 flex flex-col card-border shadow-bento ${isDark ? 'bg-[#012b26]' : 'bg-[#fffdf5]'}">
                <div class="p-3 border-b-4 flex items-center justify-between ${isDark ? 'border-[#FFEFB3] bg-[#FFEFB3] text-[#013E37]' : 'border-[#013E37] bg-[#013E37] text-[#FFEFB3]'}">
                  <div class="flex items-center gap-2">
                    <span class="text-base">💡</span>
                    <h3 class="font-black text-[10px] uppercase tracking-widest">Points to Ponder</h3>
                  </div>
                </div>
                <div class="p-5 flex-1 leading-relaxed text-sm">
                  <ul class="space-y-2">
                    ${ensureArray(data.points_to_ponder).map((item: string) => `
                      <li class="flex items-start space-x-2 text-xs">
                        <span class="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-teal-400' : 'bg-[#013E37]'}"></span>
                        <span>${item}</span>
                      </li>
                    `).join("")}
                  </ul>
                </div>
              </div>

              <!-- CONCLUSION (col-span-2) -->
              <div class="col-span-2 flex flex-col card-border shadow-bento ${isDark ? 'bg-[#012b26]' : 'bg-[#fffdf5]'}">
                <div class="p-3 border-b-4 flex items-center justify-between ${isDark ? 'border-[#FFEFB3] bg-[#FFEFB3] text-[#013E37]' : 'border-[#013E37] bg-[#013E37] text-[#FFEFB3]'}">
                  <div class="flex items-center gap-2">
                    <span class="text-base">🎯</span>
                    <h3 class="font-black text-[10px] uppercase tracking-widest">Conclusion</h3>
                  </div>
                </div>
                <div class="p-5 flex-1 leading-relaxed text-sm">
                  ${data.conclusion}
                </div>
              </div>

              <!-- RECOMMENDED SOURCES (col-span-2) -->
              <div class="col-span-2 flex flex-col card-border shadow-bento ${isDark ? 'bg-[#012b26]' : 'bg-[#fffdf5]'}">
                <div class="p-3 border-b-4 flex items-center justify-between ${isDark ? 'border-[#FFEFB3] bg-[#FFEFB3] text-[#013E37]' : 'border-[#013E37] bg-[#013E37] text-[#FFEFB3]'}">
                  <div class="flex items-center gap-2">
                    <span class="text-base">🔗</span>
                    <h3 class="font-black text-[10px] uppercase tracking-widest">Recommended Sources</h3>
                  </div>
                </div>
                <div class="p-5 flex-1 leading-relaxed text-sm">
                  <ul class="space-y-2">
                    ${ensureArray(data.sources).map((item: string) => `
                      <li class="flex items-start space-x-2 text-xs">
                        <span class="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-teal-400' : 'bg-[#013E37]'}"></span>
                        <span class="break-all">${item}</span>
                      </li>
                    `).join("")}
                  </ul>
                </div>
              </div>

              <!-- BEST VIDEO GUIDE (col-span-4) -->
              <div class="col-span-4 flex flex-col card-border shadow-bento ${isDark ? 'bg-[#012b26]' : 'bg-[#fffdf5]'}">
                <div class="p-3 border-b-4 flex items-center justify-between ${isDark ? 'border-[#FFEFB3] bg-[#FFEFB3] text-[#013E37]' : 'border-[#013E37] bg-[#013E37] text-[#FFEFB3]'}">
                  <div class="flex items-center gap-2">
                    <span class="text-base">📺</span>
                    <h3 class="font-black text-[10px] uppercase tracking-widest">Best Video Guide</h3>
                  </div>
                </div>
                <div class="p-5 leading-relaxed text-sm">
                  <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <p class="font-bold text-xs uppercase tracking-wider mb-1">Recommended Content:</p>
                      <p class="text-sm opacity-80">${data.youtube_fallback || "No video query specified"}</p>
                    </div>
                    ${youtubeVideoId ? `
                      <div class="border-2 p-2 font-mono text-[9px] uppercase tracking-widest ${isDark ? "border-[#FFEFB3]" : "border-[#013E37]"} bg-black/10">
                        Link: https://youtube.com/watch?v=${youtubeVideoId}
                      </div>
                    ` : ""}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </body>
        </html>
      `;

      await page.setContent(htmlContent, { 
        waitUntil: ["networkidle0", "load", "domcontentloaded"],
        timeout: 60000
      });

      // Allow additional time for fonts and Tailwind CDN to finalize rendering
      await new Promise(resolve => setTimeout(resolve, 1000));

      const pdfBuffer = await page.pdf({
        width: '1200px',
        printBackground: true,
        margin: {
          top: "20mm",
          bottom: "20mm",
          left: "15mm",
          right: "15mm"
        }
      });

      console.log(`PDF generation complete. Buffer size: ${pdfBuffer.length} bytes`);

      if (!pdfBuffer || pdfBuffer.length < 2000) {
        throw new Error("Generated PDF appears to be empty or contains insufficient data.");
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="Knowledge-Builder-Report.pdf"');
      res.setHeader("Content-Length", pdfBuffer.length);

      // res.end with Buffer.from ensures the browser receives raw binary without charset interference
      return res.end(Buffer.from(pdfBuffer));
    } catch (e: any) {
      console.error("PDF generation endpoint error:", e);
      return res.status(500).json({ error: e.message || "Failed to generate PDF on server" });
    } finally {
      if (browser) {
        try {
          await browser.close();
          console.log("Puppeteer browser process success/failure cleanup complete.");
        } catch (closeErr) {
          console.error("Error closing Puppeteer browser process:", closeErr);
        }
      }
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
