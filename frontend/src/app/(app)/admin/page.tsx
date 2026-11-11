"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Github, Inbox, ShieldCheck, UserMinus, UserPlus, X } from "lucide-react";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { FormAlert } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { Badge, EmptyState, Input, PageHeading, Skeleton } from "@/components/ui/primitives";
import { adminApi, authMessage, type AccessRequest, type Member } from "@/lib/auth";
import { relativeTime } from "@/lib/format";

type RequestFilter = "pending" | "approved" | "rejected" | "all";

export default function AdminPage() {
  const { appUser } = useAuth();

  if (!appUser?.is_admin) {
    return (
      <EmptyState
        icon={<ShieldCheck className="size-6" />}
        title="Admins only"
        description="This page is for managing who can use GitPulse."
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeading
        title="Access"
        description="GitPulse is invite-only. Approve requests, invite people directly, or remove access."
      />
      <Requests />
      <Members />
    </div>
  );
}

// ── Requests ─────────────────────────────────────────────────────────────────

function Requests() {
  const [filter, setFilter] = useState<RequestFilter>("pending");
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "requests", filter],
    queryFn: () => adminApi.requests(filter === "all" ? undefined : filter),
  });
  const [error, setError] = useState("");

  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      approve ? adminApi.approve(id) : adminApi.reject(id),
    onSuccess: () => {
      setError("");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => setError(authMessage(e)),
  });

  return (
    <Panel>
      <PanelHeader
        title="Access requests"
        description="People who asked to join from the landing page or the sign-in screen."
        action={
          <Tabs value={filter} onValueChange={(v) => setFilter(v as RequestFilter)}>
            <TabsList>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      <div className="px-6 pb-6">
        {error && <div className="mb-4"><FormAlert>{error}</FormAlert></div>}
        {isLoading ? (
          <ListSkeleton />
        ) : !data?.length ? (
          <EmptyState
            icon={<Inbox className="size-6" />}
            title={filter === "pending" ? "No pending requests" : "Nothing here"}
            description={filter === "pending" ? "New requests will show up here." : undefined}
          />
        ) : (
          <ul className="divide-y divide-hairline">
            {data.map((r) => (
              <RequestRow
                key={r.id}
                r={r}
                busy={decide.isPending && decide.variables?.id === r.id}
                onDecide={(approve) => decide.mutate({ id: r.id, approve })}
              />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function RequestRow({
  r,
  busy,
  onDecide,
}: {
  r: AccessRequest;
  busy: boolean;
  onDecide: (approve: boolean) => void;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-4 py-4">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-medium text-ink">{r.name || r.email}</span>
          {r.name && <span className="text-[13px] text-ink-3">{r.email}</span>}
          {r.status !== "pending" && (
            <Badge tone={r.status === "approved" ? "positive" : "negative"}>{r.status}</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-ink-3">
          {r.github && (
            <a
              href={`https://github.com/${r.github}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-lift hover:text-white"
            >
              <Github className="size-3.5" />@{r.github}
            </a>
          )}
          <span>requested {relativeTime(r.created_at)}</span>
        </div>
        {r.note && <p className="max-w-2xl pt-1 text-[13px] leading-relaxed text-ink-2">“{r.note}”</p>}
      </div>
      {r.status !== "approved" && (
        <div className="flex shrink-0 gap-2">
          {r.status === "pending" && (
            <Button variant="ghost" size="sm" onClick={() => onDecide(false)} disabled={busy} className="gap-1.5">
              <X className="size-3.5" /> Reject
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => onDecide(true)} loading={busy} className="gap-1.5">
            {!busy && <Check className="size-3.5" />} Approve
          </Button>
        </div>
      )}
    </li>
  );
}

// ── Members ──────────────────────────────────────────────────────────────────

function Members() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "members"], queryFn: adminApi.members });
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const invite = useMutation({
    mutationFn: (e: string) => adminApi.invite(e),
    onSuccess: () => {
      setEmail("");
      setError("");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => setError(authMessage(e)),
  });
  const revoke = useMutation({
    mutationFn: (e: string) => adminApi.revoke(e),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
    onError: (e) => setError(authMessage(e)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim()) invite.mutate(email.trim());
  };

  return (
    <Panel>
      <PanelHeader
        title="Members"
        description="Everyone who can use GitPulse. Removing someone takes effect immediately."
      />
      <div className="space-y-4 px-6 pb-6">
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            placeholder="Invite by email: friend@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email to invite"
          />
          <Button type="submit" variant="secondary" loading={invite.isPending} disabled={!email.trim()} className="shrink-0 gap-1.5">
            {!invite.isPending && <UserPlus className="size-4" />} Invite
          </Button>
        </form>
        <FormAlert>{error}</FormAlert>

        {isLoading ? (
          <ListSkeleton />
        ) : (
          <ul className="divide-y divide-hairline">
            {data?.map((m) => (
              <MemberRow
                key={m.email}
                m={m}
                busy={revoke.isPending && revoke.variables === m.email}
                onRevoke={() => {
                  if (window.confirm(`Remove access for ${m.email}?`)) revoke.mutate(m.email);
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function MemberRow({ m, busy, onRevoke }: { m: Member; busy: boolean; onRevoke: () => void }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {m.avatar_url ? (
          <Image src={m.avatar_url} alt="" width={32} height={32} unoptimized className="size-8 rounded-full ring-1 ring-hairline" />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full border border-hairline bg-glass text-[12px] font-medium text-ink-3 uppercase">
            {m.email[0]}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[13.5px] font-medium text-ink">{m.email}</span>
            {m.role === "admin" && <Badge tone="brand">admin</Badge>}
          </div>
          <div className="text-[12.5px] text-ink-3">
            {!m.signed_up
              ? "Invited, hasn't signed up yet"
              : m.github_login
                ? `@${m.github_login} · last seen ${relativeTime(m.last_seen_at)}`
                : `Signed up, GitHub not connected · last seen ${relativeTime(m.last_seen_at)}`}
          </div>
        </div>
      </div>
      {m.role === "invited" && (
        <Button variant="ghost" size="sm" onClick={onRevoke} loading={busy} className="gap-1.5 text-negative hover:text-negative">
          {!busy && <UserMinus className="size-3.5" />} Remove
        </Button>
      )}
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 py-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
