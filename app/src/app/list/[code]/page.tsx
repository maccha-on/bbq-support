import { notFound } from "next/navigation";
import { findListByRawCode } from "@/lib/get-list-by-code";
import { calcTotal, parseOptions } from "@/lib/logic/generate-list";
import { ListView } from "@/components/ListView";

export default async function ListPage({
  params,
}: PageProps<"/list/[code]">) {
  const { code } = await params;
  const list = await findListByRawCode(code);
  if (!list) notFound();

  const initialData = {
    id: list.id,
    shareCode: list.shareCode,
    adults: list.adults,
    children: list.children,
    options: parseOptions(list.options),
    items: list.items,
    total: calcTotal(list.items),
    aiCallsRemaining: 30 - list.aiCallCount,
  };

  return <ListView initialData={initialData} />;
}
