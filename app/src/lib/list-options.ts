// クライアント・サーバー双方から参照する型・定数（Prisma等のサーバー専用依存を含まない）

export const CONDITION_KEYS = [
  "smoke",
  "yakisoba",
  "ahijo",
  "breakfast",
  "smore",
  "rice",
] as const;

export type ConditionKey = (typeof CONDITION_KEYS)[number];

// 気温オプション: ビールの必要量を ±25% 補正する（暑い=+25%, 涼しい=-25%, 普通=補正なし）
export const TEMPERATURE_VALUES = ["normal", "hot", "cool"] as const;
export type Temperature = (typeof TEMPERATURE_VALUES)[number];
export const TEMPERATURE_FACTORS: Record<Temperature, number> = {
  normal: 1,
  hot: 1.25,
  cool: 0.75,
};

export type ListOptions = Record<ConditionKey, boolean> & {
  temperature: Temperature;
};

export const DEFAULT_OPTIONS: ListOptions = {
  smoke: false,
  yakisoba: true,
  ahijo: true,
  breakfast: true,
  smore: true,
  rice: true,
  temperature: "normal",
};

export function parseOptions(json: string): ListOptions {
  const parsed = JSON.parse(json) as Partial<ListOptions>;
  return { ...DEFAULT_OPTIONS, ...parsed };
}

export function serializeOptions(options: ListOptions): string {
  return JSON.stringify(options);
}
