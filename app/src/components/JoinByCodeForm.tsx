"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinByCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = code.trim().toUpperCase().replace(/-/g, "");
    if (normalized.length !== 8) {
      setError("8桁の共有コードを入力してください。");
      return;
    }
    setError(null);
    router.push(`/list/${normalized}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input
        type="text"
        inputMode="text"
        placeholder="XXXX-XXXX"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={9}
        className="rounded-xl border border-orange-300 px-4 py-3 text-center text-lg tracking-widest uppercase outline-none focus:border-orange-500 dark:bg-neutral-800 dark:border-orange-800"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        className="rounded-xl bg-orange-100 px-4 py-3 font-semibold text-orange-900 transition active:scale-95 dark:bg-orange-900 dark:text-orange-100"
      >
        リストを開く
      </button>
    </form>
  );
}
