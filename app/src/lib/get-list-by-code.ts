import { prisma } from "@/lib/prisma";
import { normalizeShareCode, isValidShareCodeFormat } from "@/lib/share-code";

// コード検証: 形式不正・未存在を区別せず同一のnullを返す（specs/logic-design.md §3.2）
export async function findListByRawCode(rawCode: string) {
  const code = normalizeShareCode(rawCode);
  if (!isValidShareCodeFormat(code)) return null;

  return prisma.shoppingList.findUnique({
    where: { shareCode: code },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
}
