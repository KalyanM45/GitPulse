"use client";

import { MailCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AuthLoading,
  AuthShell,
  Field,
  FormAlert,
  ResendButton,
  TextLink,
  useAuthRedirect,
} from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { authApi, authMessage } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const status = useAuthRedirect("anonymous");
  const params = useSearchParams();

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (status !== "anonymous") return <AuthLoading />;

  const send = async () => {
    setError("");
    try {
      await authApi.sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(authMessage(err, "Couldn't send the reset email. Please try again."));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await send();
    setBusy(false);
  };

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={
          <>
            If an account exists for <span className="font-medium text-ink-2">{email.trim()}</span>, we&apos;ve sent
            a link to reset your password. Open it, choose a new password, then sign in.
          </>
        }
        footer={<TextLink href={`/login?email=${encodeURIComponent(email.trim())}`}>Back to sign in</TextLink>}
      >
        <div className="space-y-5">
          <div className="flex justify-center">
            <span className="flex size-14 items-center justify-center rounded-2xl border border-hairline bg-glass">
              <MailCheck className="size-6 text-indigo-lift" />
            </span>
          </div>
          <FormAlert>{error}</FormAlert>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-ink-3">Check your spam folder too.</span>
            <ResendButton onResend={send} />
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your account's email and we'll send you a link to reset it."
      footer={
        <>
          Remembered it? <TextLink href="/login">Back to sign in</TextLink>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormAlert>{error}</FormAlert>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
          />
        </Field>
        <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={!email.trim()}>
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
