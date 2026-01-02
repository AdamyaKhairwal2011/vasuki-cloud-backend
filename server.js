const express=require("express");
const multer=require("multer");
const path=require("path");
const fs=require("fs");
const cors=require("cors");

const app=express();
const PORT=3000;

app.use(cors());
app.use(express.json());

const UPLOADS=path.join(__dirname,"uploads");
const SHARES=path.join(__dirname,"shares.json");
if(!fs.existsSync(UPLOADS))fs.mkdirSync(UPLOADS);
if(!fs.existsSync(SHARES))fs.writeFileSync(SHARES,"{}");

const safe=v=>v.replace(/[^a-zA-Z0-9@._/-]/g,"").replace(/\.\./g,"");
const readShares=()=>JSON.parse(fs.readFileSync(SHARES));
const writeShares=d=>fs.writeFileSync(SHARES,JSON.stringify(d,null,2));
const token=()=>Math.random().toString(36).slice(2)+Date.now();

/* MULTER */
const storage=multer.diskStorage({
  destination:(req,file,cb)=>{
    const dir=path.join(UPLOADS,safe(req.body.email),safe(req.body.folder||""));
    fs.mkdirSync(dir,{recursive:true});
    cb(null,dir);
  },
  filename:(req,file,cb)=>cb(null,file.originalname)
});
const upload=multer({storage});

/* CREATE FOLDER */
app.post("/create-folder",(req,res)=>{
  const dir=path.join(UPLOADS,safe(req.body.email),safe(req.body.folder||""),safe(req.body.name));
  fs.mkdirSync(dir,{recursive:true});
  res.json({ok:true});
});

/* LIST */
app.post("/list-files",(req,res)=>{
  const dir=path.join(UPLOADS,safe(req.body.email),safe(req.body.folder||""));
  if(!fs.existsSync(dir))return res.json({files:[]});
  const files=fs.readdirSync(dir).map(n=>{
    const s=fs.statSync(path.join(dir,n));
    return {name:n,isFolder:s.isDirectory(),size:s.size};
  });
  res.json({files});
});

/* UPLOAD */
app.post("/upload",upload.array("files",20),(req,res)=>res.json({ok:true}));

/* DELETE */
app.post("/delete-file",(req,res)=>{
  const p=path.join(UPLOADS,safe(req.body.email),safe(req.body.path));
  fs.lstatSync(p).isDirectory()
    ? fs.rmSync(p,{recursive:true,force:true})
    : fs.unlinkSync(p);
  res.json({ok:true});
});

/* RENAME */
app.post("/rename-file",(req,res)=>{
  const oldP=path.join(UPLOADS,safe(req.body.email),safe(req.body.oldPath));
  const newP=path.join(path.dirname(oldP),safe(req.body.newName));
  fs.renameSync(oldP,newP);
  res.json({ok:true});
});

/* DOWNLOAD */
app.get("/download/:email/*",(req,res)=>{
  const p=path.join(UPLOADS,safe(req.params.email),safe(req.params[0]));
  res.download(p);
});

/* ===== SHARE CREATE (MULTI FILE) ===== */
app.post("/share", (req, res) => {
  const { email, files, permission } = req.body;
  if (!email || !files || !files.length)
    return res.status(400).json({ error: "Invalid share request" });

  const db = readShares();
  const t = token();

  db[t] = {
    email,
    files: files.map(safe),
    permission,
    created: Date.now(),
    expires: Date.now() + 24 * 60 * 60 * 1000
  };

  writeShares(db);

  res.json({
    url: `https://vasuki.cloud/share.html?token=${t}`
  });
});

/* ===== SHARE METADATA ===== */
app.get("/shared-info/:token", (req, res) => {
  const db = readShares();
  const s = db[req.params.token];
  res.json({
    user: s.email,
    files: s.files,
    perm: s.permission
  });
});

/* ===== SHARED FILE ACCESS ===== */
app.get("/shared-file/:token/*", (req, res) => {
  const db = readShares();
  const s = db[req.params.token];
  if (!s || Date.now() > s.expires) return res.sendStatus(404);

  const fileRel = safe(req.params[0]);
  if (!s.files.includes(fileRel)) return res.sendStatus(403);

  const filePath = path.join(UPLOADS, safe(s.email), fileRel);
  if (!fs.existsSync(filePath)) return res.sendStatus(404);

  if (s.permission === "read") {
    res.setHeader("Content-Disposition", "inline");
    res.sendFile(filePath);
  } else {
    res.download(filePath);
  }
});

app.listen(PORT,()=>console.log("🚀 Vasuki Neem backend running"));

