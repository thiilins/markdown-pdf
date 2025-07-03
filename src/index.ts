// src/index.ts
import fs from "fs";
import { marked } from "marked";
import path from "path";
import puppeteer from "puppeteer";
import * as readline from "readline";

// Tipos de formato disponíveis
type PaperFormat = "A2" | "A3" | "A4" | "A5";

// Configurações dos formatos
const formatConfigs = {
  A2: {
    margin: "25mm",
    fontSize: "14px",
    description: "A2 (420×594 mm) - Extra grande",
  },
  A3: {
    margin: "20mm",
    fontSize: "13px",
    description: "A3 (297×420 mm) - Grande",
  },
  A4: {
    margin: "20mm",
    fontSize: "12px",
    description: "A4 (210×297 mm) - Padrão",
  },
  A5: {
    margin: "15mm",
    fontSize: "11px",
    description: "A5 (148×210 mm) - Compacto",
  },
};

// Função para converter imagem local em base64
function imageToBase64(imgPath: string): string | null {
  try {
    const imgBuffer = fs.readFileSync(imgPath);
    const ext = path.extname(imgPath).slice(1);
    const mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;
    return `data:${mimeType};base64,${imgBuffer.toString("base64")}`;
  } catch (error) {
    console.error(`Erro ao converter imagem: ${imgPath}`);
    return null;
  }
}

// Função para limpar arquivos PDF da pasta output
function cleanOutputDir() {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`📁 Pasta output criada: ${OUTPUT_DIR}`);
      return;
    }

    const files = fs.readdirSync(OUTPUT_DIR);
    const pdfFiles = files.filter((file) => file.endsWith(".pdf"));

    if (pdfFiles.length === 0) {
      console.log("🧹 Pasta output já está limpa (nenhum PDF encontrado)");
      return;
    }

    let removedCount = 0;
    pdfFiles.forEach((file) => {
      try {
        const filePath = path.join(OUTPUT_DIR, file);
        fs.unlinkSync(filePath);
        removedCount++;
        console.log(`🗑️  Removido: ${file}`);
      } catch (error) {
        console.error(`❌ Erro ao remover ${file}:`, error);
      }
    });

    console.log(
      `🧹 Limpeza concluída: ${removedCount} arquivo(s) PDF removido(s)`
    );
  } catch (error) {
    console.error("❌ Erro durante a limpeza da pasta output:", error);
  }
}

// Função para escolher formato via prompt
function promptForFormat(): Promise<PaperFormat> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n📏 Escolha o formato do papel:");
    console.log("1. A2 (420×594 mm) - Extra grande");
    console.log("2. A3 (297×420 mm) - Grande");
    console.log("3. A4 (210×297 mm) - Padrão");
    console.log("4. A5 (148×210 mm) - Compacto");
    console.log();

    rl.question("Digite o número da opção (1-4) [padrão: 3]: ", (answer) => {
      rl.close();

      const choice = answer.trim() || "3";
      switch (choice) {
        case "1":
          resolve("A2");
          break;
        case "2":
          resolve("A3");
          break;
        case "3":
          resolve("A4");
          break;
        case "4":
          resolve("A5");
          break;
        default:
          console.log("⚠️  Opção inválida. Usando A4 como padrão.");
          resolve("A4");
      }
    });
  });
}

// Função para obter formato dos argumentos da linha de comando
function getFormatFromArgs(): PaperFormat | null {
  const args = process.argv.slice(2);
  const formatArg = args.find((arg) => arg.startsWith("--format="));

  if (formatArg) {
    const format = formatArg.split("=")[1]?.toUpperCase() as PaperFormat;
    if (Object.keys(formatConfigs).includes(format)) {
      return format;
    } else {
      console.log(
        `⚠️  Formato '${format}' inválido. Formatos disponíveis: A2, A3, A4, A5`
      );
      return null;
    }
  }

  return null;
}

// Função para mostrar ajuda
function showHelp() {
  console.log(`
📖 Conversor de Markdown para PDF

Uso:
  pnpm start [--format=FORMATO]

Formatos disponíveis:
  A2    ${formatConfigs.A2.description}
  A3    ${formatConfigs.A3.description}
  A4    ${formatConfigs.A4.description}
  A5    ${formatConfigs.A5.description}

Exemplos:
  pnpm start                  # Prompt interativo
  pnpm start --format=A4      # Formato A4 direto
  pnpm start --format=A2      # Formato A2 direto

Scripts pré-configurados:
  pnpm run pdf:a2   # Gerar em formato A2
  pnpm run pdf:a3   # Gerar em formato A3
  pnpm run pdf:a4   # Gerar em formato A4
  pnpm run pdf:a5   # Gerar em formato A5
`);
}

const INPUT_DIR = path.resolve(__dirname, "../markdown");
const OUTPUT_DIR = path.resolve(__dirname, "../output");

async function convertMarkdownToPdf(fileName: string, format: PaperFormat) {
  const inputPath = path.join(INPUT_DIR, fileName);
  const outputFileName = fileName.replace(
    /\.md$/,
    `.${format.toLowerCase()}.pdf`
  );
  const outputPath = path.join(OUTPUT_DIR, outputFileName);

  if (!fs.existsSync(inputPath)) {
    console.error(`Arquivo não encontrado: ${inputPath}`);
    return;
  }

  const config = formatConfigs[format];

  let markdown = fs.readFileSync(inputPath, "utf-8");

  // Encontrar imagens locais: ![alt](./images/xxx.png)
  const regex = /!\[.*?\]\((\.\/.*?\.(png|jpg|jpeg|gif|svg))\)/g;

  markdown = markdown.replace(regex, (match, imgPath) => {
    const absolutePath = path.resolve(INPUT_DIR, imgPath);
    const base64 = imageToBase64(absolutePath);
    if (base64) {
      // Substituir caminho local por base64
      return match.replace(imgPath, base64);
    }
    return match; // Mantém original se falhar
  });

  // Converter markdown em HTML
  const htmlContent = marked.parse(markdown);

  const html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          /* Configurações para formato ${format} retrato */
          @page {
            size: ${format} portrait;
            margin: ${config.margin};
          }
          
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6;
            color: #333;
            font-size: ${config.fontSize};
            padding: 0;
            margin: 0;
            max-width: none;
          }
          
          /* Títulos com quebras de página controladas */
          h1, h2, h3, h4, h5, h6 { 
            page-break-after: avoid;
            color: #2c3e50;
            margin-top: 1.5em;
            margin-bottom: 0.8em;
            line-height: 1.3;
          }
          
          h1 { 
            font-size: 2.8em; 
            border-bottom: 3px solid #3498db; 
            padding-bottom: 10px;
            margin-bottom: 1.2em;
            page-break-before: auto;
          }
          
          h2 { 
            font-size: 2.2em; 
            color: #3498db; 
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 8px;
            page-break-before: avoid;
          }
          
          h3 { 
            font-size: 1.8em; 
            color: #34495e;
            page-break-before: avoid;
          }
          
          h4 { 
            font-size: 1.4em; 
            color: #7f8c8d;
          }
          
          /* Parágrafos */
          p {
            margin: 1em 0;
            text-align: justify;
          }
          
          /* Código com melhor formatação */
          pre { 
            background: #2c3e50; 
            color: #ecf0f1;
            padding: 20px; 
            overflow-x: auto; 
            border-radius: 5px;
            margin: 1.5em 0;
            font-family: 'Courier New', Monaco, monospace;
            font-size: ${format === "A5" ? "10px" : "12px"};
            line-height: 1.4;
            page-break-inside: avoid;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          
          code { 
            background: #ecf0f1; 
            padding: 3px 6px; 
            border-radius: 3px;
            font-family: 'Courier New', Monaco, monospace;
            color: #e74c3c;
            font-size: ${format === "A5" ? "10px" : "11px"};
          }
          
          pre code {
            background: none;
            color: #ecf0f1;
            padding: 0;
            font-size: ${format === "A5" ? "10px" : "12px"};
          }
          
          /* Imagens responsivas */
          img { 
            max-width: 100%;
            height: auto;
            display: block;
            margin: 1.5em auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border-radius: 8px;
            page-break-inside: avoid;
          }
          
          /* Citações */
          blockquote {
            border-left: 4px solid #3498db;
            margin: 1.5em 0;
            font-style: italic;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 0 8px 8px 0;
            font-size: ${config.fontSize};
            page-break-inside: avoid;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          }
          
          /* Tabelas */
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 1.5em 0;
            font-size: ${format === "A5" ? "10px" : "11px"};
            page-break-inside: avoid;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          
          table th, table td {
            border: 1px solid #ddd;
            padding: ${format === "A5" ? "8px 10px" : "12px 15px"};
            text-align: left;
            vertical-align: top;
          }
          
          table th {
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
            font-weight: bold;
            font-size: ${format === "A5" ? "11px" : "12px"};
          }
          
          table tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          
          table tr:hover {
            background-color: #e8f4f8;
          }
          
          /* Listas */
          ul, ol { 
            margin: 1em 0; 
            padding-left: 2em;
          }
          
          li { 
            margin: 0.5em 0;
            font-size: ${config.fontSize};
          }
          
          /* Links */
          a { 
            color: #3498db; 
            text-decoration: none;
            font-weight: 500;
          }
          
          a:hover { 
            text-decoration: underline; 
            color: #2980b9;
          }
          
          /* Quebras de página controladas */
          h1 {
            page-break-before: always;
          }
          
          h1:first-child {
            page-break-before: avoid;
          }
          
          h2, h3, h4, h5, h6 {
            page-break-after: avoid;
          }
          
          table, pre, blockquote {
            page-break-inside: avoid;
          }
          
          /* Estilo para elementos órfãos e viúvas */
          p {
            orphans: 3;
            widows: 3;
          }
          
          /* Separadores */
          hr {
            border: none;
            height: 2px;
            background: linear-gradient(to right, #3498db, #2980b9);
            margin: 2em 0;
            page-break-after: avoid;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: "networkidle0" });

  await page.pdf({
    path: outputPath,
    format: format,
    landscape: false,
    printBackground: true,
    margin: {
      top: config.margin,
      bottom: config.margin,
      left: config.margin,
      right: config.margin,
    },
    preferCSSPageSize: true,
    displayHeaderFooter: false,
  });

  await browser.close();

  console.log(`✅ PDF gerado em formato ${format}: ${outputPath}`);
}

// === Execução principal ===
(async () => {
  console.log("🚀 Conversor de Markdown para PDF\n");

  // Verificar se foi solicitada ajuda
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    showHelp();
    return;
  }

  // Obter formato dos argumentos ou prompt
  let format = getFormatFromArgs();

  if (!format) {
    format = await promptForFormat();
  }

  console.log(
    `📏 Formato selecionado: ${format} (${formatConfigs[format].description})\n`
  );

  // Etapa 1: Limpar pasta output
  console.log("📋 Etapa 1: Limpando pasta output");
  cleanOutputDir();
  console.log();

  // Etapa 2: Buscar arquivos Markdown
  console.log("📋 Etapa 2: Buscando arquivos Markdown");
  const files = fs
    .readdirSync(INPUT_DIR)
    .filter((file) => file.endsWith(".md"));

  if (files.length === 0) {
    console.log("❌ Nenhum arquivo .md encontrado para converter.");
    return;
  }

  console.log(`📄 Encontrados ${files.length} arquivo(s) para conversão:`);
  files.forEach((file) => console.log(`   • ${file}`));
  console.log();

  // Etapa 3: Converter arquivos
  console.log("📋 Etapa 3: Convertendo arquivos");
  for (const file of files) {
    console.log(`🔄 Processando: ${file}`);
    await convertMarkdownToPdf(file, format);
  }

  console.log();
  console.log("🎉 Conversão concluída com sucesso!");
})();
