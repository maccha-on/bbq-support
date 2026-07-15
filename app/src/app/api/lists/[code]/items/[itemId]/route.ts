import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { findListByRawCode } from "@/lib/get-list-by-code";
import { apiError, notFoundError } from "@/lib/api-error";
import { notifyListUpdated } from "@/lib/realtime";

const bodySchema = z.object({
  purchaseQty: z.number().min(0).max(999).optional(),
  unitPrice: z.number().min(0).max(999_999).optional(),
  name: z.string().min(1).max(50).optional(),
  note: z.string().max(200).optional(),
});

// FR-1.2/FR-1.3: 品目の数量・内容の手動編集
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/lists/[code]/items/[itemId]">
) {
  const { code, itemId } = await params;
  const list = await findListByRawCode(code);
  if (!list) return notFoundError();

  const item = list.items.find((i) => i.id === itemId);
  if (!item) return notFoundError();

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "INVALID_INPUT", "品目の入力が不正です。");
  }

  const purchaseQty = parsed.data.purchaseQty ?? item.purchaseQty;
  const unitPrice = parsed.data.unitPrice ?? item.unitPrice;

  const updated = await prisma.item.update({
    where: { id: itemId },
    data: {
      purchaseQty,
      unitPrice,
      subtotal: Math.round(purchaseQty * unitPrice),
      name: parsed.data.name ?? item.name,
      note: parsed.data.note ?? item.note,
      manualEdit: true,
    },
  });

  await notifyListUpdated(list.shareCode);

  return NextResponse.json(updated);
}

// FR-1.2: 品目の削除
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext<"/api/lists/[code]/items/[itemId]">
) {
  const { code, itemId } = await params;
  const list = await findListByRawCode(code);
  if (!list) return notFoundError();

  const item = list.items.find((i) => i.id === itemId);
  if (!item) return notFoundError();

  await prisma.item.delete({ where: { id: itemId } });

  await notifyListUpdated(list.shareCode);

  return NextResponse.json({ ok: true });
}
