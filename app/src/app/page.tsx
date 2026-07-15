import Image from "next/image";
import Link from "next/link";
import { JoinByCodeForm } from "@/components/JoinByCodeForm";
import chara from "../../public/chara.png";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-orange-50 px-4 py-12 dark:bg-neutral-950">
      <div className="w-full max-w-sm text-center">
        <Image
          src={chara}
          alt="骨付き肉にかぶりつくマスコットキャラクター"
          className="mx-auto h-24 w-24"
          priority
        />
        <h1 className="mt-4 text-2xl font-bold text-orange-900 dark:text-orange-100">
          BBQお買い物サポート
        </h1>
        <p className="mt-2 text-sm text-orange-800/80 dark:text-orange-200/80">
          人数を入れるだけで、BBQの買い物リストを自動計算。みんなで買い出し状況を共有できます。
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <Link
            href="/new"
            className="w-full rounded-2xl bg-orange-500 px-6 py-4 text-lg font-bold text-white shadow-md transition active:scale-95"
          >
            新しいリストを作る
          </Link>

          <div className="rounded-2xl border border-orange-200 bg-white p-4 text-left shadow-sm dark:border-orange-900 dark:bg-neutral-900">
            <p className="mb-2 text-sm font-semibold text-orange-900 dark:text-orange-100">
              共有コードで開く
            </p>
            <JoinByCodeForm />
          </div>
        </div>
      </div>
    </div>
  );
}
