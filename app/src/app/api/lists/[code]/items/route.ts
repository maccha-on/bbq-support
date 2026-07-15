import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { findListByRawCode } from "@/lib/get-list-by-code";
import { apiError, notFoundError } from "@/lib/api-error";
import { notifyListUpdated } from "@/lib/realtime";

const bodySchema = z.object({
  category: z.string().min(1).max(30),
  name: z.string().min(1).max(50),
  purchaseQty: z.number().min(0).max(999),
  unit: z.string().min(1).max(20),
  unitPrice: z.number().min(0).max(999_999),
  note: z.string().max(200).optional(),
});

// FR-1.2: 品目の手動追加
export async function POST(
  request: NextRequest,
  { params }: RouteContext<"/api/lists/[code]/items">
) {
  const { code } = await params;
  const list = await findListByRawCode(code);
  if (!list) return notFoundError();

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "INVALID_INPUT", "品目の入力が不正です。");
  }

  const { purchaseQty, unitPrice } = parsed.data;
  const maxSortOrder = list.items.reduce((max, i) => Math.max(max, i.sortOrder), 0);

  const item = await prisma.item.create({
    data: {
      listId: list.id,
      category: parsed.data.category,
      name: parsed.data.name,
      requiredAmount: purchaseQty,
      unit: parsed.data.unit,
      purchaseQty,
      unitPrice,
      subtotal: Math.round(purchaseQty * unitPrice),
      note: parsed.data.note ?? null,
      manualEdit: true,
      sourceBaseItemId: null,
      sortOrder: maxSortOrder + 1,
    },
  });

  await notifyListUpdated(list.shareCode);

  return NextResponse.json(item, { status: 201 });
}
