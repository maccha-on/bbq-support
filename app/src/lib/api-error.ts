import { NextResponse } from "next/server";

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export const notFoundError = () =>
  apiError(404, "NOT_FOUND", "指定されたリストが見つかりません。");
