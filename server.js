const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3000;
const app = express();

// ================= CORS =================
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // Allow all origins
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204); // Preflight handled
  }

  next();
});

app.use(express.json());

// ================= UPLOAD FOLDER =================
const UPLOADS_ROOT = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_ROOT)) fs.mkdirSync(UPLOADS_ROOT, { recursive: true });

// ================= MULTER STORAGE =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const email = req.body.email;
      if (!email) throw new Error("Email is required");

      const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, "");
      const userFolder = path.join(UPLOADS_ROOT, safeEmail);
      if (!fs.existsSync(userFolder)) fs.mkdirSync(userFolder, { recursive: true });

      cb(null, userFolder);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// ================= UPLOAD =================
app.post("/upload", upload.array("files", 10), (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ message: "No files uploaded" });

    res.json({
      message: "Files uploaded successfully",
      files: req.files.map(f => ({ filename: f.filename }))
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ================= LIST FILES =================
app.post("/list-files", (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, "");
    const userFolder = path.join(UPLOADS_ROOT, safeEmail);

    if (!fs.existsSync(userFolder)) return res.json({ files: [] });

    const files = fs.readdirSync(userFolder).map(name => {
      const stats = fs.statSync(path.join(userFolder, name));
      return { name, size: stats.size, modified: stats.mtime };
    });

    res.json({ files });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ================= DOWNLOAD =================
app.get("/download/:email/:filename", (req, res) => {
  try {
    const safeEmail = req.params.email.replace(/[^a-zA-Z0-9@._-]/g, "");
    const filename = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_ROOT, safeEmail, filename);

    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });

    res.download(filePath);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ================= RENAME FILE =================
app.post("/rename-file", (req, res) => {
  try {
    const { email, oldName, newName } = req.body;
    if (!email || !oldName || !newName) return res.status(400).json({ message: "Missing fields" });

    const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, "");
    const folder = path.join(UPLOADS_ROOT, safeEmail);

    const oldPath = path.join(folder, path.basename(oldName));
    const newPath = path.join(folder, path.basename(newName));

    if (!fs.existsSync(oldPath)) return res.status(404).json({ message: "File not found" });

    fs.renameSync(oldPath, newPath);
    res.json({ message: "File renamed successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ================= DELETE FILE =================
app.post("/delete-file", (req, res) => {
  try {
    const { email, filename } = req.body;
    if (!email || !filename) return res.status(400).json({ message: "Missing fields" });

    const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, "");
    const filePath = path.join(UPLOADS_ROOT, safeEmail, path.basename(filename));

    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });

    fs.unlinkSync(filePath);
    res.json({ message: "File deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ================= HEALTH =================
app.get("/", (req, res) => res.send("File upload backend running 🚀"));

// ================= LISTEN =================
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
