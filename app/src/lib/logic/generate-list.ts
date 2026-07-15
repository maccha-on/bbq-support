import { prisma } from "@/lib/prisma";
import type { BaseItem } from "@/generated/prisma/client";
import type { ConditionKey, ListOptions } from "@/lib/list-options";
import { APPETITE_FACTORS, TEMPERATURE_FACTORS } from "@/lib/list-options";

export {
  APPETITE_VALUES,
  CONDITION_KEYS,
  DEFAULT_OPTIONS,
  TEMPERATURE_VALUES,
  parseOptions,
  serializeOptions,
} from "@/lib/list-options";
export type { Appetite, ConditionKey, ListOptions, Temperature } from "@/lib/list-options";

type GeneratedItem = {
  category: string;
  name: string;
  requiredAmount: number;
  unit: string;
  purchaseQty: number;
  unitPrice: number;
  subtotal: number;
  note: string | null;
  manualEdit: boolean;
  sourceBaseItemId: string;
  sortOrder: number;
};

// 気温オプションで必要量を補正する品目名（ビールは暑い/涼しいで±25%。品目名はlocal/data/shopping_list.csvのitem列と一致させる）
const TEMPERATURE_SENSITIVE_ITEM_NAMES = new Set(["ビール"]);

// 炭の計算は人数に対して非線形（オガ備長炭は大人31人以上でのみ1箱、ふつうの炭はオガ備長炭を買う場合は1箱固定）なため、
// CSVの汎用列（比例/固定/最低数量）では表現できず品目名で特殊処理する。品目名はlocal/data/shopping_list.csvのitem列と一致させる。
const OGA_BINCHOTAN_ITEM_NAME = "オガ備長炭";
const NORMAL_CHARCOAL_ITEM_NAME = "ふつうの炭(マングローブ炭)";
const OGA_BINCHOTAN_MIN_ADULTS = 31;

function needsOgaBinchotan(adults: number): boolean {
  return adults >= OGA_BINCHOTAN_MIN_ADULTS;
}

function computeFromBase(
  base: BaseItem,
  adults: number,
  children: number,
  options: ListOptions
): GeneratedItem | null {
  // condition_key を持つ行は、対応するオプションのON/OFFと condition_value が一致する場合のみ含める
  if (base.conditionKey) {
    const key = base.conditionKey as ConditionKey;
    const enabled = options[key] ?? false;
    const wantsYes = base.conditionValue === "yes";
    if (enabled !== wantsYes) return null;
  }

  let requiredAmount: number;
  if (base.name === OGA_BINCHOTAN_ITEM_NAME) {
    // 大人31人以上のときのみ1箱（0か1の二択）
    requiredAmount = needsOgaBinchotan(adults) ? 1 : 0;
  } else if (base.name === NORMAL_CHARCOAL_ITEM_NAME) {
    // オガ備長炭を買う場合（大人31人以上）は補助として1箱固定、それ以外は人数比例
    const perAdult = base.qtyPerAdult ?? 0;
    requiredAmount = needsOgaBinchotan(adults) ? 1 : Math.max(perAdult * adults, base.minQty ?? 0);
  } else if (base.minQty !== null && base.stepPeople !== null) {
    // 最低数量 + 合計人数の刻み(stepPeople人ごとにstepQty)で増える品目（例: 最低2個、10人ごとに1個追加）
    const stepPeople = base.stepPeople ?? 0;
    const stepQty = base.stepQty ?? 0;
    const totalPeople = adults + children;
    const steps = stepPeople > 0 ? Math.floor(totalPeople / stepPeople) : 0;
    requiredAmount = base.minQty + steps * stepQty;
  } else if (base.fixedQty !== null) {
    requiredAmount = base.fixedQty;
  } else {
    const perAdult = base.qtyPerAdult ?? 0;
    const perChild = base.qtyPerChild ?? 0;
    const proportional = (perAdult * adults + perChild * children) * APPETITE_FACTORS[options.appetite];
    // minQtyのみ設定されている場合は「人数比例とminQtyの大きい方」（例: バター最低1パック）
    requiredAmount = base.minQty !== null ? Math.max(proportional, base.minQty) : proportional;
  }

  if (TEMPERATURE_SENSITIVE_ITEM_NAMES.has(base.name)) {
    requiredAmount *= TEMPERATURE_FACTORS[options.temperature];
  }

  // 必要量が0の品目は生成しない（fixedQty指定の常備品は0にならないため常に含まれる）
  if (requiredAmount <= 0) return null;

  const purchaseQty = base.roundMode === "down" ? Math.floor(requiredAmount) : Math.ceil(requiredAmount);
  const unitPrice = base.unitPrice ?? 0;
  const subtotal = Math.round(purchaseQty * unitPrice);

  return {
    category: base.category,
    name: base.name,
    requiredAmount,
    unit: base.unit,
    purchaseQty,
    unitPrice,
    subtotal,
    note: [base.shortNote, base.detailNote].filter(Boolean).join(" / ") || null,
    manualEdit: false,
    sourceBaseItemId: base.id,
    sortOrder: base.sortOrder,
  };
}

// L1: 大人・子供人数とオプションから、原単位マスタを参照して購入品目一覧を計算する（specs/logic-design.md §2）
export async function computeItemsFromBaseItems(
  adults: number,
  children: number,
  options: ListOptions
): Promise<GeneratedItem[]> {
  const baseItems = await prisma.baseItem.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  const items: GeneratedItem[] = [];
  for (const base of baseItems) {
    const item = computeFromBase(base, adults, children, options);
    if (item) items.push(item);
  }
  return items;
}

export function calcTotal(items: { subtotal: number }[]): number {
  return items.reduce((sum, item) => sum + item.subtotal, 0);
}

// specs/logic-design.md §2.4: 人数変更時の再計算。
// 手動編集済み品目（manualEdit=true）と、原単位マスタに存在しない手動追加品目は現在値を維持する。
export async function recomputeItemsForHeadcountChange(
  listId: string,
  adults: number,
  children: number,
  options: ListOptions
) {
  const [baseItems, currentItems] = await Promise.all([
    prisma.baseItem.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.item.findMany({ where: { listId } }),
  ]);

  const baseItemById = new Map(baseItems.map((b) => [b.id, b]));

  const deleteIds: string[] = [];
  const updates: { id: string; requiredAmount: number; purchaseQty: number; subtotal: number }[] = [];

  for (const item of currentItems) {
    if (item.manualEdit) continue; // 手動編集済み・手動追加品目は維持
    const base = item.sourceBaseItemId ? baseItemById.get(item.sourceBaseItemId) : null;
    if (!base) continue;

    const recomputed = computeFromBase(base, adults, children, options);
    if (!recomputed) {
      // 該当条件を満たさなくなった（例: オプションOFF）場合は品目を削除
      deleteIds.push(item.id);
      continue;
    }

    updates.push({
      id: item.id,
      requiredAmount: recomputed.requiredAmount,
      purchaseQty: recomputed.purchaseQty,
      subtotal: recomputed.subtotal,
    });
  }

  // 現在リストに存在しない（新たに条件を満たすようになった）原単位品目を追加
  const existingBaseIds = new Set(
    currentItems.filter((i) => i.sourceBaseItemId).map((i) => i.sourceBaseItemId)
  );
  const maxSortOrder = currentItems.reduce((max, i) => Math.max(max, i.sortOrder), 0);
  let nextSortOrder = maxSortOrder + 1;

  const creates: (GeneratedItem & { sortOrder: number })[] = [];
  for (const base of baseItems) {
    if (existingBaseIds.has(base.id)) continue;
    const generated = computeFromBase(base, adults, children, options);
    if (!generated) continue;
    creates.push({ ...generated, sortOrder: nextSortOrder++ });
  }

  await prisma.$transaction(
    [
      ...(deleteIds.length ? [prisma.item.deleteMany({ where: { id: { in: deleteIds } } })] : []),
      ...updates.map((u) =>
        prisma.item.update({
          where: { id: u.id },
          data: {
            requiredAmount: u.requiredAmount,
            purchaseQty: u.purchaseQty,
            subtotal: u.subtotal,
          },
        })
      ),
      ...(creates.length
        ? [prisma.item.createMany({ data: creates.map((c) => ({ listId, ...c })) })]
        : []),
      prisma.shoppingList.update({
        where: { id: listId },
        data: { adults, children, options: JSON.stringify(options) },
      }),
    ],
    { timeout: 20000 }
  );
}
