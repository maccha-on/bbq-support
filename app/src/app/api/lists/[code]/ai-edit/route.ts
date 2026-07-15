import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { findListByRawCode } from "@/lib/get-list-by-code";
import { apiError, notFoundError } from "@/lib/api-error";
import { notifyListUpdated } from "@/lib/realtime";
import {
  requestListEdit,
  sanitizeOperations,
  type EditOperation,
} from "@/lib/ai/edit-list";

const AI_EDIT_LIMIT = 30;

const previewSchema = z.object({
  instruction: z.string().min(1).max(500),
});

// L4/L5: 自然言語指示 → AI呼び出し(1回消費) → 検証済み差分プレビューを返す（DBのitemsはまだ変更しない）
export async function POST(
  request: NextRequest,
  { params }: RouteContext<"/api/lists/[code]/ai-edit">
) {
  const { code } = await params;
  const list = await findListByRawCode(code);
  if (!list) return notFoundError();

  const json = await request.json().catch(() => null);
  const parsed = previewSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "INVALID_INPUT", "指示文の入力が不正です。");
  }

  if (list.aiCallCount >= AI_EDIT_LIMIT) {
    return apiError(
      429,
      "AI_LIMIT_REACHED",
      "このリストのAI修正回数の上限（30回）に達しました。手動編集はこれまで通り可能です。"
    );
  }

  let aiResult;
  try {
    aiResult = await requestListEdit(
      parsed.data.instruction,
      list.items,
      list.adults,
      list.children
    );
  } catch {
    // OpenAI失敗時は回数を消費しない（specs/logic-design.md §4.3）
    return apiError(502, "AI_REQUEST_FAILED", "AIへの問い合わせに失敗しました。もう一度お試しください。");
  }

  // 原子的インクリメント（specs/logic-design.md §5）: 呼び出し成功時点で消費
  const incremented = await prisma.shoppingList.updateMany({
    where: { id: list.id, aiCallCount: { lt: AI_EDIT_LIMIT } },
    data: { aiCallCount: { increment: 1 } },
  });
  if (incremented.count === 0) {
    return apiError(429, "AI_LIMIT_REACHED", "このリストのAI修正回数の上限（30回）に達しました。");
  }

  const validItemIds = new Set(list.items.map((i) => i.id));
  const sanitized = sanitizeOperations(aiResult.operations, validItemIds);

  const updatedList = await prisma.shoppingList.findUniqueOrThrow({
    where: { id: list.id },
    select: { aiCallCount: true },
  });

  // itemsは未変更だがaiCallsRemainingの表示が変わるため通知する
  await notifyListUpdated(list.shareCode);

  return NextResponse.json({
    operations: sanitized,
    summary: aiResult.summary,
    aiCallsRemaining: AI_EDIT_LIMIT - updatedList.aiCallCount,
  });
}

const applyOperationSchema = z.union([
  z.object({
    op: z.literal("update_qty"),
    item_id: z.string(),
    new_qty: z.number(),
  }),
  z.object({
    op: z.literal("add_item"),
    category: z.string(),
    name: z.string(),
    qty: z.number(),
    unit: z.string(),
    unit_price: z.number(),
  }),
  z.object({
    op: z.literal("delete_item"),
    item_id: z.string(),
  }),
]);

const applySchema = z.object({
  operations: z.array(applyOperationSchema).max(50),
});

// プレビューで確認済みの操作をDBへ反映する（ユーザーの「適用」操作）
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/lists/[code]/ai-edit">
) {
  const { code } = await params;
  const list = await findListByRawCode(code);
  if (!list) return notFoundError();

  const json = await request.json().catch(() => null);
  const parsed = applySchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "INVALID_INPUT", "適用データの入力が不正です。");
  }

  const validItemIds = new Set(list.items.map((i) => i.id));
  const operations = sanitizeOperations(
    parsed.data.operations as EditOperation[],
    validItemIds
  );

  const maxSortOrder = list.items.reduce((max, i) => Math.max(max, i.sortOrder), 0);
  let nextSortOrder = maxSortOrder + 1;

  await prisma.$transaction(async (tx) => {
    for (const op of operations) {
      if (op.op === "update_qty") {
        const item = list.items.find((i) => i.id === op.item_id);
        if (!item) continue;
        await tx.item.update({
          where: { id: op.item_id },
          data: {
            purchaseQty: op.new_qty,
            subtotal: Math.round(op.new_qty * item.unitPrice),
            manualEdit: true,
          },
        });
      } else if (op.op === "add_item") {
        await tx.item.create({
          data: {
            listId: list.id,
            category: op.category,
            name: op.name,
            requiredAmount: op.qty,
            unit: op.unit,
            purchaseQty: op.qty,
            unitPrice: op.unit_price,
            subtotal: Math.round(op.qty * op.unit_price),
            manualEdit: true,
            sourceBaseItemId: null,
            sortOrder: nextSortOrder++,
          },
        });
      } else if (op.op === "delete_item") {
        await tx.item.deleteMany({ where: { id: op.item_id, listId: list.id } });
      }
    }
  });

  const refreshed = await prisma.item.findMany({
    where: { listId: list.id },
    orderBy: { sortOrder: "asc" },
  });

  await notifyListUpdated(list.shareCode);

  return NextResponse.json({ items: refreshed });
}
