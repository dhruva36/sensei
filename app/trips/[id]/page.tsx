import Link from "next/link";
import { getFullTrip } from "@/lib/data";
import { settle } from "@/lib/settlement";
import TripView from "@/components/TripView";

export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getFullTrip(id);

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Trip not found</h1>
        <p className="text-sm text-slate-500">
          This trip doesn&apos;t exist, or the link is incorrect.
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

  const { balances, transfers } = settle(data.transactions, data.members.map((m) => m.id));

  return (
    <TripView
      trip={data.trip}
      members={data.members}
      transactions={data.transactions}
      balances={balances}
      transfers={transfers}
    />
  );
}
