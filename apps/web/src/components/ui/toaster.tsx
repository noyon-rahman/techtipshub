"use client";

import { useTheme } from "next-themes";
import type { CSSProperties } from "react";
import { Toaster } from "sonner";

/**
 * Where `toast()` from sonner draws.
 *
 * Sonner ships its own palette: cool near-black surfaces, and saturated
 * green/red/blue tints for `richColors`. None of that is in the theme, so the
 * toast was the one surface that read as another product. `richColors` is off
 * and the skin below is built from the same tokens as the rest of the site:
 * a `content1` panel, a `default-100` hairline, and status shown as coloured
 * text on the panel rather than a tinted fill, so it follows light and dark
 * like every other panel. The `sonner` `theme` prop still follows ours because
 * it decides which of its own rules are active.
 */
const ToasterMount = () => {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="top-center"
      theme={resolvedTheme === "light" ? "light" : "dark"}
      closeButton
      // Sonner themes through its own CSS variables on the toaster, and those
      // win over the panel class. They are pointed at the site tokens instead,
      // so the palette is ours in both themes, not Sonner's black/near-white.
      // `--border-radius` and the close button's offset are variables too; the
      // radius matches `tth-panel`'s 10px and the offset is zeroed because the
      // button sits in the top row rather than straddling the corner.
      style={
        {
          "--normal-bg": "var(--color-content-1)",
          "--normal-border": "var(--color-default-100)",
          "--normal-text": "var(--color-foreground)",
          "--success-bg": "var(--color-content-1)",
          "--error-bg": "var(--color-content-1)",
          "--info-bg": "var(--color-content-1)",
          "--warning-bg": "var(--color-content-1)",
          "--border-radius": "10px",
          "--toast-close-button-transform": "none",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "tth-panel !gap-3 !px-4 !py-3.5 !font-sans !shadow-lg",
          icon: "!m-0 !size-4 shrink-0 self-start mt-0.5",
          content: "!gap-1",
          title: "!text-sm !font-medium !leading-snug !text-foreground",
          description:
            "!text-[0.8125rem] !leading-relaxed !text-default-600",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-danger",
          warning: "[&_[data-icon]]:!text-warning",
          info: "[&_[data-icon]]:!text-foreground",
          loading: "[&_[data-icon]]:!text-default-600",
          closeButton:
            // Sonner places a round button straddling the corner, two attribute
            // selectors deep, where plain utilities lose. The `[[data-close-button]]`
            // variants outrank those rules and park the button in flow at the end
            // of the icon/title row instead: no `transform`, no absolute offset.
            "[[data-close-button]]:!static [[data-close-button]]:!size-5 [[data-close-button]]:!shrink-0 " +
            "[[data-close-button]]:!translate-x-0 [[data-close-button]]:!translate-y-0 " +
            "[[data-close-button]]:!self-start [[data-close-button]]:!rounded-md [[data-close-button]]:!border-0 " +
            "[[data-close-button]]:!bg-transparent [[data-close-button]]:!text-default-600 " +
            "[[data-close-button]]:hover:!bg-default-100 [[data-close-button]]:hover:!text-foreground",
        },
      }}
    />
  );
};

export default ToasterMount;
