import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { findListByRawCode } from "@/lib/get-list-by-code";
import { apiError, notFoundError } from "@/lib/api-error";

function isPastNineteenJst(): boolean {
  const jstHour = Number(
    new Intl.DateTimeFormat("ja-JP", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Tokyo",
    }).format(new Date())
  );
  return jstHour >= 19;
}

// L7: アンケート表示判定（50%以上購入済み かつ JST19時以降、1リスト1回限り）
export async function GET(
  _request: NextRequest,
  { params }: RouteContext<"/api/lists/[code]/survey">
) {
  const { code } = await params;
  const list = await findListByRawCode(code);
  if (!list) return notFoundError();

  if (list.surveyTriggered) {
    return NextResponse.json({ shouldShow: false });
  }

  const total = list.items.length;
  const checkedCount = list.items.filter((i) => i.checked).length;
  const ratio = total > 0 ? checkedCount / total : 0;

  if (ratio < 0.5 || !isPastNineteenJst()) {
    return NextResponse.json({ shouldShow: false });
  }

  // 原子的UPDATE: 複数ユーザー同時アクセスでも最初の1件だけが表示指示を受け取る
  const result = await prisma.shoppingList.updateMany({
    where: { id: list.id, surveyTriggered: false },
    data: { surveyTriggered: true, surveyTriggeredAt: new Date() },
  });

  return NextResponse.json({ shouldShow: result.count === 1 });
}

const shortageItemSchema = z.object({
  itemName: z.string().min(1).max(50),
  kind: z.enum(["excess", "shortage"]),
  reason: z.string().max(500).optional(),
});

const bodySchema = z.object({
  shortageItems: z.array(shortageItemSchema).max(50),
  wantedItems: z.string().max(1000).optional(),
});

// FR-3.2/FR-3.3: アンケート回答の保存
export async function POST(
  request: NextRequest,
  { params }: RouteContext<"/api/lists/[code]/survey">
) {
  const { code } = await params;
  const list = await findListByRawCode(code);
  if (!list) return notFoundError();

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "INVALID_INPUT", "アンケート回答の入力が不正です。");
  }

  const feedback = await prisma.feedback.create({
    data: {
      listId: list.id,
      shortageItems: JSON.stringify(parsed.data.shortageItems),
      wantedItems: parsed.data.wantedItems ?? null,
    },
  });

  return NextResponse.json(feedback, { status: 201 });
}
