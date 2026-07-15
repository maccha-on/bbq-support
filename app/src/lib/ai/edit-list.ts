import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { Item } from "@/generated/prisma/client";

const editOperationSchema = z.object({
  operations: z
    .array(
      z.union([
        z.object({
          op: z.literal("update_qty"),
          item_id: z.string(),
          new_qty: z.number(),
        }),
        z.object({
          op: z.literal("add_item"),
          category: z.string(),
          name: z.string(),
          qty: z.number(),
          unit: z.string(),
          unit_price: z.number(),
        }),
        z.object({
          op: z.literal("delete_item"),
          item_id: z.string(),
        }),
      ])
    )
    .max(50),
  summary: z.string(),
});

export type EditOperation = z.infer<typeof editOperationSchema>["operations"][number];
export type EditOperationResult = z.infer<typeof editOperationSchema>;

const SYSTEM_PROMPT = `あなたはBBQ買い物リストの編集アシスタントです。
ユーザーの自然言語指示を読み取り、リストへの変更操作(operations)のJSONを生成してください。

ルール:
- 数量は0以上999以下の範囲にしてください。
- 存在しない item_id を参照しないでください（渡された品目一覧の id のみ使用可）。
- 操作は最大50件までです。
- 参加人数（大人・子供）そのものを変更する指示には対応していません。その場合は operations を空配列にし、summary で「人数変更には対応していないため、新しいリストを作成してください」と案内してください。
- 指示が曖昧で解釈できない場合も operations を空配列にし、summary でその旨を説明してください。
- summary には変更内容を日本語で簡潔にまとめてください。`;

type CurrentItem = Pick<Item, "id" | "category" | "name" | "purchaseQty" | "unit" | "unitPrice">;

export async function requestListEdit(
  instruction: string,
  currentItems: CurrentItem[],
  adults: number,
  children: number
): Promise<EditOperationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY が設定されていません。");
  }

  const client = new OpenAI({ apiKey });

  const itemsSummary = currentItems.map((i) => ({
    id: i.id,
    category: i.category,
    name: i.name,
    qty: i.purchaseQty,
    unit: i.unit,
    unit_price: i.unitPrice,
  }));

  const completion = await client.chat.completions.parse({
    model: "gpt-4o-2024-08-06",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          adults,
          children,
          items: itemsSummary,
          instruction,
        }),
      },
    ],
    response_format: zodResponseFormat(editOperationSchema, "edit_operations"),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error("AIからの応答を解析できませんでした。");
  }
  return parsed;
}

// L4: サーバー側でAI出力を信用せず再検証する（存在しないitem_id・不正な数量を除去）
export function sanitizeOperations(
  operations: EditOperation[],
  validItemIds: Set<string>
): EditOperation[] {
  const clamp = (n: number) => Math.min(999, Math.max(0, n));

  return operations
    .map((op) => {
      if (op.op === "update_qty") {
        if (!validItemIds.has(op.item_id)) return null;
        return { ...op, new_qty: clamp(op.new_qty) };
      }
      if (op.op === "add_item") {
        return {
          ...op,
          qty: clamp(op.qty),
          unit_price: Math.max(0, Math.min(999_999, op.unit_price)),
        };
      }
      if (op.op === "delete_item") {
        if (!validItemIds.has(op.item_id)) return null;
        return op;
      }
      return null;
    })
    .filter((op): op is EditOperation => op !== null);
}
