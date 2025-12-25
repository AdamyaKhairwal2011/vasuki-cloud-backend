const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const PORT = process.env.PORT || 3000;

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.options("*", cors());

app.use(express.json());


// Base uploads folder
const UPLOADS_ROOT = path.join(__dirname, "uploads");

// Ensure uploads folder exists
if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT);
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const email = req.body.email;
    if (!email) return cb(new Error("Email is required"));

    const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, "");
    const userFolder = path.join(UPLOADS_ROOT, safeEmail);

    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder);
    }

    cb(null, userFolder);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

/* ================= UPLOAD ================= */
app.post("/upload", upload.array("files", 10), (req, res) => {
  if (!req.files?.length) {
    return res.status(400).json({ message: "No files uploaded" });
  }

  res.json({
    message: "Files uploaded successfully",
    files: req.files.map(f => ({ filename: f.filename }))
  });
});

/* ================= LIST FILES ================= */
app.post("/list-files", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, "");
  const userFolder = path.join(UPLOADS_ROOT, safeEmail);

  if (!fs.existsSync(userFolder)) {
    return res.json({ files: [] });
  }

  const files = fs.readdirSync(userFolder).map(name => {
    const stats = fs.statSync(path.join(userFolder, name));
    return {
      name,
      size: stats.size,
      modified: stats.mtime
    };
  });

  res.json({ files });
});

/* ================= DOWNLOAD ================= */
app.get("/download/:email/:filename", (req, res) => {
  const safeEmail = req.params.email.replace(/[^a-zA-Z0-9@._-]/g, "");
  const filename = path.basename(req.params.filename);

  const filePath = path.join(UPLOADS_ROOT, safeEmail, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "File not found" });
  }

  res.download(filePath);
});

/* ================= RENAME FILE ================= */
app.post("/rename-file", (req, res) => {
  const { email, oldName, newName } = req.body;
  if (!email || !oldName || !newName) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, "");
  const userFolder = path.join(UPLOADS_ROOT, safeEmail);

  const oldPath = path.join(userFolder, path.basename(oldName));
  const newPath = path.join(userFolder, path.basename(newName));

  if (!fs.existsSync(oldPath)) {
    return res.status(404).json({ message: "File not found" });
  }

  fs.renameSync(oldPath, newPath);
  res.json({ message: "File renamed successfully" });
});

/* ================= DELETE FILE ================= */
app.post("/delete-file", (req, res) => {
  const { email, filename } = req.body;
  if (!email || !filename) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, "");
  const filePath = path.join(
    UPLOADS_ROOT,
    safeEmail,
    path.basename(filename)
  );

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "File not found" });
  }

  fs.unlinkSync(filePath);
  res.json({ message: "File deleted successfully" });
});

/* ================= HEALTH ================= */
app.get("/", (req, res) => {
  res.send("File upload backend running 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
