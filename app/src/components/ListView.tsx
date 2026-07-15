"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { ItemDto, ListDto } from "@/lib/types";
import chara from "../../public/chara.png";
import { formatShareCodeForDisplay } from "@/lib/share-code-format";
import { initAudio, playCheckOnSound, playCheckOffSound } from "@/lib/sound";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SurveyModal } from "@/components/SurveyModal";
import { AiEditPanel } from "@/components/AiEditPanel";
import { HeadcountEditor } from "@/components/HeadcountEditor";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { listChannelName, LIST_UPDATED_EVENT } from "@/lib/realtime";

// FR-2.4: 共有反映はSupabase Realtime Broadcastのpush通知が主。
// ポーリングはWebSocket切断時に取りこぼしを回収するフォールバック。
const FALLBACK_POLL_INTERVAL_MS = 15_000;

function groupByCategory(items: ItemDto[]): [string, ItemDto[]][] {
  const map = new Map<string, ItemDto[]>();
  for (const item of items) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  return [...map.entries()];
}

export function ListView({ initialData }: { initialData: ListDto }) {
  const [data, setData] = useState<ListDto>(initialData);
  const [confirmTarget, setConfirmTarget] = useState<ItemDto | null>(null);
  const [showSurvey, setShowSurvey] = useState(false);
  const [copied, setCopied] = useState(false);
  const localUpdateRef = useRef(0);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/lists/${initialData.shareCode}`, { cache: "no-store" });
    if (!res.ok) return;
    const fresh: ListDto = await res.json();
    // 自分の直近の楽観的更新から一定時間内は上書きしない（連打時のちらつき防止）
    if (Date.now() - localUpdateRef.current < 800) return;
    setData(fresh);
  }, [initialData.shareCode]);

  useEffect(() => {
    const timer = setInterval(refresh, FALLBACK_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel(listChannelName(initialData.shareCode))
      .on("broadcast", { event: LIST_UPDATED_EVENT }, () => {
        refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialData.shareCode, refresh]);

  useEffect(() => {
    async function checkSurvey() {
      const res = await fetch(`/api/lists/${initialData.shareCode}/survey`);
      if (!res.ok) return;
      const result = await res.json();
      if (result.shouldShow) setShowSurvey(true);
    }
    checkSurvey();
  }, [initialData.shareCode]);

  const updateItemLocal = useCallback((itemId: string, patch: Partial<ItemDto>) => {
    localUpdateRef.current = Date.now();
    setData((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
    }));
  }, []);

  async function toggleCheck(item: ItemDto, checked: boolean) {
    initAudio();
    updateItemLocal(item.id, { checked });
    if (checked) {
      playCheckOnSound();
    } else {
      playCheckOffSound();
    }

    const res = await fetch(`/api/lists/${data.shareCode}/items/${item.id}/check`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked }),
    });
    if (!res.ok) {
      updateItemLocal(item.id, { checked: !checked });
    }
  }

  function handleCheckboxClick(item: ItemDto) {
    if (item.checked) {
      // FR-2.6: チェックを外す時は確認ダイアログ
      setConfirmTarget(item);
    } else {
      toggleCheck(item, true);
    }
  }

  async function updateQty(item: ItemDto, purchaseQty: number) {
    updateItemLocal(item.id, {
      purchaseQty,
      subtotal: Math.round(purchaseQty * item.unitPrice),
    });
    await fetch(`/api/lists/${data.shareCode}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purchaseQty }),
    });
  }

  async function deleteItem(item: ItemDto) {
    setData((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== item.id) }));
    await fetch(`/api/lists/${data.shareCode}/items/${item.id}`, { method: "DELETE" });
  }

  function handleCopyCode() {
    navigator.clipboard?.writeText(data.shareCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const total = data.items.reduce((sum, i) => sum + i.subtotal, 0);
  const checkedCount = data.items.filter((i) => i.checked).length;
  const groups = groupByCategory(data.items);

  return (
    <div className="flex flex-1 flex-col bg-orange-50 pb-24 dark:bg-neutral-950">
      <header className="sticky top-0 z-10 border-b border-orange-200 bg-orange-50/95 px-4 py-3 backdrop-blur dark:border-orange-900 dark:bg-neutral-950/95">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src={chara} alt="" className="h-10 w-10 shrink-0" />
            <div>
              <HeadcountEditor
                shareCode={data.shareCode}
                adults={data.adults}
                childrenCount={data.children}
                onUpdated={(updated) => setData(updated)}
              />
              <p className="text-xs text-orange-800/70 dark:text-orange-200/70">
                合計 ¥{total.toLocaleString()} / 購入済み {checkedCount}/{data.items.length}
              </p>
            </div>
          </div>
          <button
            onClick={handleCopyCode}
            className="rounded-xl bg-white px-3 py-2 text-sm font-mono font-semibold text-orange-900 shadow-sm dark:bg-neutral-900 dark:text-orange-100"
          >
            {copied ? "コピーしました" : formatShareCodeForDisplay(data.shareCode)}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-4">
        <div className="mb-4">
          <AiEditPanel
            shareCode={data.shareCode}
            items={data.items}
            aiCallsRemaining={data.aiCallsRemaining}
            onApplied={(items) => setData((prev) => ({ ...prev, items }))}
            onCallsRemainingChange={(remaining) =>
              setData((prev) => ({ ...prev, aiCallsRemaining: remaining }))
            }
          />
        </div>

        {groups.map(([category, items]) => (
          <section key={category} className="mb-4">
            <h2 className="mb-2 px-1 text-sm font-bold text-orange-900 dark:text-orange-100">
              {category}
            </h2>
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm dark:bg-neutral-900 ${
                    item.checked ? "opacity-60" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => handleCheckboxClick(item)}
                    className="h-6 w-6 shrink-0 accent-orange-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold text-neutral-800 dark:text-neutral-100 ${
                        item.checked ? "line-through" : ""
                      }`}
                    >
                      {item.name}
                    </p>
                    {item.note && (
                      <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {item.note}
                      </p>
                    )}
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      ¥{item.subtotal.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={item.purchaseQty}
                      onChange={(e) => updateQty(item, Number(e.target.value))}
                      className="w-14 rounded-lg border border-orange-200 px-2 py-1 text-right text-sm dark:bg-neutral-800 dark:border-orange-800"
                    />
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {item.unit}
                    </span>
                    <button
                      onClick={() => deleteItem(item)}
                      aria-label="削除"
                      className="ml-1 rounded-lg px-2 py-1 text-xs text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      <ConfirmDialog
        open={confirmTarget !== null}
        message={`「${confirmTarget?.name ?? ""}」のチェックを外しますか？`}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => {
          if (confirmTarget) toggleCheck(confirmTarget, false);
          setConfirmTarget(null);
        }}
      />

      {showSurvey && (
        <SurveyModal shareCode={data.shareCode} onClose={() => setShowSurvey(false)} />
      )}
    </div>
  );
}
