import type { ListOptions } from "@/lib/list-options";

export type ItemDto = {
  id: string;
  listId: string;
  category: string;
  name: string;
  requiredAmount: number;
  unit: string;
  purchaseQty: number;
  unitPrice: number;
  subtotal: number;
  note: string | null;
  checked: boolean;
  manualEdit: boolean;
  sourceBaseItemId: string | null;
  sortOrder: number;
  updatedAt: string | Date;
};

export type ListDto = {
  id: string;
  shareCode: string;
  adults: number;
  children: number;
  options: ListOptions;
  items: ItemDto[];
  total: number;
  aiCallsRemaining: number;
};
