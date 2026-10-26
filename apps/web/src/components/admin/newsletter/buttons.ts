import { focusRing } from "@/components/modules/admin/kit/tau";

/**
 * The two button shapes every newsletter control uses.
 *
 * Written once here rather than per file, because the screen has a modal, an
 * empty state, an export and a send confirmation that must not drift apart.
 */
export const primaryButton = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[6px] bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-500 disabled:opacity-60 sm:min-h-9 ${focusRing}`;

export const quietButton = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[6px] border border-default-300 px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-default-100 disabled:opacity-60 sm:min-h-9 ${focusRing}`;

export const dangerButton = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[6px] bg-danger-600 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-danger-700 disabled:opacity-60 dark:bg-danger dark:text-danger-foreground sm:min-h-9 ${focusRing}`;
