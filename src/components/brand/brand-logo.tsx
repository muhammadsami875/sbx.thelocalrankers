import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * BrandLogo — the official Local Rankers LLC logo.
 *
 * The source asset has a dark-navy wordmark, so `logo-dark.png` (the wordmark
 * recolored white, arrows untouched) is used on dark surfaces. Both variants
 * are rendered and toggled with CSS rather than reading the theme in JS, which
 * avoids a flash of the wrong logo before hydration.
 *
 * `variant="mark"` renders just the chart-arrow glyph — used by the collapsed
 * sidebar and anywhere the full wordmark would not fit.
 */
export function BrandLogo({
  className,
  variant = "full",
  priority = false,
  /** Force a single variant instead of following the theme. */
  forceTone,
}: {
  className?: string;
  variant?: "full" | "mark";
  priority?: boolean;
  forceTone?: "light" | "dark";
}) {
  if (variant === "mark") {
    return (
      <Image
        src="/images/mark.png"
        alt="Local Rankers"
        width={225}
        height={274}
        priority={priority}
        className={cn("h-8 w-auto", className)}
      />
    );
  }

  // On the navy sidebar the logo always needs the white wordmark, regardless
  // of the app theme — that is what forceTone is for.
  if (forceTone) {
    return (
      <Image
        src={forceTone === "dark" ? "/images/logo-dark.png" : "/images/logo.png"}
        alt="Local Rankers LLC"
        width={1366}
        height={575}
        priority={priority}
        className={cn("h-9 w-auto", className)}
      />
    );
  }

  return (
    <>
      <Image
        src="/images/logo.png"
        alt="Local Rankers LLC"
        width={1366}
        height={575}
        priority={priority}
        className={cn("h-9 w-auto dark:hidden", className)}
      />
      <Image
        src="/images/logo-dark.png"
        alt=""
        aria-hidden
        width={1366}
        height={575}
        priority={priority}
        className={cn("hidden h-9 w-auto dark:block", className)}
      />
    </>
  );
}
