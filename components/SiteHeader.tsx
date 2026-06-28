import Link from "next/link";

/** Slim sticky header — wordmark with a gold accent, mirrors the tn_politics nav chrome. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-3">
        <Link
          href="/"
          className="pressable flex items-baseline gap-1.5 whitespace-nowrap"
        >
          <span className="text-lg font-semibold tracking-tight">Sensei</span>
          <span className="accent-hand text-base text-[var(--gold)]">
            split &amp; settle
          </span>
        </Link>
      </div>
    </header>
  );
}
