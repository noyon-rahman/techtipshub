import type {
  IApprovedCategoryRequest,
  IRequestedCategory,
} from "@/services/category/browser";
import type { ICategory } from "@/types";

/**
 * One option in a category field: a live category, or a request this writer
 * made that an admin has not reviewed yet.
 */
export interface ICategoryPickerItem {
  id: string;
  name: string;
  pending: boolean;
  /** The request a pending option stands for, so the field can say where it is. */
  requestId?: string;
}

export const isLiveCategory = (id: string, categories: ICategory[]) =>
  categories.some((category) => category._id === id);

/**
 * The options a writer's category field shows: the live list, then this
 * writer's own asks, which are not categories yet. A name already in the live
 * list is dropped from the asks, so a freshly approved one is not listed twice.
 *
 * The ask's own id is kept: a draft filed under an ask stores that id, and it
 * has to stay selectable until an admin approves it.
 */
export const categoryPickerItems = (
  categories: ICategory[],
  requested: IRequestedCategory[],
  approved: IApprovedCategoryRequest[],
): ICategoryPickerItem[] => {
  const extras = new Map<string, ICategoryPickerItem>();

  for (const item of requested) {
    extras.set(item.id, {
      id: item.id,
      name: item.name,
      pending: true,
      requestId: item.id,
    });
  }

  for (const row of approved) {
    const id = row.category ?? row._id;
    if (extras.has(id) || isLiveCategory(id, categories)) continue;

    extras.set(id, { id, name: row.name, pending: false });
  }

  return [
    ...categories.map((category) => ({
      id: category._id,
      name: category.name,
      pending: false,
    })),
    ...Array.from(extras.values()).filter(
      (item) => !isLiveCategory(item.id, categories),
    ),
  ];
};

/** The name a draft's category is filed under, from the options above. */
export const pickerItemName = (
  items: ICategoryPickerItem[],
  id: string,
): string | undefined => items.find((item) => item.id === id)?.name;
