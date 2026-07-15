"use client";

type Props = {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// FR-2.6: チェックを外す際の確認ダイアログ
export function ConfirmDialog({ open, message, onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-xl dark:bg-neutral-900">
        <p className="mb-4 text-sm text-neutral-800 dark:text-neutral-100">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-neutral-100 px-4 py-2 font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-500 px-4 py-2 font-semibold text-white"
          >
            外す
          </button>
        </div>
      </div>
    </div>
  );
}
