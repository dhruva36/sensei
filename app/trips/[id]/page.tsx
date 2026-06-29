import { notFound } from "next/navigation";
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

  if (!data) notFound();

  const { balances, transfers } = settle(
    data.transactions,
    data.members.map((m) => m.id),
    data.settlements,
  );

  return (
    <TripView
      trip={data.trip}
      members={data.members}
      transactions={data.transactions}
      settlements={data.settlements}
      balances={balances}
      transfers={transfers}
    />
  );
}
