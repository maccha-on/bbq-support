"use client";

import { useState } from "react";
import type { ItemDto } from "@/lib/types";

type Props = {
  shareCode: string;
  onAdded: (item: ItemDto) => void;
};

// FR-1.2: 品目の手入力追加
export function AddItemPanel({ shareCode, onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [purchaseQty, setPurchaseQty] = useState(1);
  const [unit, setUnit] = useState("個");
  const [unitPrice, setUnitPrice] = useState(0);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setCategory("");
    setName("");
    setPurchaseQty(1);
    setUnit("個");
    setUnitPrice(0);
    setNote("");
    setError(null);
  }

  async function handleSubmit() {
    if (!category.trim() || !name.trim() || !unit.trim()) {
      setError("項目名・カテゴリ・単位は必須です。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lists/${shareCode}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category.trim(),
          name: name.trim(),
          purchaseQty,
          unit: unit.trim(),
          unitPrice,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "品目の追加に失敗しました。");
        return;
      }
      onAdded(data);
      resetForm();
      setOpen(false);
    } catch {
      setError("品目の追加に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-orange-900 shadow-sm dark:bg-neutral-900 dark:text-orange-100"
      >
        ＋ 品目を手入力で追加
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
      <p className="mb-2 text-sm font-semibold text-orange-900 dark:text-orange-100">
        品目を手入力で追加
      </p>
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="カテゴリ（例：肉・飲み物）"
          className="w-full rounded-xl border border-orange-300 px-3 py-2 text-sm outline-none focus:border-orange-500 dark:bg-neutral-800 dark:border-orange-800"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="項目名"
          className="w-full rounded-xl border border-orange-300 px-3 py-2 text-sm outline-none focus:border-orange-500 dark:bg-neutral-800 dark:border-orange-800"
        />
        <div className="flex gap-2">
          <label className="flex flex-1 items-center gap-1 text-xs text-neutral-600 dark:text-neutral-300">
            数量
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              value={purchaseQty}
              onChange={(e) => setPurchaseQty(Number(e.target.value))}
              className="w-full [appearance:textfield] rounded-lg border border-orange-300 px-2 py-1 text-sm dark:bg-neutral-800 dark:border-orange-800 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </label>
          <label className="flex flex-1 items-center gap-1 text-xs text-neutral-600 dark:text-neutral-300">
            単位
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="個・g・本"
              className="w-full rounded-lg border border-orange-300 px-2 py-1 text-sm dark:bg-neutral-800 dark:border-orange-800"
            />
          </label>
        </div>
        <label className="flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-300">
          単価（円）
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={999999}
            value={unitPrice}
            onChange={(e) => setUnitPrice(Number(e.target.value))}
            className="w-full [appearance:textfield] rounded-lg border border-orange-300 px-2 py-1 text-sm dark:bg-neutral-800 dark:border-orange-800 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="メモ（任意）"
          className="w-full rounded-xl border border-orange-300 px-3 py-2 text-sm outline-none focus:border-orange-500 dark:bg-neutral-800 dark:border-orange-800"
        />
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {
            resetForm();
            setOpen(false);
          }}
          disabled={loading}
          className="flex-1 rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
        >
          キャンセル
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "追加中..." : "追加する"}
        </button>
      </div>
    </div>
  );
}
