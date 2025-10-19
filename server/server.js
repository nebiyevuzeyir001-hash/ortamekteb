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
// Live saytının domenini bura yaz (məs: https://www.eduplan.az)
// hazırda test üçün * qoymuşam, sonra mütləq domeninlə əvəz et!
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

const upload = multer({ dest: "/tmp/uploads" });
const workRoot = "/tmp/work";

fs.mkdirSync("/tmp/uploads", { recursive: true });
fs.mkdirSync(workRoot, { recursive: true });

app.get("/health", (_, res) => res.json({ ok: true }));

/**
 * LibreOffice komanda köməkçisi
 * inPath: yüklənən faylın yolu
 * outExt: çıxış uzantısı (pdf | docx)
 */
async function convertWithLibreOffice(inPath, outExt) {
  const jobDir = fs.mkdtempSync(path.join(workRoot, "job-"));
  const outDir = jobDir;

  // headless çevirmə
  // DOCX->PDF: pdf:writer_pdf_Export
  // PDF->DOCX: docx:"MS Word 2007 XML"
  // LibreOffice PDF-i Draw kimi açır; DOCX-ə export mətni bəzən şəkil kimi ola bilər (PDF strukturu asılıdır).
  const isPDF = /\.pdf$/i.test(inPath);
  const filter = isPDF ? `docx:"MS Word 2007 XML"` : `pdf:writer_pdf_Export`;

  const cmd = `soffice --headless --convert-to ${filter} --outdir ${outDir} "${inPath}"`;
  await exec(cmd);

  // çıxış faylını tap
  const base = path.basename(inPath, path.extname(inPath));
  const outPath = path.join(outDir, `${base}.${outExt}`);

  if (!fs.existsSync(outPath)) {
    // Bəzən LO çıxış adını fərqli yaza bilər – oxşar uzantını axtaraq
    const files = fs.readdirSync(outDir);
    const found = files.find(f => f.startsWith(base + ".") && f.endsWith("." + outExt));
    if (!found) throw new Error("Çıxış faylı tapılmadı");
    return path.join(outDir, found);
  }
  return outPath;
}

async function handleConvert(req, res, mode) {
  try {
    if (!req.file) return res.status(400).json({ error: "Fayl göndərilməyib" });

    const inPath = req.file.path;
    let outExt, expectedMime;

    if (mode === "docx2pdf") {
      // daxil DOCX olmalıdır
      if (!/\.docx$/i.test(req.file.originalname) &&
          !String(req.file.mimetype).includes("officedocument")) {
        return res.status(400).json({ error: "Bu rejim üçün DOCX faylı seçin." });
      }
      outExt = "pdf";
      expectedMime = "application/pdf";
    } else {
      // pdf2docx
      if (!/\.pdf$/i.test(req.file.originalname) &&
          req.file.mimetype !== "application/pdf") {
        return res.status(400).json({ error: "Bu rejim üçün PDF faylı seçin." });
      }
      outExt = "docx";
      expectedMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    const outPath = await convertWithLibreOffice(inPath, outExt);

    // Faylı cavab kimi yolla
    const downloadName =
      path.basename(req.file.originalname, path.extname(req.file.originalname)) + "." + outExt;

    res.setHeader("Content-Type", expectedMime || mime.lookup(outPath) || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadName)}"`);

    const stream = fs.createReadStream(outPath);
    stream.on("close", () => {
      // təmizlik
      fs.rmSync(outPath, { force: true });
      fs.rmSync(inPath, { force: true });
    });
    stream.pipe(res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "Server xətası" });
  }
}

app.post("/convert/docx2pdf", upload.single("file"), (req, res) =>
  handleConvert(req, res, "docx2pdf")
);

app.post("/convert/pdf2docx", upload.single("file"), (req, res) =>
  handleConvert(req, res, "pdf2docx")
);

app.listen(PORT, () => {
  console.log("Converter server is running on port", PORT);
});
