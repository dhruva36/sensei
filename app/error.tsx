"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { Button, Card } from "@/components/ui";

// Note: this Next.js (16.2.x) passes `unstable_retry`, not `reset`, to error.tsx.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
      <Card className="w-full p-6">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-[var(--text-dim)]">
          We hit a snag loading this. It&apos;s usually temporary — try again.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={() => unstable_retry()}>Try again</Button>
          <Link href="/">
            <Button variant="secondary">Go home</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
