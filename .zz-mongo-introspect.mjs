import fs from "node:fs";
import mongoose from "mongoose";

const txt = fs.readFileSync(".env.local", "utf8");
const uri = (txt.match(/^MONGODB_URI=(.*)$/m) || [])[1]?.trim();
if (!uri) { console.error("нет MONGODB_URI"); process.exit(1); }

function keysOf(obj, depth) {
  if (!obj || typeof obj !== "object") return "";
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) out.push(k);
    else if (Array.isArray(v)) out.push(k + "[]");
    else if (typeof v === "object") out.push(depth > 0 ? k + "{}" : k);
    else out.push(k);
  }
  return out.slice(0, 40).join(", ");
}

const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
const db = conn.connection.db;
const colls = (await db.listCollections().toArray()).map(c => c.name).sort();
const rows = [];
for (const name of colls) {
  const col = db.collection(name);
  const count = await col.countDocuments();
  const sample = await col.findOne({});
  rows.push({ name, count, keys: sample ? keysOf(sample, 1) : "" });
}
rows.sort((a, b) => b.count - a.count);
console.log("=== коллекции: count \t name \t поля (топ-40) ===");
for (const r of rows) {
  console.log(`${r.count}\t${r.name}\t${r.keys}`);
}
await conn.disconnect();
