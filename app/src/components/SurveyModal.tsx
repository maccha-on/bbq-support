"use client";

import { useState } from "react";

type ShortageItem = {
  itemName: string;
  kind: "excess" | "shortage";
  reason?: string;
};

type Props = {
  shareCode: string;
  onClose: () => void;
};

// FR-3.2/FR-3.3: 過不足品目・原因と、他に欲しかったものを収集するアンケート
export function SurveyModal({ shareCode, onClose }: Props) {
  const [itemName, setItemName] = useState("");
  const [kind, setKind] = useState<"excess" | "shortage">("shortage");
  const [reason, setReason] = useState("");
  const [wantedItems, setWantedItems] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    const shortageItems: ShortageItem[] = itemName.trim()
      ? [{ itemName: itemName.trim(), kind, reason: reason.trim() || undefined }]
      : [];

    await fetch(`/api/lists/${shareCode}/survey`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shortageItems,
        wantedItems: wantedItems.trim() || undefined,
      }),
    }).catch(() => null);

    setSubmitting(false);
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-neutral-900">
        {done ? (
          <div className="py-6 text-center">
            <p className="text-2xl">🍖</p>
            <p className="mt-2 font-semibold text-orange-900 dark:text-orange-100">
              ご協力ありがとうございました！
            </p>
            <button
              onClick={onClose}
              className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
            >
              閉じる
            </button>
          </div>
        ) : (
          <>
            <h2 className="mb-3 text-lg font-bold text-orange-900 dark:text-orange-100">
              買い出しアンケート
            </h2>
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <label className="mb-1 block font-semibold text-neutral-700 dark:text-neutral-200">
                  大きく過不足が生じたもの
                </label>
                <input
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="例：牛肉"
                  className="w-full rounded-lg border border-orange-300 px-3 py-2 dark:bg-neutral-800 dark:border-orange-800"
                />
                <div className="mt-2 flex gap-4">
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      checked={kind === "shortage"}
                      onChange={() => setKind("shortage")}
                    />
                    足りなかった
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      checked={kind === "excess"}
                      onChange={() => setKind("excess")}
                    />
                    余った
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-neutral-700 dark:text-neutral-200">
                  思い当たる原因
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-orange-300 px-3 py-2 dark:bg-neutral-800 dark:border-orange-800"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-neutral-700 dark:text-neutral-200">
                  他に欲しかったもの
                </label>
                <textarea
                  value={wantedItems}
                  onChange={(e) => setWantedItems(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-orange-300 px-3 py-2 dark:bg-neutral-800 dark:border-orange-800"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
              >
                あとで
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                送信する
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
