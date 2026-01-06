const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = 3000;

/* ================= CONFIG ================= */

app.use(cors());
app.use(express.json());

const UPLOADS = path.join(__dirname, "uploads");
const SHARES = path.join(__dirname, "shares.json");

if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS);
if (!fs.existsSync(SHARES)) fs.writeFileSync(SHARES, "{}");

/* ================= HELPERS ================= */

const safe = v =>
  v.replace(/[^a-zA-Z0-9@._/-]/g, "").replace(/\.\./g, "");

const readShares = () => JSON.parse(fs.readFileSync(SHARES));
const writeShares = d =>
  fs.writeFileSync(SHARES, JSON.stringify(d, null, 2));

const token = () => Math.random().toString(36).slice(2) + Date.now();

/* ================= PREVIEW STORE ================= */

const previews = new Map();

/* ================= FILE EDITOR ================= */

// GET FILE CONTENT
app.post("/get-file-content", (req, res) => {
  const { email, path: filePath } = req.body;
  if (!email || !filePath)
    return res.status(400).json({ error: "Missing email or path" });

  const fullPath = path.join(UPLOADS, safe(email), safe(filePath));

  if (!fs.existsSync(fullPath))
    return res.status(404).json({ error: "File not found" });

  res.json({ content: fs.readFileSync(fullPath, "utf8") });
});

// SAVE FILE CONTENT
app.post("/save-file-content", (req, res) => {
  const { email, path: filePath, content } = req.body;
  if (!email || !filePath || content === undefined)
    return res.status(400).json({ error: "Missing data" });

  const fullPath = path.join(UPLOADS, safe(email), safe(filePath));
  fs.writeFileSync(fullPath, content, "utf8");

  res.json({ ok: true });
});

// CREATE PREVIEW
app.post("/preview-html", (req, res) => {
  const { content, baseUrl } = req.body;
  if (!content || !baseUrl)
    return res.status(400).json({ error: "Missing content or baseUrl" });

  const t = crypto.randomBytes(16).toString("hex");
  previews.set(t, { content, baseUrl });

  setTimeout(() => previews.delete(t), 10 * 60 * 1000);

  res.json({
    url: `https://vasuki-cloud-backend-production.up.railway.app/preview/${t}`
  });
});

// SERVE PREVIEW
app.get("/preview/:token", (req, res) => {
  const preview = previews.get(req.params.token);
  if (!preview) return res.status(404).send("Preview expired");

res.send(`
<!DOCTYPE html>
<html>
<head>
  <base href="${preview.baseUrl}">
</head>
<body>
${preview.content}

<script>
window.addEventListener("message", (e) => {
  if (e.data === "VASUKI_RELOAD") {
    location.reload();
  }
});
</script>

</body>
</html>
`);


});



// CREATE FILE (with extension)
app.post("/create-file", (req, res) => {
  const { email, folder = "", name, extension } = req.body;

  if (!email || !name || !extension)
    return res.status(400).json({ error: "Missing data" });

  const fileName = `${safe(name)}.${safe(extension)}`;

  const fullPath = path.join(
    UPLOADS,
    safe(email),
    safe(folder),
    fileName
  );

  if (fs.existsSync(fullPath))
    return res.status(409).json({ error: "File already exists" });

  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, "", "utf8");

  res.json({ ok: true, file: fileName });
});


/* ================= MULTER ================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(
      UPLOADS,
      safe(req.body.email),
      safe(req.body.folder || "")
    );
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, file.originalname.trim())
});

const upload = multer({ storage });

/* ================= FILE OPS ================= */

// CREATE FOLDER
app.post("/create-folder", (req, res) => {
  const dir = path.join(
    UPLOADS,
    safe(req.body.email),
    safe(req.body.folder || ""),
    safe(req.body.name)
  );
  fs.mkdirSync(dir, { recursive: true });
  res.json({ ok: true });
});

// LIST FILES
app.post("/list-files", (req, res) => {
  const dir = path.join(
    UPLOADS,
    safe(req.body.email),
    safe(req.body.folder || "")
  );

  if (!fs.existsSync(dir)) return res.json({ files: [] });

  const files = fs.readdirSync(dir).map(n => {
    const s = fs.statSync(path.join(dir, n));
    return { name: n, isFolder: s.isDirectory(), size: s.size };
  });

  res.json({ files });
});

// UPLOAD
app.post("/upload", upload.array("files", 20), (req, res) =>
  res.json({ ok: true })
);

// DELETE
app.post("/delete-file", (req, res) => {
  const p = path.join(UPLOADS, safe(req.body.email), safe(req.body.path));
  fs.lstatSync(p).isDirectory()
    ? fs.rmSync(p, { recursive: true, force: true })
    : fs.unlinkSync(p);
  res.json({ ok: true });
});

// RENAME
app.post("/rename-file", (req, res) => {
  const oldP = path.join(
    UPLOADS,
    safe(req.body.email),
    safe(req.body.oldPath)
  );
  const newP = path.join(path.dirname(oldP), safe(req.body.newName));
  fs.renameSync(oldP, newP);
  res.json({ ok: true });
});

// DOWNLOAD
app.get("/download/:email/*", (req, res) => {
  const p = path.join(
    UPLOADS,
    safe(req.params.email),
    safe(req.params[0])
  );
  res.download(p);
});

/* ================= SHARING ================= */

app.post("/share", (req, res) => {
  const { email, files, permission } = req.body;
  if (!email || !files?.length)
    return res.status(400).json({ error: "Invalid request" });

  const db = readShares();
  const t = token();

  db[t] = {
    email,
    files: files.map(safe),
    permission,
    expires: Date.now() + 86400000
  };

  writeShares(db);

  res.json({ url: `https://vasuki.cloud/share.html?token=${t}` });
});

app.get("/shared-info/:token", (req, res) => {
  const db = readShares();
  res.json(db[req.params.token] || {});
});

app.get("/shared-file/:token/*", (req, res) => {
  const db = readShares();
  const s = db[req.params.token];
  if (!s || Date.now() > s.expires) return res.sendStatus(404);

  const rel = safe(req.params[0]);
  if (!s.files.includes(rel)) return res.sendStatus(403);

  const p = path.join(UPLOADS, safe(s.email), rel);
  if (!fs.existsSync(p)) return res.sendStatus(404);

  res.sendFile(p);
});

/* ================= START ================= */

app.listen(PORT, () =>
  console.log(`🚀 Vasuki Cloud backend running on ${PORT}`)
);
