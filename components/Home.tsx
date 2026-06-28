"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plane, Users, ArrowRight, Check, X, ChevronRight } from "lucide-react";
import { useUsername } from "@/lib/identity";
import { useRecentTrips, forgetTrip } from "@/lib/recentTrips";
import { createTrip, joinTripByCode } from "@/app/actions";
import {
  Button,
  Card,
  ErrorText,
  Input,
  Label,
  Select,
  Spinner,
} from "@/components/ui";
import { Reveal } from "@/components/motion";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD"];

export default function Home() {
  const router = useRouter();
  const [name, setName] = useUsername();
  const [draftName, setDraftName] = useState("");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 pb-16 pt-10">
      {/* Hero */}
      <header>
        <p className="accent-hand text-2xl text-[var(--gold)]">
          Trips with friends, settled simply
        </p>
        <h1 className="mt-1 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          Split the bill. Settle in the fewest payments.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-[var(--text-dim)]">
          Add who paid for what, however you like to split it, and Sensei works
          out exactly who pays whom — with the smallest number of transfers.
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
            <p className="mt-2 text-xs text-[var(--text-faint)]">
              Stored on this device — no account needed.
            </p>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ink)] text-sm font-semibold text-[var(--gold)]">
                {name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-[var(--text-faint)]">You are</p>
                <p className="font-semibold text-[var(--text)]">{name}</p>
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

      <YourTrips />

      {name ? (
        <Reveal className="flex flex-col gap-4" delay={0.04}>
          <CreateTripCard
            currentName={name}
            onCreated={(tripId) => router.push(`/trips/${tripId}`)}
          />
          <JoinTripCard onJoined={(tripId) => router.push(`/trips/${tripId}`)} />
        </Reveal>
      ) : (
        <p className="text-center text-sm text-[var(--text-faint)]">
          Set your name to create or join a trip.
        </p>
      )}
    </div>
  );
}

function YourTrips() {
  const trips = useRecentTrips();
  if (trips.length === 0) return null;

  return (
    <Reveal>
      <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--text-faint)]">
        Your trips
      </h2>
      <Card className="divide-y divide-[var(--border)]">
        {trips.map((t) => (
          <div key={t.id} className="flex items-center gap-2 pr-2">
            <Link
              href={`/trips/${t.id}`}
              className="pressable flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-[var(--text)]">
                  {t.name}
                </span>
                <span className="tnum text-xs tracking-widest text-[var(--text-faint)]">
                  {t.joinCode} · {t.currency}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-faint)]" />
            </Link>
            <button
              aria-label={`Forget ${t.name}`}
              title="Remove from this device (doesn't delete the trip)"
              onClick={() => forgetTrip(t.id)}
              className="pressable rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--neg)_10%,transparent)] hover:text-[var(--neg)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </Card>
    </Reveal>
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
        <Plane className="h-4 w-4 text-[var(--accent)]" />
        <h2 className="text-lg font-semibold">Start a new trip</h2>
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
          <Select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
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
        <Users className="h-4 w-4 text-[var(--accent)]" />
        <h2 className="text-lg font-semibold">Join with a code</h2>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <Input
          placeholder="ABC123"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="tnum uppercase tracking-widest"
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
