// src/index.ts
import fs from "fs";
import { marked } from "marked";
import path from "path";
import puppeteer from "puppeteer";

const INPUT_DIR = path.resolve(__dirname, "../markdown");
const OUTPUT_DIR = path.resolve(__dirname, "../output");

async function convertMarkdownToPdf(fileName: string) {
  const inputPath = path.join(INPUT_DIR, fileName);
  const outputFileName = fileName.replace(/\.md$/, ".pdf");
  const outputPath = path.join(OUTPUT_DIR, outputFileName);

  if (!fs.existsSync(inputPath)) {
    console.error(`Arquivo não encontrado: ${inputPath}`);
    return;
  }

  // Ler conteúdo do .md
  const markdown = fs.readFileSync(inputPath, "utf-8");

  // Converter para HTML
  const htmlContent = marked.parse(markdown);

  // Montar HTML completo
  const html = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          h1, h2, h3, h4 { page-break-after: avoid; }
          pre { background: #f4f4f4; padding: 10px; overflow-x: auto; }
          code { background: #f4f4f4; padding: 2px 4px; }
        </style>
      </head>
      <body>${htmlContent}</body>
    </html>
  `;

  // Gerar PDF com Puppeteer
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "30mm",
      bottom: "30mm",
      left: "20mm",
      right: "20mm",
    },
  });

  await browser.close();

  console.log(`✅ PDF gerado: ${outputPath}`);
}

// === Execução principal ===
(async () => {
  // Listar todos os arquivos .md da pasta
  const files = fs
    .readdirSync(INPUT_DIR)
    .filter((file) => file.endsWith(".md"));

  if (files.length === 0) {
    console.log("Nenhum arquivo .md encontrado para converter.");
    return;
  }

  for (const file of files) {
    await convertMarkdownToPdf(file);
  }
})();
