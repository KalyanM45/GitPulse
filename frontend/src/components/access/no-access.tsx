"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthLoading, AuthShell, FormAlert } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { accessApi, type AccessRequest } from "@/lib/auth";
import { RequestAccessForm } from "./request-access";

/** Shown to signed-in users who aren't invited yet. */
export function NoAccess() {
  const { user, signOut, refresh } = useAuth();
  const [request, setRequest] = useState<AccessRequest["status"] | null | undefined>(undefined);

  useEffect(() => {
    accessApi
      .status()
      .then((s) => {
        // Approved since this page loaded: go straight in.
        if (s.has_access) void refresh();
        else setRequest(s.request);
      })
      .catch(() => setRequest(null));
  }, [refresh]);

  if (request === undefined) return <AuthLoading />;

  const footer = (
    <>
      Signed in as {user?.email} ·{" "}
      <button onClick={() => signOut()} className="font-medium text-indigo-lift transition hover:text-white">
        Sign out
      </button>
    </>
  );

  if (request === "pending") {
    return (
      <AuthShell
        title="Request pending"
        subtitle="Thanks for your interest! Your request is waiting for approval. You'll get in as soon as it's approved."
        footer={footer}
      >
        <div className="space-y-4">
          <div className="flex justify-center">
            <span className="flex size-14 items-center justify-center rounded-2xl border border-hairline bg-glass">
              <Clock className="size-6 text-indigo-lift" />
            </span>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => refresh()}>
            Check again
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="GitPulse is invite-only"
      subtitle={
        request === "rejected"
          ? "Your earlier request wasn't approved. You're welcome to send a new one."
          : "This account hasn't been invited yet. Request access and you'll be let in once it's approved."
      }
      footer={footer}
    >
      {request === "rejected" && <div className="mb-4"><FormAlert tone="info">You can update your note and ask again.</FormAlert></div>}
      <RequestAccessForm
        lockedEmail
        defaults={{ email: user?.email ?? "", name: user?.displayName ?? "" }}
      />
    </AuthShell>
  );
}
