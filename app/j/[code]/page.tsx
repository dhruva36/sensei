import Link from "next/link";
import { redirect } from "next/navigation";
import { getTripByCode } from "@/lib/data";

// Clean share links: /j/ABC123 -> redirects to the trip dashboard.
export default async function JoinByCode({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const trip = await getTripByCode(code);

  if (trip) redirect(`/trips/${trip.id}`);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Invalid link</h1>
      <p className="text-sm text-slate-500">
        We couldn&apos;t find a trip for code{" "}
        <span className="font-mono font-semibold">{code}</span>.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
      >
        Go home
      </Link>
    </main>
  );
}
