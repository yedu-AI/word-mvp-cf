import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const SOURCES = [
  {
    name: "IELTS_2",
    url: "https://raw.githubusercontent.com/kajweb/dict/master/book/1521164657744_IELTS_2.zip"
  },
  {
    name: "IELTS_3",
    url: "https://raw.githubusercontent.com/kajweb/dict/master/book/1521164666922_IELTS_3.zip"
  }
];

function escapeSql(value) {
  return value.replace(/'/g, "''");
}

function cleanText(input) {
  if (typeof input !== "string") return "";
  return input
    .replace(/\s+/g, " ")
    .replace(/\u0000/g, "")
    .trim();
}

function pickMeaningWithPos(entry) {
  const trans = entry?.content?.word?.content?.trans;
  if (!Array.isArray(trans) || trans.length === 0) return "";
  const first = trans[0] ?? {};
  const pos = cleanText(first.pos || first.posCn || "");
  const cn = cleanText(first.tranCn);
  const en = cleanText(first.tranOther);
  const base = cn || en;
  if (!base) return "";
  if (!pos) return base;
  return `${pos} ${base}`;
}

function pickExample(entry) {
  const list = entry?.content?.word?.content?.sentence?.sentences;
  if (!Array.isArray(list) || list.length === 0) return "";
  for (const item of list) {
    const sentence = cleanText(item?.sContent);
    if (!sentence) continue;
    const cn =
      cleanText(item?.sCn) ||
      cleanText(item?.sCnContent) ||
      cleanText(item?.sContentCn) ||
      cleanText(item?.tranCn);
    if (cn) {
      return `${sentence} || ${cn}`;
    }
    return sentence;
  }
  return "";
}

function pickPhonetic(entry) {
  const content = entry?.content?.word?.content ?? {};
  return cleanText(content.ukphone || content.usphone || content.phone || "");
}

async function fetchJsonLinesFromZip(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed: ${url} (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buf);
  const entries = zip.getEntries().filter((item) => item.entryName.toLowerCase().endsWith(".json"));
  if (entries.length === 0) return [];

  const records = [];
  for (const entry of entries) {
    const text = entry.getData().toString("utf8");
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const raw = line.trim();
      if (!raw.startsWith("{")) continue;
      try {
        records.push(JSON.parse(raw));
      } catch {
        // ignore malformed line
      }
    }
  }
  return records;
}

function toWordRows(records) {
  const rows = [];
  for (const item of records) {
    const word = cleanText(item?.headWord || item?.content?.word?.wordHead).toLowerCase();
    if (!word || !/^[a-z][a-z' -]{1,40}$/.test(word)) continue;
    const cnMeaning = pickMeaningWithPos(item);
    const example = pickExample(item);
    const phonetic = pickPhonetic(item);
    const unit = cleanText(item?.bookId || "IELTS");

    rows.push({
      word,
      phonetic,
      cnMeaning: cnMeaning || "IELTS vocabulary",
      example: example || `The word "${word}" appears in IELTS reading passages. || 单词“${word}”常出现在雅思阅读文章中。`,
      level: "IELTS",
      unit
    });
  }

  const dedup = new Map();
  for (const row of rows) {
    if (!dedup.has(row.word)) dedup.set(row.word, row);
  }
  return [...dedup.values()];
}

function buildImportSql(rows) {
  const lines = [];
  for (const row of rows) {
    lines.push(
      `UPDATE words
SET phonetic='${escapeSql(row.phonetic)}',
    cn_meaning='${escapeSql(row.cnMeaning)}',
    example='${escapeSql(row.example)}',
    level='${escapeSql(row.level)}',
    unit='${escapeSql(row.unit)}'
WHERE lower(word)=lower('${escapeSql(row.word)}');`
    );
    lines.push(
      `INSERT INTO words (word, phonetic, cn_meaning, example, level, unit)
SELECT '${escapeSql(row.word)}', '${escapeSql(row.phonetic)}', '${escapeSql(row.cnMeaning)}', '${escapeSql(row.example)}', '${escapeSql(row.level)}', '${escapeSql(row.unit)}'
WHERE NOT EXISTS (SELECT 1 FROM words WHERE lower(word)=lower('${escapeSql(row.word)}'));`
    );
  }
  return lines.join("\n");
}

async function run() {
  const mode = process.argv.includes("--remote") ? "--remote" : "--local";
  const work = await mkdtemp(path.join(tmpdir(), "ielts-import-"));
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const apiRoot = path.resolve(scriptDir, "..");
  try {
    const allRecords = [];
    for (const source of SOURCES) {
      const records = await fetchJsonLinesFromZip(source.url);
      allRecords.push(...records);
      console.log(`[import-ielts] loaded ${records.length} records from ${source.name}`);
    }

    const rows = toWordRows(allRecords);
    if (rows.length === 0) {
      throw new Error("No valid IELTS words parsed from sources.");
    }
    console.log(`[import-ielts] parsed ${rows.length} unique words`);

    const sql = buildImportSql(rows);
    const sqlPath = path.join(work, "ielts_seed.sql");
    await writeFile(sqlPath, sql, "utf8");

    const args = ["d1", "execute", "word_mvp", mode, "--file", sqlPath];
    const wranglerBin = path.resolve(apiRoot, "..", "..", "node_modules", "wrangler", "bin", "wrangler.js");
    const result = spawnSync(process.execPath, [wranglerBin, ...args], {
      cwd: apiRoot,
      stdio: "pipe",
      encoding: "utf8",
      shell: false
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) {
      if (result.error) {
        console.error(`[import-ielts] spawn failed: ${result.error.message}`);
      }
      process.exit(result.status ?? 1);
    }
    console.log("[import-ielts] import completed");
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(`[import-ielts] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
