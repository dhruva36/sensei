import Link from "next/link";
import { Button, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
      <Card className="w-full p-6">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-[var(--text-dim)]">
          This trip doesn&apos;t exist, or the link is incorrect.
        </p>
        <div className="mt-5 flex justify-center">
          <Link href="/">
            <Button>Go home</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
