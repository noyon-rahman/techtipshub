import { siteConfig } from "@/config/site";

const markMetrics = {
  sm: { box: 28, word: "text-[0.9375rem]", gap: "gap-2" },
  md: { box: 32, word: "text-base", gap: "gap-2.5" },
  lg: { box: 44, word: "text-2xl", gap: "gap-3.5" },
} as const;

interface MarkProps {
  size?: keyof typeof markMetrics;
  className?: string;
}

/**
 * The TechTipsHub mark: an amber code-block tile with a chisel-cut T and a
 * grounded cursor block. The tile is fixed amber 400 and the mark is fixed ink
 * in both themes: the carved letter needs a light tile to keep its edge, and
 * the mark is the one element that must look identical on paper and on
 * charcoal.
 */
export const LogoMark = ({ size = "md", className = "" }: MarkProps) => {
  const { box } = markMetrics[size];

  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      height={box}
      viewBox="0 0 128 128"
      width={box}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="currentColor" height="128" rx="28" width="128" />
      <path
        d="M28 32H88L100 44V50H73V96H67L55 84V50H28V32Z"
        fill="#141315"
      />
      <rect fill="#141315" height="18" rx="3" width="18" x="82" y="78" />
    </svg>
  );
};

interface LogoProps extends MarkProps {
  /** Show the wordmark next to the mark. */
  wordmark?: boolean;
  /** The small line under the wordmark. Off by default: the header is tight. */
  tagline?: boolean;
  /** `light` for light surfaces, `dark` for dark ones. Defaults to `currentColor`. */
  tone?: "auto" | "light" | "dark";
  /**
   * Extra type utilities for the wordmark, appended after the size's own. Lets
   * a caller step the name down on phones with `text-[0.9375rem] sm:text-base`
   * instead of mounting a second lockup just to get the smaller size.
   */
  wordClass?: string;
}

/**
 * Horizontal lockup: mark plus wordmark. The name is live text, so it stays
 * selectable, translates with the page and is readable when the SVG fails.
 */
export const Logo = ({
  size = "md",
  wordmark = true,
  tagline = false,
  tone = "auto",
  className = "",
  wordClass = "",
}: LogoProps) => {
  const m = markMetrics[size];
  const toneClass =
    tone === "light"
      ? "text-[#1E1B17]"
      : tone === "dark"
        ? "text-[#F2EDE4]"
        : "text-foreground";

  return (
    <span
      className={`inline-flex items-center ${m.gap} ${toneClass} ${className}`}
    >
      {/*
        The tile is always amber 400 and the T always ink, in both themes.
        It used to inherit `text-primary-accessible`, which is the *text*
        amber: amber 800 on paper. That put the carved T at 2.37:1, so the
        light-mode logo read as a dull brown blob. Amber 400 keeps the mark
        identical to the wordmark's dark-mode look and the T at 9.3:1.
      */}
      <LogoMark size={size} className="shrink-0 text-primary-400" />
      {wordmark && (
        <span className="flex min-w-0 flex-col justify-center leading-none">
          <span
            className={`font-[family-name:var(--type-editorial)] font-bold tracking-tight ${m.word} ${wordClass}`}
          >
            TechTips<span className="text-primary-accessible">Hub</span>
          </span>
          {tagline && (
            <span className="mt-1 text-[0.625rem] font-medium text-default-600">
              {siteConfig.tagline}
            </span>
          )}
        </span>
      )}
    </span>
  );
};
