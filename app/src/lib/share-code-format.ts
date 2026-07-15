// クライアント・サーバー双方から参照する共有コードのフォーマット関数（Prisma等のサーバー専用依存を含まない）

const CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;

// 入力コードの正規化: trim・大文字化・ハイフン除去
export function normalizeShareCode(input: string): string {
  return input.trim().toUpperCase().replace(/-/g, "");
}

export function isValidShareCodeFormat(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  return [...code].every((c) => CODE_CHARS.includes(c));
}

export function formatShareCodeForDisplay(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

export { CODE_CHARS, CODE_LENGTH };
