import Link from "next/link";
import { redirect } from "next/navigation";
import { getEventByCode } from "@/lib/data";
import { Button, Card } from "@/components/ui";

// Clean share links: /j/ABC123 -> redirects to the event dashboard.
export default async function JoinByCode({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const event = await getEventByCode(code);

  if (event) redirect(`/events/${event.id}`);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
      <Card className="w-full p-6">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
          Invalid link
        </h1>
        <p className="mt-2 text-sm text-[var(--text-dim)]">
          We couldn&apos;t find an event for code{" "}
          <span className="tnum font-semibold tracking-widest text-[var(--text)]">
            {code}
          </span>
          .
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
