import { notFound } from "next/navigation";
import { getFullEvent } from "@/lib/data";
import { settle } from "@/lib/settlement";
import EventView from "@/components/EventView";

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getFullEvent(id);

  if (!data) notFound();

  const { balances, transfers } = settle(
    data.transactions,
    data.members.map((m) => m.id),
    data.settlements,
  );

  return (
    <EventView
      event={data.event}
      members={data.members}
      transactions={data.transactions}
      settlements={data.settlements}
      balances={balances}
      transfers={transfers}
    />
  );
}
