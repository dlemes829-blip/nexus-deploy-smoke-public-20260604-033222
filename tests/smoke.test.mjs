import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "package.json",
  "README.md",
  "index.html",
  "public/index.html",
  "src/App.jsx",
  "src/lib/supabaseClient.js",
  "supabase/schema.sql",
  ".env.example"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of required) {
  assert(fs.existsSync(path.join(root, file)), "Arquivo obrigatorio ausente: " + file);
}

const pkgPath = path.join(root, "package.json");
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  assert(pkg.scripts, "package.json precisa de scripts");
}

const schema = fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf-8");
assert(schema.includes("create table"), "Supabase schema precisa criar tabelas");

const env = fs.readFileSync(path.join(root, ".env.example"), "utf-8");
assert(env.includes("SUPABASE_URL"), ".env.example precisa de Supabase");

console.log("Agent Nexus smoke ok");
