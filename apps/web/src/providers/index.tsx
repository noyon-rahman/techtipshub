"use client";

import UserProvider from "@/context/user.provider";
import ToasterMount from "@/components/ui/toaster";
import { HeroUIProvider } from "@heroui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

// Create a client
const queryClient = new QueryClient();

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
