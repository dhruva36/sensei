import * as React from "react";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  const base =
    "pressable inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors duration-[var(--dur-2)] disabled:cursor-not-allowed disabled:opacity-45";
  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
  };
  const variants = {
    primary:
      "bg-[var(--ink)] text-[var(--surface)] hover:bg-[color-mix(in_srgb,var(--ink)_88%,white)]",
    secondary:
      "bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--border-strong)]",
    ghost: "text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
    danger:
      "bg-[var(--surface)] text-[var(--neg)] border border-[color-mix(in_srgb,var(--neg)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--neg)_8%,var(--surface))]",
  };
  return (
    <button
      className={cn(base, sizes[size], variants[variant], className)}
      {...props}
    />
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--accent-dim)]",
        className,
      )}
      {...props}
    />
  );
});

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--accent-dim)]",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-sm font-medium text-[var(--text-dim)]",
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)]",
        className,
      )}
      {...props}
    />
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-sm text-[var(--text-dim)]">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorText({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-2 text-sm text-[var(--neg)]">{children}</p>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4 animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
