"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plane, Users, ArrowRight, Check } from "lucide-react";
import { useUsername } from "@/lib/identity";
import { createTrip, joinTripByCode } from "@/app/actions";
import { Button, Card, ErrorText, Input, Label, Spinner } from "@/components/ui";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD"];

export default function Home() {
  const router = useRouter();
  const [name, setName] = useUsername();
  const [draftName, setDraftName] = useState("");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-10">
      <header className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
          <Plane className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Sensei
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Split trip expenses with friends and settle up in the fewest payments.
        </p>
      </header>

      {/* Username */}
      <Card className="p-5">
        {!name ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draftName.trim()) setName(draftName);
            }}
          >
            <Label htmlFor="name">What should we call you?</Label>
            <div className="flex gap-2">
              <Input
                id="name"
                autoFocus
                placeholder="e.g. Dhruva"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
              />
              <Button type="submit" disabled={!draftName.trim()}>
                Save
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Stored on this device — no account needed.
            </p>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                {name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-slate-400">You are</p>
                <p className="font-semibold text-slate-900">{name}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraftName(name);
                setName("");
              }}
            >
              Change
            </Button>
          </div>
        )}
      </Card>

      {name ? (
        <div className="flex flex-col gap-4 animate-fade-in">
          <CreateTripCard
            currentName={name}
            onCreated={(tripId) => router.push(`/trips/${tripId}`)}
          />
          <JoinTripCard onJoined={(tripId) => router.push(`/trips/${tripId}`)} />
        </div>
      ) : (
        <p className="text-center text-sm text-slate-400">
          Set your name to create or join a trip.
        </p>
      )}

      <footer className="mt-auto pt-6 text-center text-xs text-slate-400">
        No logins. Share a join code and everyone&apos;s in.
      </footer>
    </main>
  );
}

function CreateTripCard({
  currentName,
  onCreated,
}: {
  currentName: string;
  onCreated: (tripId: string) => void;
}) {
  const [tripName, setTripName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await createTrip({
      name: tripName,
      currency,
      creatorName: currentName,
    });
    if (res.ok) {
      onCreated(res.data.tripId);
    } else {
      setError(res.error);
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Plane className="h-4 w-4 text-indigo-600" />
        <h2 className="font-semibold text-slate-900">Start a new trip</h2>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <Label htmlFor="trip">Trip name</Label>
          <Input
            id="trip"
            placeholder="Goa 2026"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="currency">Currency</Label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending || !tripName.trim()}>
          {pending ? <Spinner /> : <ArrowRight className="h-4 w-4" />}
          Create trip
        </Button>
        <ErrorText>{error}</ErrorText>
      </form>
    </Card>
  );
}

function JoinTripCard({ onJoined }: { onJoined: (tripId: string) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await joinTripByCode(code);
    if (res.ok) {
      onJoined(res.data.tripId);
    } else {
      setError(res.error);
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-indigo-600" />
        <h2 className="font-semibold text-slate-900">Join with a code</h2>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <Input
          placeholder="ABC123"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="font-mono tracking-widest uppercase"
          maxLength={8}
        />
        <Button type="submit" variant="secondary" disabled={pending || !code.trim()}>
          {pending ? <Spinner /> : <Check className="h-4 w-4" />}
          Join
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
