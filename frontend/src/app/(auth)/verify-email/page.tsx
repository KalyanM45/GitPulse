"use client";

import { MailCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthLoading, AuthShell, FormAlert, ResendButton, useAuthRedirect } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { authApi, authMessage } from "@/lib/auth";
import { firebaseAuth } from "@/lib/firebase";

export default function VerifyEmailPage() {
  const status = useAuthRedirect("unverified");
  const { user, refresh, signOut } = useAuth();

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [checking, setChecking] = useState(false);

  // Notice the click on the link (usually in another tab) without a manual refresh:
  // re-check every few seconds while this tab is visible.
  useEffect(() => {
    if (status !== "unverified") return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh().catch(() => undefined);
    }, 5000);
    return () => clearInterval(t);
  }, [status, refresh]);

  if (status !== "unverified") return <AuthLoading />;

  const check = async () => {
    setError("");
    setChecking(true);
    try {
      await refresh();
      // Still here = still unverified (otherwise the redirect has already fired).
      if (!firebaseAuth().currentUser?.emailVerified) setInfo("Not verified yet. Click the link in the email, then try again.");
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setChecking(false);
    }
  };

  return (
    <AuthShell
      title="Check your email"
      subtitle={
        <>
          We sent a verification link to <span className="font-medium text-ink-2">{user?.email}</span>. Click it,
          then come back here.
        </>
      }
      footer={
        <>
          Wrong email?{" "}
          <button
            type="button"
            onClick={() => signOut()}
            className="font-medium text-indigo-lift transition hover:text-white"
          >
            Sign out and start over
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex justify-center">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-hairline bg-glass">
            <MailCheck className="size-6 text-indigo-lift" />
          </span>
        </div>

        <FormAlert>{error}</FormAlert>
        {info && !error && <FormAlert tone="info">{info}</FormAlert>}

        <Button variant="primary" className="w-full" onClick={check} loading={checking}>
          I&apos;ve verified my email
        </Button>

        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-ink-3">Check your spam folder too.</span>
          <ResendButton
            onResend={async () => {
              setError("");
              try {
                await authApi.resendVerification();
                setInfo("We've sent a new verification email.");
              } catch (err) {
                setError(authMessage(err, "Couldn't resend the email."));
              }
            }}
          />
        </div>
      </div>
    </AuthShell>
  );
}
