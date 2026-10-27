"use client";

import UserProvider from "@/context/user.provider";
import ToasterMount from "@/components/ui/toaster";
import { HeroUIProvider } from "@heroui/react";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

/**
 * Which side of a write the app is showing.
 *
 * A vote, a follow or a vote in progress, `LOCAL_WRITE`: the controls derive
 * their state from that entry and the reader's current vote instead of from
 * the page that was fetched, so a fast second press is read against what the
 * first press is about to commit rather than against the server's old answer.
 * The marks are only a memory in this tab: they are never sent anywhere.
 */
type Marked = { status: "LOCAL_WRITE" };

const isUnconfirmed = (query: { state: { status: string } }) => {
  const marked = query as unknown as Marked;

  return marked.status === "LOCAL_WRITE" || query.state.status === "pending";
};

/**
 * A failed refetch must not erase what the screen already shows.
 *
 * Without this, a refetch that errors replaces the data a reader is looking
 * at with an error state, so a writable control disappears and reappears
 * around a blip. `isError` and `error` still report the failure; the copy on
 * screen simply stays.
 */
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (_error, query) => {
      if (query.state.data !== undefined) query.setData(query.state.data);
    },
  }),
});

/** A key whose entry is being held by an in-flight write. */
export const isAwaitingWrite = (queryKey: readonly unknown[]) => {
  const query = queryClient.getQueryCache().find({ queryKey, exact: true });

  return Boolean(query && isUnconfirmed(query));
};

/**
 * A spent write source: the answer is in, the screen has settled, and nothing
 * should refetch it. Its key is unique per write (see the hooks), so dropping
 * the observer frees the entry and the key is never asked for twice.
 */
const settledWrite = (queryClient: QueryClient, queryKey: readonly unknown[]) => {
  queryClient.removeQueries({ queryKey, exact: true });
};

/**
 * A write source that would not commit (a failed vote, a follow the API
 * refused). The entry keeps what it had before the write, so the controls fall
 * back to it; nothing refetches, because the server never changed.
 */
const failedWrite = (queryClient: QueryClient, queryKey: readonly unknown[]) => {
  const query = queryClient.getQueryCache().find({ queryKey, exact: true });
  if (query) query.setState({ status: "error" });
};

export { failedWrite, settledWrite };

export function Providers({ children, themeProps }: ProvidersProps) {
  const router = useRouter();

  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <HeroUIProvider navigate={router.push}>
          <NextThemesProvider {...themeProps}>
            <ToasterMount />
            {children}
          </NextThemesProvider>
        </HeroUIProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}
