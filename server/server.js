import express from "express";
import cors from "cors";
import multer from "multer";
import { fileURLToPath } from "url";
import { dirname, join, extname, basename } from "path";
import { spawn } from "child_process";
import { file as tmpFile, dir as tmpDir } from "tmp-promise";
import fs from "fs/promises";
import mime from "mime-types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Yükləmə (RAM-a yox, diskə yaz)
const upload = multer({ dest: join(__dirname, "uploads") });

// LibreOffice köməkçisi
function runSoffice(args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn("soffice", ["--headless", "--nologo", "--nofirststartwizard", ...args], { cwd });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `LibreOffice exited ${code}`));
    });
  });
}

// QPDF (şifrəli PDF-lər üçün – opsional)
function runQpdf(args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn("qpdf", args, { cwd });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `qpdf exited ${code}`));
    });
  });
}

/**
 * POST /api/convert?mode=pdf2docx|docx2pdf
 * Body: form-data -> file (binary), password (optional)
 */
app.post("/api/convert", upload.single("file"), async (req, res) => {
  const mode = (req.query.mode || "").toLowerCase();
  if (!req.file) return res.status(400).json({ error: "Fayl göndərilməyib." });
  if (!["pdf2docx", "docx2pdf"].includes(mode)) {
    return res.status(400).json({ error: "Yanlış mode. pdf2docx və ya docx2pdf olmalıdır." });
  }

  const original = req.file.path;
  const originalName = req.file.originalname || "input";
  const originalExt = (extname(originalName) || "").toLowerCase();
  const tmp = await tmpDir({ unsafeCleanup: true });

  try {
    let inputPath = original;

    // Şifrəli PDF üçün parol gəlirsə, qpdf ilə deşifrə et
    if (mode === "pdf2docx" && req.body?.password) {
      const decrypted = join(tmp.path, "decrypted.pdf");
      await runQpdf(["--password=" + req.body.password, "--decrypt", inputPath, decrypted], tmp.path);
      inputPath = decrypted;
    }

    // Çevir
    // (LibreOffice çıxışı --outdir ilə tmp qovluğa yazır)
    if (mode === "pdf2docx") {
      // PDF → DOCX
      await runSoffice(["--convert-to", "docx", "--outdir", tmp.path, inputPath], tmp.path);
    } else {
      // DOCX → PDF (writer_pdf_Export profili ilə)
      await runSoffice(["--convert-to", "pdf:writer_pdf_Export", "--outdir", tmp.path, inputPath], tmp.path);
    }

    // Çıxış faylını tap
    const targetExt = mode === "pdf2docx" ? ".docx" : ".pdf";
    const base = basename(originalName, originalExt) || "output";
    const outPath = join(tmp.path, base + targetExt);

    // Bəzən LibreOffice base adı dəyişə bilər; fallback kimi qovluqdakı uyğun faylı tap
    let finalPath = outPath;
    try {
      await fs.access(finalPath);
    } catch {
      const files = await fs.readdir(tmp.path);
      const found = files.find((f) => f.toLowerCase().endsWith(targetExt));
      if (!found) throw new Error("Çıxış faylı tapılmadı.");
      finalPath = join(tmp.path, found);
    }

    const filename = base.replace(/[\/\\:?*"<>|]+/g, "-") + targetExt;
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Type", mime.lookup(finalPath) || "application/octet-stream");

    // Faylı strimlə göndər və təmizlə
    const stream = (await fs.open(finalPath)).createReadStream();
    stream.on("close", async () => {
      await fs.unlink(req.file.path).catch(() => {});
      await fs.rm(tmp.path, { recursive: true, force: true }).catch(() => {});
    });
    stream.pipe(res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "Konvert xətası baş verdi." });
    await fs.unlink(req.file.path).catch(() => {});
    await fs.rm(tmp.path, { recursive: true, force: true }).catch(() => {});
  }
});

// Statik (frontend) – istəsən kökdən servis et
app.use(express.static(join(__dirname, ".."))); // index.html yuxarı qovluqdadırsa

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Converter API listening on " + PORT));
