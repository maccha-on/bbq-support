import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateUniqueShareCode } from "@/lib/share-code";
import {
  computeItemsFromBaseItems,
  calcTotal,
  DEFAULT_OPTIONS,
  serializeOptions,
  CONDITION_KEYS,
  TEMPERATURE_VALUES,
  APPETITE_VALUES,
} from "@/lib/logic/generate-list";
import { apiError } from "@/lib/api-error";

const bodySchema = z.object({
  adults: z.number().int().min(1).max(99),
  children: z.number().int().min(0).max(99),
  options: z
    .object({
      ...Object.fromEntries(CONDITION_KEYS.map((k) => [k, z.boolean().optional()])),
      temperature: z.enum(TEMPERATURE_VALUES).optional(),
      appetite: z.enum(APPETITE_VALUES).optional(),
    })
    .partial()
    .optional(),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "INVALID_INPUT", "人数の入力が不正です。");
  }

  const { adults, children } = parsed.data;
  const options = { ...DEFAULT_OPTIONS, ...(parsed.data.options ?? {}) };

  const shareCode = await generateUniqueShareCode();
  const generatedItems = await computeItemsFromBaseItems(adults, children, options);

  const list = await prisma.shoppingList.create({
    data: {
      shareCode,
      adults,
      children,
      options: serializeOptions(options),
      items: {
        create: generatedItems,
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(
    {
      id: list.id,
      shareCode: list.shareCode,
      adults: list.adults,
      children: list.children,
      options,
      items: list.items,
      total: calcTotal(list.items),
      aiCallsRemaining: 30 - list.aiCallCount,
    },
    { status: 201 }
  );
}
