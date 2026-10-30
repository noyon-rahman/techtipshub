"use client";

import {
  createCategoryForComposer,
  getCategoriesForPicker,
  type ICreateCategoryPayload,
} from "@/services/category/browser";
import type { ICategory } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const CATEGORIES_FOR_PICKER_KEY = ["CATEGORIES_FOR_PICKER"] as const;

/** Long enough that a writer moving between titles does not refetch the list. */
const CATEGORY_STALE_MS = 5 * 60 * 1000;

/**
 * The category list a writer picks from.
 *
 * The query fails fast (`retry: 0`) so the field can say the list did not load
 * and offer a retry, instead of holding a spinner through three backoff waits.
 */
export const useCategoryList = () => {
  const query = useQuery({
    queryKey: CATEGORIES_FOR_PICKER_KEY,
    queryFn: getCategoriesForPicker,
    staleTime: CATEGORY_STALE_MS,
    retry: 0,
  });

  return {
    categories: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
};

/**
 * A category a member created from the composer. The picker reads the new row
 * from the list itself once the mutation has put it there.
 */
export const useCreateCategoryForComposer = () => {
  const queryClient = useQueryClient();

  return useMutation<ICategory, Error, ICreateCategoryPayload>({
    mutationKey: ["CREATE_CATEGORY_FOR_COMPOSER"],
    mutationFn: createCategoryForComposer,
    onSuccess: (category) => {
      // Put it in the cached list as well, so a later reopen of the picker or a
      // second composer has it without waiting for the list to go stale. The
      // list's own shape is the same one `getCategoriesForPicker` returns.
      queryClient.setQueryData<ICategory[]>(
        CATEGORIES_FOR_PICKER_KEY,
        (current) =>
          current
            ? [...current.filter((row) => row._id !== category._id), category]
            : [category],
      );
    },
  });
};
