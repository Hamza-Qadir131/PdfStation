const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const { PDFDocument, degrees } = require("pdf-lib");
const archiver = require("archiver");

const upload = require("../utils/upload");
const db = require("../db");
const { outputPath, expiresAtISO } = require("../utils/storage");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Every route in this file requires a logged-in user, and every
// finished job is recorded so it shows up in the user's dashboard.
router.use(requireAuth);

function recordJob({ userId, tool, inputName, outFilename }) {
  const id = uuidv4();
  db.prepare(
    `INSERT INTO jobs (id, user_id, tool, input_name, output_path, output_name, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, tool, inputName || null, outputPath(outFilename), outFilename, expiresAtISO());
  return id;
}

function sendDone(res, jobId, outFilename) {
  res.json({ jobId, downloadUrl: `/api/files/${jobId}` });
}

// ---------- MERGE ----------
// Combine multiple PDFs, in the order they were uploaded, into one file.
router.post("/merge", upload.array("files", 20), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length < 2) {
      return res.status(400).json({ error: "Upload at least two PDFs to merge." });
    }

    const merged = await PDFDocument.create();
    for (const file of files) {
      const src = await PDFDocument.load(file.buffer);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }

    const bytes = await merged.save();
    const outFilename = `merged-${uuidv4()}.pdf`;
    fs.writeFileSync(outputPath(outFilename), bytes);

    const jobId = recordJob({
      userId: req.user.id,
      tool: "merge",
      inputName: `${files.length} files`,
      outFilename,
    });
    sendDone(res, jobId, outFilename);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't merge those files. Make sure they're valid PDFs." });
  }
});

// ---------- SPLIT ----------
// Body: ranges e.g. "1-3,5,7-8". Returns a ZIP with one PDF per range.
router.post("/split", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Upload a PDF to split." });

    const src = await PDFDocument.load(req.file.buffer);
    const pageCount = src.getPageCount();
    const rangesInput = (req.body.ranges || "").trim();

    const ranges = rangesInput
      ? parseRanges(rangesInput, pageCount)
      : Array.from({ length: pageCount }, (_, i) => [i, i]); // default: split every page

    if (!ranges.length) {
      return res.status(400).json({ error: "Enter valid page ranges, e.g. 1-3,5,7-8." });
    }

    const outFilename = `split-${uuidv4()}.zip`;
    const outStream = fs.createWriteStream(outputPath(outFilename));
    const archive = archiver("zip", { zlib: { level: 9 } });

    const finished = new Promise((resolve, reject) => {
      outStream.on("close", resolve);
      archive.on("error", reject);
    });
    archive.pipe(outStream);

    let partNum = 1;
    for (const [start, end] of ranges) {
      const part = await PDFDocument.create();
      const indices = [];
      for (let i = start; i <= end; i++) indices.push(i);
      const pages = await part.copyPages(src, indices);
      pages.forEach((p) => part.addPage(p));
      const bytes = await part.save();
      archive.append(Buffer.from(bytes), { name: `part-${partNum}-p${start + 1}-${end + 1}.pdf` });
      partNum++;
    }

    await archive.finalize();
    await finished;

    const jobId = recordJob({
      userId: req.user.id,
      tool: "split",
      inputName: req.file.originalname,
      outFilename,
    });
    sendDone(res, jobId, outFilename);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't split that file. Check the page ranges and try again." });
  }
});

function parseRanges(input, pageCount) {
  const ranges = [];
  for (const part of input.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.includes("-")) {
      const [a, b] = trimmed.split("-").map((n) => parseInt(n, 10));
      if (Number.isNaN(a) || Number.isNaN(b) || a < 1 || b > pageCount || a > b) return [];
      ranges.push([a - 1, b - 1]);
    } else {
      const n = parseInt(trimmed, 10);
      if (Number.isNaN(n) || n < 1 || n > pageCount) return [];
      ranges.push([n - 1, n - 1]);
    }
  }
  return ranges;
}

// ---------- ROTATE ----------
// Body: angle (90, 180, or 270)
router.post("/rotate", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Upload a PDF to rotate." });
    const angle = parseInt(req.body.angle, 10);
    if (![90, 180, 270].includes(angle)) {
      return res.status(400).json({ error: "Angle must be 90, 180, or 270." });
    }

    const pdf = await PDFDocument.load(req.file.buffer);
    pdf.getPages().forEach((page) => {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + angle) % 360));
    });

    const bytes = await pdf.save();
    const outFilename = `rotated-${uuidv4()}.pdf`;
    fs.writeFileSync(outputPath(outFilename), bytes);

    const jobId = recordJob({
      userId: req.user.id,
      tool: "rotate",
      inputName: req.file.originalname,
      outFilename,
    });
    sendDone(res, jobId, outFilename);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't rotate that file." });
  }
});

// ---------- COMPRESS ----------
// Re-saves the PDF with object streams and without duplicate objects.
// This is a real but modest reduction (typically 5-20%). True heavy
// compression (image downsampling) needs Ghostscript — see README.
router.post("/compress", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Upload a PDF to compress." });

    const pdf = await PDFDocument.load(req.file.buffer, { updateMetadata: false });
    const bytes = await pdf.save({ useObjectStreams: true });

    const outFilename = `compressed-${uuidv4()}.pdf`;
    fs.writeFileSync(outputPath(outFilename), bytes);

    const jobId = recordJob({
      userId: req.user.id,
      tool: "compress",
      inputName: req.file.originalname,
      outFilename,
    });

    res.json({
      jobId,
      downloadUrl: `/api/files/${jobId}`,
      originalSize: req.file.buffer.length,
      newSize: bytes.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't compress that file." });
  }
});

// ---------- IMAGES -> PDF ----------
router.post("/images-to-pdf", upload.array("files", 30), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: "Upload at least one image." });

    const pdf = await PDFDocument.create();
    for (const file of files) {
      let image;
      if (file.mimetype === "image/png") {
        image = await pdf.embedPng(file.buffer);
      } else if (file.mimetype === "image/jpeg") {
        image = await pdf.embedJpg(file.buffer);
      } else {
        return res.status(400).json({ error: `${file.originalname}: only PNG and JPG images are supported.` });
      }
      const page = pdf.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }

    const bytes = await pdf.save();
    const outFilename = `images-${uuidv4()}.pdf`;
    fs.writeFileSync(outputPath(outFilename), bytes);

    const jobId = recordJob({
      userId: req.user.id,
      tool: "images-to-pdf",
      inputName: `${files.length} images`,
      outFilename,
    });
    sendDone(res, jobId, outFilename);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't build a PDF from those images." });
  }
});

// ---------- PDF -> IMAGES ----------
// Requires the poppler-utils system package (pdftoppm) to be installed
// on the server. See README for install instructions per platform.
router.post("/pdf-to-images", upload.single("file"), async (req, res) => {
  let popplerLib;
  try {
    popplerLib = require("pdf-poppler");
  } catch {
    return res.status(500).json({
      error: "PDF-to-image conversion isn't set up on this server yet (missing poppler). See README.",
    });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf2img-"));
  try {
    if (!req.file) return res.status(400).json({ error: "Upload a PDF to convert." });

    const tmpPdfPath = path.join(tmpDir, "input.pdf");
    fs.writeFileSync(tmpPdfPath, req.file.buffer);

    await popplerLib.convert(tmpPdfPath, {
      format: "png",
      out_dir: tmpDir,
      out_prefix: "page",
      page: null, // all pages
    });

    const imageFiles = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".png")).sort();
    if (!imageFiles.length) throw new Error("No pages rendered.");

    const outFilename = `pages-${uuidv4()}.zip`;
    const outStream = fs.createWriteStream(outputPath(outFilename));
    const archive = archiver("zip", { zlib: { level: 9 } });
    const finished = new Promise((resolve, reject) => {
      outStream.on("close", resolve);
      archive.on("error", reject);
    });
    archive.pipe(outStream);
    imageFiles.forEach((f) => archive.file(path.join(tmpDir, f), { name: f }));
    await archive.finalize();
    await finished;

    const jobId = recordJob({
      userId: req.user.id,
      tool: "pdf-to-images",
      inputName: req.file.originalname,
      outFilename,
    });
    sendDone(res, jobId, outFilename);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't convert that PDF to images." });
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }, () => {});
  }
});

module.exports = router;
