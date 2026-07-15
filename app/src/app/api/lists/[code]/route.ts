import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findListByRawCode } from "@/lib/get-list-by-code";
import {
  calcTotal,
  parseOptions,
  recomputeItemsForHeadcountChange,
} from "@/lib/logic/generate-list";
import { CONDITION_KEYS, DEFAULT_OPTIONS, TEMPERATURE_VALUES } from "@/lib/list-options";
import { apiError, notFoundError } from "@/lib/api-error";
import { isRateLimited, recordFailedAttempt, getClientIp } from "@/lib/rate-limit";
import { notifyListUpdated } from "@/lib/realtime";

export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/lists/[code]">
) {
  const { code } = await params;

  // 総当たり対策（specs/logic-design.md §3.3）: 失敗のみカウントする。
  // 成功リクエストを数えると正常な同期ポーリングまで429になるため。
  const ip = getClientIp(request);
  const rateLimitKey = `code-lookup:${ip}`;
  if (await isRateLimited(rateLimitKey)) {
    return apiError(429, "TOO_MANY_REQUESTS", "リクエストが多すぎます。しばらくしてから再度お試しください。");
  }

  const list = await findListByRawCode(code);
  if (!list) {
    await recordFailedAttempt(rateLimitKey);
    return notFoundError();
  }

  return NextResponse.json({
    id: list.id,
    shareCode: list.shareCode,
    adults: list.adults,
    children: list.children,
    options: parseOptions(list.options),
    items: list.items,
    total: calcTotal(list.items),
    aiCallsRemaining: 30 - list.aiCallCount,
  });
}

const patchSchema = z.object({
  adults: z.number().int().min(1).max(99),
  children: z.number().int().min(0).max(99),
  options: z
    .object({
      ...Object.fromEntries(CONDITION_KEYS.map((k) => [k, z.boolean().optional()])),
      temperature: z.enum(TEMPERATURE_VALUES).optional(),
    })
    .partial()
    .optional(),
});

// FR-1.3: 生成後の人数変更。手動編集済み・手動追加の品目は現在値を維持し、それ以外を再計算する（specs/logic-design.md §2.4）
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext<"/api/lists/[code]">
) {
  const { code } = await params;
  const list = await findListByRawCode(code);
  if (!list) return notFoundError();

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "INVALID_INPUT", "人数の入力が不正です。");
  }

  const options = { ...DEFAULT_OPTIONS, ...(parsed.data.options ?? parseOptions(list.options)) };

  await recomputeItemsForHeadcountChange(
    list.id,
    parsed.data.adults,
    parsed.data.children,
    options
  );

  const updated = await findListByRawCode(code);
  if (!updated) return notFoundError();

  await notifyListUpdated(updated.shareCode);

  return NextResponse.json({
    id: updated.id,
    shareCode: updated.shareCode,
    adults: updated.adults,
    children: updated.children,
    options: parseOptions(updated.options),
    items: updated.items,
    total: calcTotal(updated.items),
    aiCallsRemaining: 30 - updated.aiCallCount,
  });
}
