import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeShareCode, isValidShareCodeFormat } from "@/lib/share-code";
import { apiError, notFoundError } from "@/lib/api-error";
import { notifyListUpdated } from "@/lib/realtime";

const bodySchema = z.object({
  checked: z.boolean(),
});

// FR-2.3/FR-2.6: 購入チェックのON/OFF。OFF確認ダイアログはクライアント側の責務。
// 最頻操作かつ1秒以内の共有反映（FR-2.4）に直結するため、リスト全品目の取得はせず
// 「リスト所属の検証＋更新」を1クエリで行う。
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/lists/[code]/items/[itemId]/check">
) {
  const { code, itemId } = await params;
  const shareCode = normalizeShareCode(code);
  if (!isValidShareCodeFormat(shareCode)) return notFoundError();

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "INVALID_INPUT", "チェック状態の入力が不正です。");
  }

  const result = await prisma.item.updateMany({
    where: { id: itemId, list: { shareCode } },
    data: { checked: parsed.data.checked },
  });
  if (result.count === 0) return notFoundError();

  await notifyListUpdated(shareCode);

  return NextResponse.json({ ok: true, checked: parsed.data.checked });
}
