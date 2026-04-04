const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { SCRIPT_CATALOG } = require("../src/script-catalog");

const ROOT = path.join(__dirname, "..");

const headerChecks = [
  "// ==UserScript==",
  "@name",
  "@version",
  "@match",
  "@run-at",
  "// ==/UserScript=="
];

let checked = 0;

for (const script of Object.values(SCRIPT_CATALOG.scripts)) {
  const targetPath = path.join(ROOT, script.file);
  if (!fs.existsSync(targetPath)) {
    throw new Error("[check-userscripts] Missing script file: " + script.file);
  }

  const source = fs.readFileSync(targetPath, "utf8");
  for (const token of headerChecks) {
    if (!source.includes(token)) {
      throw new Error("[check-userscripts] Missing header token " + token + " in " + script.file);
    }
  }

  new vm.Script(source, { filename: script.file });
  checked += 1;
}

console.log("[check-userscripts] Checked " + checked + " userscript files.");
