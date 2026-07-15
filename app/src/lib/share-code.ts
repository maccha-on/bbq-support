import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { CODE_CHARS, CODE_LENGTH } from "@/lib/share-code-format";

export {
  normalizeShareCode,
  isValidShareCodeFormat,
  formatShareCodeForDisplay,
} from "@/lib/share-code-format";

const MAX_RETRY = 5;

function generateRawCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  }
  return code;
}

// lists.share_code の UNIQUE制約に任せ、衝突時は再生成してリトライする（最大5回）
export async function generateUniqueShareCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const code = generateRawCode();
    const existing = await prisma.shoppingList.findUnique({
      where: { shareCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("共有コードの生成に失敗しました。時間をおいて再度お試しください。");
}
