"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AuthLoading,
  AuthShell,
  Field,
  FormAlert,
  PasswordInput,
  TextLink,
  useAuthRedirect,
} from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { authApi, authMessage } from "@/lib/auth";

export default function LoginPage() {
  const status = useAuthRedirect("anonymous");
  const params = useSearchParams();

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (status !== "anonymous") return <AuthLoading />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // On success the auth provider picks up the new user and useAuthRedirect
      // moves on (to the dashboard, or to verify-email if not verified yet).
      await authApi.signIn(email, password);
    } catch (err) {
      setError(authMessage(err, "Sign in failed. Please try again."));
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your GitPulse dashboard."
      footer={
        <>
          New to GitPulse? <TextLink href="/signup">Create an account</TextLink>
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

        <Field
          label="Password"
          htmlFor="password"
          hint={
            <TextLink href={`/forgot-password${email ? `?email=${encodeURIComponent(email.trim())}` : ""}`}>
              <span className="text-[12.5px]">Forgot password?</span>
            </TextLink>
          }
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={busy}
          disabled={!email.trim() || !password}
        >
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
