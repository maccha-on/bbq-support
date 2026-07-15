/**
 * local/ 配下の秘密データ（原単位の実データ等）を暗号化・復号するツール。
 *
 * このリポジトリは public 公開されるため、local/ の実データは平文ではコミットできない
 * （CLAUDE.md / 要件書 NFR-2 参照）。代わりに local/ 全体を単一の暗号化アーカイブ
 * data/local.enc に固めてコミットし、必要な環境で復号して local/ を復元する。
 *
 * 使い方（app/ ディレクトリで実行）:
 *   npm run data:encrypt                 local/ → data/local.enc を生成
 *   npm run data:decrypt                 data/local.enc → local/ を復元（既存の local/ があれば中断）
 *   npm run data:decrypt -- --force      既存の local/ に上書き復元
 *   npm run data:decrypt -- --out <dir>  指定ディレクトリへ復元（動作確認用）
 *
 * パスワードは環境変数 DATA_PASSWORD（app/.env、Git 管理外）から読む。
 * 暗号方式: scrypt (N=2^17, r=8, p=1) で鍵導出 + AES-256-GCM（認証付き暗号）。
 * ファイル名を含む全内容が暗号化されるため、リポジトリ上からは中身を一切推測できない。
 * 一方、public リポジトリ上の暗号文は恒久的にオフライン総当たりの対象になるため、
 * DATA_PASSWORD には20文字以上のランダム文字列を使うこと。
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

const APP_DIR = resolve(__dirname, "..");
const ROOT_DIR = resolve(APP_DIR, "..");
const LOCAL_DIR = join(ROOT_DIR, "local");
const ENC_FILE = join(ROOT_DIR, "data", "local.enc");

// 暗号化ファイルのフォーマット: MAGIC | salt(16) | iv(12) | authTag(16) | ciphertext
const MAGIC = Buffer.from("BBQLOCAL1");
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const SCRYPT_OPTIONS = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

// OSが勝手に作るファイルはアーカイブに含めない
const JUNK_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

type Manifest = {
  version: 1;
  createdAt: string;
  files: { path: string; data: string }[];
};

function loadPassword(): string {
  const envPath = join(APP_DIR, ".env");
  try {
    // 既にシェル側で DATA_PASSWORD が設定されている場合はそちらが優先される
    process.loadEnvFile(envPath);
  } catch {
    // .env が無くても環境変数で直接渡されていれば動作させる
  }
  const password = process.env.DATA_PASSWORD;
  if (!password) {
    console.error(
      `DATA_PASSWORD が設定されていません。app/.env（Git管理外）に定義するか、環境変数で渡してください。`
    );
    process.exit(1);
  }
  return password;
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LEN, SCRYPT_OPTIONS);
}

function collectFiles(dir: string, baseDir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectFiles(abs, baseDir));
    } else if (entry.isFile() && !JUNK_FILES.has(entry.name)) {
      // マニフェスト内のパスはOS非依存の "/" 区切りで保持する
      result.push(
        abs.slice(baseDir.length + 1).split("\\").join("/")
      );
    }
  }
  return result;
}

function encrypt(password: string) {
  if (!existsSync(LOCAL_DIR)) {
    console.error(`暗号化対象が見つかりません: ${LOCAL_DIR}`);
    process.exit(1);
  }
  if (password.length < 12) {
    console.error(
      "DATA_PASSWORD が短すぎます（12文字未満）。public リポジトリに置く暗号文は総当たり攻撃に恒久的に晒されるため、20文字以上のランダム文字列に変更してから再実行してください。"
    );
    process.exit(1);
  }
  if (password.length < 20) {
    console.warn(
      "警告: DATA_PASSWORD が20文字未満です。push 前に20文字以上のランダム文字列への変更を強く推奨します（push 後の変更は手遅れになります）。"
    );
  }

  const paths = collectFiles(LOCAL_DIR, LOCAL_DIR).sort();
  if (paths.length === 0) {
    console.error(`local/ にファイルがありません: ${LOCAL_DIR}`);
    process.exit(1);
  }

  const manifest: Manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    files: paths.map((p) => ({
      path: p,
      data: readFileSync(join(LOCAL_DIR, p)).toString("base64"),
    })),
  };

  const plaintext = gzipSync(Buffer.from(JSON.stringify(manifest), "utf-8"));
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(password, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const output = Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), ciphertext]);

  mkdirSync(dirname(ENC_FILE), { recursive: true });
  writeFileSync(ENC_FILE, output);

  console.log(`${paths.length} ファイルを暗号化しました:`);
  for (const p of paths) console.log(`  local/${p}`);
  console.log(`→ ${ENC_FILE} (${output.length.toLocaleString()} bytes)`);
}

function decrypt(password: string, outDir: string, force: boolean) {
  if (!existsSync(ENC_FILE)) {
    console.error(`暗号化ファイルが見つかりません: ${ENC_FILE}`);
    process.exit(1);
  }
  const raw = readFileSync(ENC_FILE);
  if (
    raw.length < MAGIC.length + SALT_LEN + IV_LEN + TAG_LEN ||
    !raw.subarray(0, MAGIC.length).equals(MAGIC)
  ) {
    console.error("ファイル形式が不正です。data/local.enc が壊れている可能性があります。");
    process.exit(1);
  }

  let offset = MAGIC.length;
  const salt = raw.subarray(offset, (offset += SALT_LEN));
  const iv = raw.subarray(offset, (offset += IV_LEN));
  const tag = raw.subarray(offset, (offset += TAG_LEN));
  const ciphertext = raw.subarray(offset);

  const key = deriveKey(password, salt);
  let plaintext: Buffer;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    console.error(
      "復号に失敗しました。DATA_PASSWORD が違うか、data/local.enc が破損しています。"
    );
    process.exit(1);
  }

  const manifest: Manifest = JSON.parse(gunzipSync(plaintext).toString("utf-8"));

  if (existsSync(outDir) && readdirSync(outDir).length > 0 && !force) {
    console.error(
      `復元先が既に存在します: ${outDir}\n上書きする場合は --force を付けてください（既存ファイルは復元内容で上書きされますが、アーカイブに無いファイルは削除されません）。`
    );
    process.exit(1);
  }

  for (const file of manifest.files) {
    // 万一の不正パスによるディレクトリ外書き込みを防ぐ
    if (file.path.startsWith("/") || file.path.includes("..") || /^[a-zA-Z]:/.test(file.path)) {
      console.error(`不正なパスをスキップしました: ${file.path}`);
      continue;
    }
    const dest = join(outDir, ...file.path.split("/"));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, Buffer.from(file.data, "base64"));
    console.log(`  ${dest}`);
  }
  console.log(
    `${manifest.files.length} ファイルを復元しました（アーカイブ作成日時: ${manifest.createdAt}）。`
  );
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const force = args.includes("--force");
  const outIndex = args.indexOf("--out");
  const outDir =
    outIndex !== -1 && args[outIndex + 1]
      ? resolve(args[outIndex + 1])
      : LOCAL_DIR;

  const password = loadPassword();
  if (command === "encrypt") {
    encrypt(password);
  } else if (command === "decrypt") {
    decrypt(password, outDir, force);
  } else {
    console.error(
      "使い方: tsx scripts/local-data.ts <encrypt|decrypt> [--force] [--out <dir>]"
    );
    process.exit(1);
  }
}

main();
