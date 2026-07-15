import { prisma } from "@/lib/prisma";

const WINDOW_MS = 60_000; // 1分
const MAX_ATTEMPTS = 10; // 失敗10回/分を超えたら拒否（specs/logic-design.md §3.3）

// 総当たり対策なのでカウントするのは「失敗」のみ。
// 成功リクエストまで数えると正常な閲覧（フォールバックポーリング等）が巻き込まれるため、
// 判定(isRateLimited)と失敗の記録(recordFailedAttempt)を分離している。

// 現在のウィンドウで失敗回数が上限に達しているか（カウントは増やさない）
export async function isRateLimited(key: string): Promise<boolean> {
  const existing = await prisma.rateLimit.findUnique({ where: { key } });
  if (!existing) return false;
  if (Date.now() - existing.windowStart.getTime() > WINDOW_MS) return false;
  return existing.count >= MAX_ATTEMPTS;
}

// 失敗（コード形式不正・未存在）を1回記録する。固定ウィンドウ方式。
export async function recordFailedAttempt(key: string): Promise<void> {
  const now = new Date();
  const existing = await prisma.rateLimit.findUnique({ where: { key } });

  if (!existing || now.getTime() - existing.windowStart.getTime() > WINDOW_MS) {
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    });
    return;
  }

  await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}
