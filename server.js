const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Base uploads folder (separate from backend files)
const UPLOADS_ROOT = path.join(__dirname, "uploads");

// Ensure uploads folder exists
if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT);
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const email = req.body.email;

    if (!email) {
      return cb(new Error("Email is required"));
    }

    // Sanitize email for folder name
    const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, "");

    const userFolder = path.join(UPLOADS_ROOT, safeEmail);

    // Create user folder if not exists
    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder);
    }

    cb(null, userFolder);
  },

  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// Upload API
app.post("/upload", upload.array("files", 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "No files uploaded" });
  }

  res.json({
    message: "Files uploaded successfully",
    files: req.files.map(file => ({
      filename: file.filename,
      path: file.path
    }))
  });
});

// Health check
app.get("/", (req, res) => {
  res.send("File upload backend running 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
