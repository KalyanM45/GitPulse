"use client";

import { Check, Eye, Github, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthLoading, AuthShell, FormAlert } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { authMessage, githubApi, type SyncJob } from "@/lib/auth";
import { getGitHubAccessToken } from "@/lib/firebase";
import { cn } from "@/lib/utils";

const DEFAULT_STEPS = [
  { id: "profile", label: "Profile" },
  { id: "followers", label: "Followers" },
  { id: "following", label: "Following" },
  { id: "repos", label: "Repositories & traffic" },
  { id: "contributions", label: "Contributions" },
];

export default function ConnectPage() {
  const { status, appUser, reloadAppUser, signOut } = useAuth();
  const router = useRouter();
  const [job, setJob] = useState<SyncJob | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Only signed-in, verified users belong here.
  useEffect(() => {
    if (status === "anonymous") router.replace("/login?next=/connect");
    else if (status === "unverified") router.replace("/verify-email");
    else if (status === "forbidden") router.replace("/dashboard");
  }, [status, router]);

  useEffect(() => {
    if (appUser?.sync) setJob(appUser.sync);
  }, [appUser?.sync]);

  const gh = appUser?.github;
  const connected = !!gh?.connected && !gh.needs_reconnect;
  const running = job?.status === "running";

  // Already connected with data and nothing in progress: nothing to do here.
  useEffect(() => {
    if (status === "authenticated" && connected && appUser?.last_synced_at && !running && job?.status !== "failed") {
      router.replace("/dashboard");
    }
  }, [status, connected, appUser?.last_synced_at, running, job?.status, router]);

  // Follow the sync while it runs.
  const poll = useCallback(async () => {
    try {
      const j = await githubApi.syncStatus();
      setJob(j);
      if (j.status === "done") {
        await reloadAppUser();
        router.replace("/dashboard");
      } else if (j.status === "failed") {
        await reloadAppUser();
      }
    } catch {
      /* transient; next tick retries */
    }
  }, [reloadAppUser, router]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, [running, poll]);

  if (status !== "authenticated" || !appUser) return <AuthLoading />;

  const connect = async () => {
    setError("");
    setBusy(true);
    try {
      const token = await getGitHubAccessToken();
      const me = await githubApi.connect(token);
      setJob(me.sync);
      await reloadAppUser();
    } catch (err) {
      setError(authMessage(err, "Couldn't connect GitHub. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    setError("");
    setBusy(true);
    try {
      setJob(await githubApi.startSync());
    } catch (err) {
      setError(authMessage(err, "Couldn't start the sync."));
    } finally {
      setBusy(false);
    }
  };

  // ── Step 1: connect ──
  if (!connected) {
    return (
      <AuthShell
        title={gh?.needs_reconnect ? "Reconnect GitHub" : "Connect your GitHub"}
        subtitle="GitPulse reads your GitHub account to build your dashboard: followers, repositories, traffic and contributions."
        footer={
          <>
            Signed in as {appUser.email} ·{" "}
            <button onClick={() => signOut()} className="font-medium text-indigo-lift transition hover:text-white">
              Sign out
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <ul className="space-y-3 text-[13px] leading-relaxed text-ink-2">
            <li className="flex gap-3">
              <Eye className="mt-0.5 size-4 shrink-0 text-indigo-lift" />
              <span>
                <b className="font-medium text-ink">Read access</b> to your profile, followers and repositories,
                including repository traffic (views and clones). GitHub only shares traffic with the{" "}
                <code className="rounded bg-white/5 px-1 font-mono text-[12px]">repo</code> permission, so it will ask
                for that.
              </span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-indigo-lift" />
              <span>GitPulse never changes anything on your GitHub account.</span>
            </li>
            <li className="flex gap-3">
              <Lock className="mt-0.5 size-4 shrink-0 text-indigo-lift" />
              <span>Your access token is stored encrypted, and you can disconnect at any time.</span>
            </li>
          </ul>

          <FormAlert>{error}</FormAlert>

          <Button variant="primary" className="w-full gap-2" onClick={connect} loading={busy}>
            {!busy && <Github className="size-4" />}
            {busy ? "Waiting for GitHub…" : "Connect GitHub"}
          </Button>
        </div>
      </AuthShell>
    );
  }

  // ── Step 2: sync progress ──
  const steps = job?.steps?.length ? job.steps : DEFAULT_STEPS;
  const currentIdx = running ? steps.findIndex((s) => s.id === job?.step) : -1;
  const failed = job?.status === "failed";
  const idleWithoutData = !running && !failed && !appUser.last_synced_at;

  return (
    <AuthShell
      title={failed ? "Sync didn't finish" : idleWithoutData ? "Ready to sync" : "Analysing your GitHub"}
      subtitle={
        <>
          Connected as{" "}
          <span className="font-medium text-ink-2">@{gh?.login}</span>.{" "}
          {running &&
            "The first sync can take several minutes for accounts with many repositories. You can leave this page open, or come back later."}
        </>
      }
    >
      <div className="space-y-5">
        <ol className="space-y-2.5" aria-label="Sync progress">
          {steps.map((s, i) => {
            const done = running ? i < currentIdx : job?.status === "done";
            const active = running && i === currentIdx;
            return (
              <li
                key={s.id}
                className={cn(
                  "flex items-center gap-3 text-[13.5px]",
                  done ? "text-ink-2" : active ? "text-ink" : "text-ink-3",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border",
                    done && "border-positive/40 bg-positive/15 text-positive",
                    active && "border-indigo-2/50 bg-indigo-2/15 text-indigo-lift",
                    !done && !active && "border-hairline",
                  )}
                >
                  {done ? (
                    <Check className="size-3.5" strokeWidth={3} />
                  ) : active ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                </span>
                {s.label}
                <span className="sr-only">{done ? "(done)" : active ? "(in progress)" : "(waiting)"}</span>
              </li>
            );
          })}
        </ol>

        <FormAlert>{error || (failed ? job?.error : "")}</FormAlert>

        {(failed || idleWithoutData) && (
          <Button variant="primary" className="w-full" onClick={retry} loading={busy}>
            {failed ? "Try again" : "Start sync"}
          </Button>
        )}
        {failed && job?.error?.includes("Reconnect") && (
          <Button variant="secondary" className="w-full gap-2" onClick={connect} loading={busy}>
            <Github className="size-4" /> Reconnect GitHub
          </Button>
        )}
        {running && appUser.last_synced_at && (
          <Button variant="secondary" className="w-full" onClick={() => router.push("/dashboard")}>
            Go to dashboard. It updates when the sync finishes.
          </Button>
        )}
      </div>
    </AuthShell>
  );
}
