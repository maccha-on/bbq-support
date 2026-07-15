"use client";

import { useState } from "react";
import type { ListDto } from "@/lib/types";

type Props = {
  shareCode: string;
  adults: number;
  childrenCount: number;
  onUpdated: (data: ListDto) => void;
};

// FR-1.3: 生成後の人数変更
export function HeadcountEditor({ shareCode, adults, childrenCount, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [adultsInput, setAdultsInput] = useState(adults);
  const [childrenInput, setChildrenInput] = useState(childrenCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lists/${shareCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adults: adultsInput, children: childrenInput }),
      });
      if (!res.ok) throw new Error("人数の変更に失敗しました。");
      const data = await res.json();
      onUpdated(data);
      setEditing(false);
    } catch {
      setError("人数の変更に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-left text-xs text-orange-800/70 underline decoration-dotted dark:text-orange-200/70"
      >
        大人{adults}人・子供{childrenCount}人（人数を変更）
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <label className="flex items-center gap-1">
        大人
        <input
          type="number"
          min={1}
          max={99}
          value={adultsInput}
          onChange={(e) => setAdultsInput(Number(e.target.value))}
          className="w-14 rounded border border-orange-300 px-1 py-0.5 dark:bg-neutral-800 dark:border-orange-800"
        />
      </label>
      <label className="flex items-center gap-1">
        子供
        <input
          type="number"
          min={0}
          max={99}
          value={childrenInput}
          onChange={(e) => setChildrenInput(Number(e.target.value))}
          className="w-14 rounded border border-orange-300 px-1 py-0.5 dark:bg-neutral-800 dark:border-orange-800"
        />
      </label>
      <button
        onClick={handleSave}
        disabled={loading}
        className="rounded bg-orange-500 px-2 py-1 font-semibold text-white disabled:opacity-50"
      >
        {loading ? "更新中..." : "更新"}
      </button>
      <button
        onClick={() => setEditing(false)}
        disabled={loading}
        className="rounded bg-neutral-100 px-2 py-1 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
      >
        キャンセル
      </button>
      {error && <p className="w-full text-red-600">{error}</p>}
      <p className="w-full text-[10px] text-neutral-500 dark:text-neutral-400">
        ※ 手動で編集した品目・追加した品目は変更されません。
      </p>
    </div>
  );
}
