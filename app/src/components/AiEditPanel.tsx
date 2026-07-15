"use client";

import { useState } from "react";
import type { ItemDto } from "@/lib/types";

type EditOperation =
  | { op: "update_qty"; item_id: string; new_qty: number }
  | { op: "add_item"; category: string; name: string; qty: number; unit: string; unit_price: number }
  | { op: "delete_item"; item_id: string };

type Preview = {
  operations: EditOperation[];
  summary: string;
  aiCallsRemaining: number;
};

type Props = {
  shareCode: string;
  items: ItemDto[];
  aiCallsRemaining: number;
  onApplied: (items: ItemDto[]) => void;
  onCallsRemainingChange: (remaining: number) => void;
};

function describeOperation(op: EditOperation, items: ItemDto[]): string {
  if (op.op === "update_qty") {
    const item = items.find((i) => i.id === op.item_id);
    return `${item?.name ?? "品目"}: ${item?.purchaseQty ?? "?"} → ${op.new_qty}${item?.unit ?? ""}`;
  }
  if (op.op === "add_item") {
    return `追加: ${op.name} ${op.qty}${op.unit}`;
  }
  const item = items.find((i) => i.id === op.item_id);
  return `削除: ${item?.name ?? "品目"}`;
}

// FR-1.4/FR-1.5: 自然言語指示→差分プレビュー→適用の2段階UI
export function AiEditPanel({
  shareCode,
  items,
  aiCallsRemaining,
  onApplied,
  onCallsRemainingChange,
}: Props) {
  const [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = aiCallsRemaining <= 0;

  async function handlePreview() {
    if (!instruction.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lists/${shareCode}/ai-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "AI修正に失敗しました。");
        if (typeof data.aiCallsRemaining === "number") {
          onCallsRemainingChange(data.aiCallsRemaining);
        }
        return;
      }
      setPreview(data);
      onCallsRemainingChange(data.aiCallsRemaining);
    } catch {
      setError("AIへの問い合わせに失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!preview) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/lists/${shareCode}/ai-edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operations: preview.operations }),
      });
      const data = await res.json();
      if (res.ok) {
        onApplied(data.items);
        setPreview(null);
        setInstruction("");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
      <p className="mb-2 text-sm font-semibold text-orange-900 dark:text-orange-100">
        言葉でリストを修正（残り{aiCallsRemaining}回）
      </p>
      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="例：ビールを減らしてノンアルを増やして／牛肉を200gに変更して"
        rows={2}
        disabled={disabled}
        className="w-full rounded-xl border border-orange-300 px-3 py-2 text-sm outline-none focus:border-orange-500 disabled:opacity-50 dark:bg-neutral-800 dark:border-orange-800"
      />
      {disabled && (
        <p className="mt-1 text-xs text-red-600">
          このリストのAI修正回数の上限に達しました。手動編集は引き続き利用できます。
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {!preview && (
        <button
          onClick={handlePreview}
          disabled={disabled || loading || !instruction.trim()}
          className="mt-2 w-full rounded-xl bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-900 disabled:opacity-50 dark:bg-orange-900 dark:text-orange-100"
        >
          {loading ? "考え中..." : "修正案を見る"}
        </button>
      )}

      {preview && (
        <div className="mt-3 rounded-xl border border-orange-200 p-3 dark:border-orange-800">
          <p className="mb-2 text-sm text-neutral-700 dark:text-neutral-200">{preview.summary}</p>
          <ul className="mb-3 flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-300">
            {preview.operations.length === 0 && <li>変更はありません。</li>}
            {preview.operations.map((op, i) => (
              <li key={i}>・{describeOperation(op, items)}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={() => setPreview(null)}
              className="flex-1 rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
            >
              破棄
            </button>
            <button
              onClick={handleApply}
              disabled={loading || preview.operations.length === 0}
              className="flex-1 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              適用する
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
