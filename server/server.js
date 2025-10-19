import express from "express";
import cors from "cors";
import multer from "multer";
import { exec as cbExec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import mime from "mime-types";

const exec = promisify(cbExec);
const app = express();

const PORT = process.env.PORT || 8080;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*"; // isteğe bağlı məhdudlaşdır

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.disable("x-powered-by");

// Multer: müvəqqəti faylları server/tmp-ə saxla
const TMP_DIR = path.join(process.cwd(), "tmp_server");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TMP_DIR),
  filename: (req, file, cb) => {
    // timestamp + original name safe
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit - lazım olsa artır
});

// Helper cleanup
async function safeUnlink(p) {
  try { await fs.promises.unlink(p); } catch (e) { /* ignore */ }
}

// Convert with LibreOffice in headless mode
// docx -> pdf : soffice --headless --convert-to pdf --outdir <outdir> <file>
// pdf  -> docx : soffice --headless --convert-to docx:"MS Word 2007 XML" --outdir <outdir> <file>
// Note: PDF->DOCX quality depends on the PDF; LibreOffice may not perfectly reconstruct complex PDFs.
async function libreConvert(inPath, outDir, toExt) {
  // toExt: 'pdf' or 'docx'
  // build soffice command
  // use timeout (optional) and run in shell
  const cmd = `soffice --headless --convert-to ${toExt} --outdir "${outDir}" "${inPath}"`;
  // exec
  await exec(cmd, { maxBuffer: 1024 * 1024 * 50 }); // 50MB buffer
  // soffice writes file into outDir with same base name & new extension
  const base = path.basename(inPath, path.extname(inPath));
  // find matching file (some libreoffice variants append extension differently)
  const candidates = await fs.promises.readdir(outDir);
  const match = candidates.find(f => f.startsWith(base) && (f.endsWith("." + toExt)));
  if (!match) throw new Error("Converted file not found");
  return path.join(outDir, match);
}

app.get("/", (req, res) => {
  res.json({ ok: true, info: "Converter server. POST /convert with form-data file+mode" });
});

/*
  POST /convert
  form-data:
    - file: file to convert
    - mode: 'docx2pdf' | 'pdf2docx'
*/
app.post("/convert", upload.single("file"), async (req, res) => {
  const file = req.file;
  const mode = req.body.mode || req.query.mode;

  if (!file) {
    return res.status(400).json({ error: "No file uploaded (field name must be 'file')" });
  }
  if (!mode || !["docx2pdf", "pdf2docx"].includes(mode)) {
    await safeUnlink(file.path);
    return res.status(400).json({ error: "Missing or invalid mode. Use mode=docx2pdf or mode=pdf2docx" });
  }

  // Basic extension check
  const ext = path.extname(file.originalname).toLowerCase();
  if (mode === "docx2pdf" && ext !== ".docx") {
    await safeUnlink(file.path);
    return res.status(400).json({ error: "docx2pdf requires a .docx file" });
  }
  if (mode === "pdf2docx" && ext !== ".pdf") {
    await safeUnlink(file.path);
    return res.status(400).json({ error: "pdf2docx requires a .pdf file" });
  }

  const outDir = TMP_DIR; // convert to same tmp dir
  try {
    const toExt = mode === "docx2pdf" ? "pdf" : "docx";
    // run libreoffice conversion
    const outPath = await libreConvert(file.path, outDir, toExt);

    // stream file back
    const stat = await fs.promises.stat(outPath);
    res.setHeader("Content-Length", stat.size);
    const mimeType = mime.lookup(outPath) || "application/octet-stream";
    res.setHeader("Content-Type", mimeType);
    // suggest filename
    const suggested = path.basename(file.originalname, path.extname(file.originalname)) + "." + toExt;
    res.setHeader("Content-Disposition", `attachment; filename="${suggested}"`);

    const stream = fs.createReadStream(outPath);
    stream.pipe(res);

    // cleanup after stream finishes
    stream.on("close", async () => {
      await safeUnlink(file.path);
      await safeUnlink(outPath);
    });
    // on error, try cleanup
    stream.on("error", async () => {
      await safeUnlink(file.path);
      await safeUnlink(outPath);
    });
  } catch (err) {
    console.error("Conversion error:", err);
    await safeUnlink(file.path);
    return res.status(500).json({ error: "Conversion failed", detail: String(err.message || err) });
  }
});

// small health endpoint
app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Converter server listening on port ${PORT}`);
});
