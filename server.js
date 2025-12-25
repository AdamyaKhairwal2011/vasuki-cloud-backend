const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;


app.options("*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.sendStatus(204);
});

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

/* ───────────────────────────────────────
   ABSOLUTE CORS FIX (NO DEPENDENCY)
   ─────────────────────────────────────── */

app.use(express.json());

/* ───────────────────────────────────────
   FILE STORAGE SETUP
   ─────────────────────────────────────── */
const UPLOADS_ROOT = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}

const sanitizeEmail = (email) =>
  email.replace(/[^a-zA-Z0-9@._-]/g, "");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const email = req.body.email;
    if (!email) return cb(new Error("Email required"));

    const userDir = path.join(UPLOADS_ROOT, sanitizeEmail(email));
    fs.mkdirSync(userDir, { recursive: true });

    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

/* ───────────────────────────────────────
   ROUTES
   ─────────────────────────────────────── */

// HEALTH CHECK
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

// UPLOAD
app.post("/upload", upload.array("files", 10), (req, res) => {
  res.json({
    message: "Uploaded",
    files: req.files.map(f => f.filename)
  });
});

// LIST FILES
app.post("/list-files", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const dir = path.join(UPLOADS_ROOT, sanitizeEmail(email));
  if (!fs.existsSync(dir)) return res.json({ files: [] });

  res.json({ files: fs.readdirSync(dir) });
});

// DELETE FILE
app.post("/delete-file", (req, res) => {
  const { email, filename } = req.body;
  const filePath = path.join(
    UPLOADS_ROOT,
    sanitizeEmail(email),
    filename
  );

  if (!fs.existsSync(filePath))
    return res.status(404).json({ message: "File not found" });

  fs.unlinkSync(filePath);
  res.json({ message: "Deleted" });
});

// RENAME FILE
app.post("/rename-file", (req, res) => {
  const { email, oldName, newName } = req.body;

  const base = path.join(UPLOADS_ROOT, sanitizeEmail(email));
  const oldPath = path.join(base, oldName);
  const newPath = path.join(base, newName);

  if (!fs.existsSync(oldPath))
    return res.status(404).json({ message: "File not found" });

  fs.renameSync(oldPath, newPath);
  res.json({ message: "Renamed" });
});

/* ─────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


