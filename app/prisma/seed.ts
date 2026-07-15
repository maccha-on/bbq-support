import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// NFR-2: 原単位の実データは local/data/ 配下（Git管理外）にのみ存在する。
// このスクリプトはそのCSVを読み込みDB（Supabase PostgreSQL）へ投入する。
const CSV_PATH = resolve(__dirname, "../../local/data/shopping_list.csv");

type CsvRow = {
  purchase_place: string;
  category: string;
  item: string;
  condition_key: string;
  condition_value: string;
  qty_per_adult: string;
  qty_per_child: string;
  fixed_qty: string;
  min_qty: string;
  step_people: string;
  step_qty: string;
  unit: string;
  unit_price_yen: string;
  round_mode: string;
  short_note: string;
  detail_note: string;
};

function toFloatOrNull(value: string): number | null {
  if (value === undefined || value === null || value.trim() === "" || value.trim() === "-") {
    return null;
  }
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function toIntOrNull(value: string): number | null {
  const n = toFloatOrNull(value);
  return n === null ? null : Math.trunc(n);
}

async function main() {
  if (!existsSync(CSV_PATH)) {
    console.error(
      `原単位データが見つかりません: ${CSV_PATH}\n` +
        `local/data/shopping_list.csv はGit管理外のローカル専用データです。開発環境に配置してから再実行してください。`
    );
    process.exit(1);
  }

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  const csvContent = readFileSync(CSV_PATH, "utf-8");
  const rows: CsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`${rows.length} 件の原単位データを読み込みました。`);

  await prisma.baseItem.deleteMany({});

  let sortOrder = 0;
  for (const row of rows) {
    await prisma.baseItem.create({
      data: {
        category: row.category,
        name: row.item,
        conditionKey: row.condition_key?.trim() || null,
        conditionValue: row.condition_value?.trim() || null,
        qtyPerAdult: toFloatOrNull(row.qty_per_adult),
        qtyPerChild: toFloatOrNull(row.qty_per_child),
        fixedQty: toFloatOrNull(row.fixed_qty),
        minQty: toFloatOrNull(row.min_qty),
        stepPeople: toIntOrNull(row.step_people),
        stepQty: toFloatOrNull(row.step_qty),
        unit: row.unit,
        unitPrice: toFloatOrNull(row.unit_price_yen),
        roundMode: row.round_mode?.trim() === "down" ? "down" : "up",
        shortNote: row.short_note?.trim() || null,
        detailNote: row.detail_note?.trim() || null,
        sortOrder: sortOrder++,
        active: true,
      },
    });
  }

  console.log("シード投入が完了しました。");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
