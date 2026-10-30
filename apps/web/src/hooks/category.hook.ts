"use client";

import { useUser } from "@/context/user.provider";
import {
  getCategoriesForPicker,
  getMyApprovedCategoryRequests,
  requestCategory,
  type ICategoryRequestPayload,
} from "@/services/category/browser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const CATEGORIES_FOR_PICKER_KEY = ["CATEGORIES_FOR_PICKER"] as const;
export const CATEGORY_REQUESTS_MINE_KEY = ["CATEGORY_REQUESTS_MINE"] as const;

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
 * Asks for a category.
 *
 * `requestCategory` resolves with a refusal body, so a 409 is a normal result
 * here: the dialog reads the message and puts it on the name field.
 */
export const useRequestCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["REQUEST_CATEGORY"],
    mutationFn: (payload: ICategoryRequestPayload) => requestCategory(payload),
    onSuccess: (body) => {
      if (!body?.success) return;

      void queryClient.invalidateQueries({
        queryKey: CATEGORIES_FOR_PICKER_KEY,
      });
      void queryClient.invalidateQueries({
        queryKey: CATEGORY_REQUESTS_MINE_KEY,
      });
    },
  });
};

/**
 * The member's approved asks, so a category made from a request can be offered
 * before the next list load picks it up. Guests have no asks, so nothing is
 * asked of the API for them.
 */
export const useMyCategoryRequests = () => {
  const { user } = useUser();

  return useQuery({
    queryKey: CATEGORY_REQUESTS_MINE_KEY,
    queryFn: getMyApprovedCategoryRequests,
    enabled: Boolean(user),
    staleTime: CATEGORY_STALE_MS,
    retry: 0,
  });
};
