"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AuthLoading,
  AuthShell,
  Field,
  FormAlert,
  PasswordChecklist,
  PasswordInput,
  TextLink,
  useAuthRedirect,
  usePasswordCheck,
} from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { authApi, authMessage } from "@/lib/auth";

export default function SignupPage() {
  const status = useAuthRedirect("anonymous");
  const next = useSearchParams().get("next");
  const nextQs = next ? `?next=${encodeURIComponent(next)}` : "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const check = usePasswordCheck(password);

  if (status !== "anonymous") return <AuthLoading />;

  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = !!email.trim() && check.valid && confirm === password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setBusy(true);
    try {
      // Creates the account, signs in, and sends the verification email. The auth
      // provider then sees an unverified user and we land on /verify-email.
      await authApi.signUp(email, password, name);
    } catch (err) {
      setError(authMessage(err, "Sign up failed. Please try again."));
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Anyone can create an account to view the live demo. Invited emails also get their own dashboard. We'll email you a link to confirm your address."
      footer={
        <>
          Already have an account? <TextLink href={`/login${nextQs}`}>Sign in</TextLink>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormAlert>{error}</FormAlert>

        <Field label="Name (optional)" htmlFor="name">
          <Input
            id="name"
            autoComplete="name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-rules"
          />
          <div id="password-rules">
            <PasswordChecklist rules={check.rules} />
          </div>
        </Field>

        <Field label="Confirm password" htmlFor="confirm">
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch || undefined}
          />
          {mismatch && <p className="text-[12.5px] text-negative">Passwords don&apos;t match.</p>}
        </Field>

        <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={!canSubmit}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
