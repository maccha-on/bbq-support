"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { APPETITE_VALUES, DEFAULT_OPTIONS, TEMPERATURE_VALUES, type ConditionKey, type ListOptions } from "@/lib/list-options";
import chara from "../../../public/chara.png";

const OPTION_LABELS: { key: ConditionKey; label: string }[] = [
  { key: "rice", label: "お米を炊きますか？（誰かが飯盒を持参）" },
  { key: "ahijo", label: "アヒージョをやりますか？" },
  { key: "smoke", label: "燻製をやりますか？" },
  { key: "yakisoba", label: "焼きそばをやりますか？" },
  { key: "breakfast", label: "朝食（ワッフル・ホットサンド）をやりますか？" },
  { key: "smore", label: "スモア・焼きマロをやりますか？" },
];

const TEMPERATURE_LABELS: Record<(typeof TEMPERATURE_VALUES)[number], string> = {
  normal: "普通",
  hot: "暑い（ビール+25%）",
  cool: "涼しい（ビール-25%）",
};

const APPETITE_LABELS: Record<(typeof APPETITE_VALUES)[number], string> = {
  late_lunch: "昼ごはん遅め（食材-20%）",
  normal: "ふつう",
  starving: "お腹ペコペコ（食材+20%）",
};

export default function NewListPage() {
  const router = useRouter();
  const [adults, setAdults] = useState(10);
  const [children, setChildren] = useState(0);
  const [options, setOptions] = useState<ListOptions>(DEFAULT_OPTIONS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adults, children, options }),
      });
      if (!res.ok) throw new Error("リストの生成に失敗しました。");
      const data = await res.json();
      router.push(`/list/${data.shareCode}`);
    } catch {
      setError("リストの生成に失敗しました。もう一度お試しください。");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-orange-50 px-4 py-10 dark:bg-neutral-950">
      <div className="w-full max-w-sm">
        <Image
          src={chara}
          alt="骨付き肉にかぶりつくマスコットキャラクター"
          className="mx-auto mb-6 h-16 w-16"
        />
        <h1 className="mb-6 text-center text-xl font-bold text-orange-900 dark:text-orange-100">
          参加人数を入力してください
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
            <label className="mb-1 block text-sm font-semibold text-orange-900 dark:text-orange-100">
              大人の人数
            </label>
            <input
              type="number"
              min={1}
              max={99}
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
              className="w-full rounded-xl border border-orange-300 px-4 py-3 text-lg outline-none focus:border-orange-500 dark:bg-neutral-800 dark:border-orange-800"
              required
            />
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
            <label className="mb-1 block text-sm font-semibold text-orange-900 dark:text-orange-100">
              子供の人数
            </label>
            <input
              type="number"
              min={0}
              max={99}
              value={children}
              onChange={(e) => setChildren(Number(e.target.value))}
              className="w-full rounded-xl border border-orange-300 px-4 py-3 text-lg outline-none focus:border-orange-500 dark:bg-neutral-800 dark:border-orange-800"
              required
            />
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
            <p className="mb-3 text-sm font-semibold text-orange-900 dark:text-orange-100">
              やること・やらないこと
            </p>
            <div className="flex flex-col gap-3">
              {OPTION_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-neutral-700 dark:text-neutral-200">{label}</span>
                  <input
                    type="checkbox"
                    checked={options[key]}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="h-5 w-5 accent-orange-500"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
            <p className="mb-3 text-sm font-semibold text-orange-900 dark:text-orange-100">
              当日の気温
            </p>
            <div className="flex flex-col gap-2">
              {TEMPERATURE_VALUES.map((value) => (
                <label key={value} className="flex items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name="temperature"
                    checked={options.temperature === value}
                    onChange={() => setOptions((prev) => ({ ...prev, temperature: value }))}
                    className="h-4 w-4 accent-orange-500"
                  />
                  <span className="text-neutral-700 dark:text-neutral-200">
                    {TEMPERATURE_LABELS[value]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
            <p className="mb-3 text-sm font-semibold text-orange-900 dark:text-orange-100">
              みんなのお腹具合
            </p>
            <div className="flex flex-col gap-2">
              {APPETITE_VALUES.map((value) => (
                <label key={value} className="flex items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name="appetite"
                    checked={options.appetite === value}
                    onChange={() => setOptions((prev) => ({ ...prev, appetite: value }))}
                    className="h-4 w-4 accent-orange-500"
                  />
                  <span className="text-neutral-700 dark:text-neutral-200">
                    {APPETITE_LABELS[value]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-center text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-orange-500 px-6 py-4 text-lg font-bold text-white shadow-md transition active:scale-95 disabled:opacity-50"
          >
            {loading ? "生成中..." : "買い物リストを作る"}
          </button>
        </form>
      </div>
    </div>
  );
}
