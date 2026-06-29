import { Spinner } from "@/components/ui";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-5 py-24 text-center text-[var(--text-dim)]">
      <Spinner className="h-6 w-6" />
      <p className="text-sm">Loading…</p>
    </main>
  );
}
