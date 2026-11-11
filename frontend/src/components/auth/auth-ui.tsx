"use client";

import { motion } from "framer-motion";
import { Activity, Check, CircleAlert, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  forwardRef,
  useEffect,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Panel } from "@/components/ui/card";
import { Input } from "@/components/ui/primitives";
import { checkPassword, safeNext, type PasswordRule } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useAuth, type AuthStatus } from "./auth-provider";

/** Centered card on the app's ambient backdrop, shared by every auth screen. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-12">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-base" />
        <div
          className="absolute -top-40 left-1/2 size-[560px] -translate-x-1/2 rounded-full opacity-40 blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(79,70,229,0.4), transparent 70%)" }}
        />
      </div>

      <motion.main
        id="main"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[400px]"
      >
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5" aria-label="GitPulse home">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#6366f1,#4f46e5)] shadow-[0_4px_16px_-4px_rgba(79,70,229,0.9)]">
            <Activity className="size-4.5 text-white" strokeWidth={2.5} />
          </span>
          <span className="text-base font-semibold tracking-tight text-ink">GitPulse</span>
        </Link>

        <Panel className="p-6 sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </Panel>

        {footer && <p className="mt-6 text-center text-[13px] text-ink-3">{footer}</p>}
      </motion.main>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
          {label}
        </label>
        {hint}
      </div>
      {children}
    </div>
  );
}

export function FormAlert({ tone = "error", children }: { tone?: "error" | "info"; children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-control border px-3.5 py-2.5 text-[13px] leading-relaxed",
        tone === "error"
          ? "border-negative/25 bg-negative/10 text-negative"
          : "border-indigo-2/30 bg-indigo-2/10 text-indigo-lift",
      )}
    >
      {tone === "error" ? (
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
      ) : (
        <Check className="mt-0.5 size-4 shrink-0" />
      )}
      <span>{children}</span>
    </div>
  );
}

/** Password input with a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
          maxLength={128}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-control text-ink-3 transition hover:text-ink focus-visible:outline-2 focus-visible:outline-indigo-lift"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);

/**
 * Checks a password against the policy configured in the Firebase console, so the
 * rules on screen always match what Firebase will enforce.
 */
export function usePasswordCheck(password: string) {
  const [state, setState] = useState<{ valid: boolean; rules: PasswordRule[] }>({ valid: false, rules: [] });
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      checkPassword(password).then((r) => live && setState(r));
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [password]);
  return state;
}

export function PasswordChecklist({ rules }: { rules: PasswordRule[] }) {
  if (!rules.length) return null;
  return (
    <ul className="mt-2 space-y-1" aria-label="Password requirements">
      {rules.map((r) => (
        <li
          key={r.label}
          className={cn(
            "flex items-center gap-2 text-[12.5px] transition-colors",
            r.ok ? "text-positive" : "text-ink-3",
          )}
        >
          <span
            className={cn(
              "flex size-3.5 items-center justify-center rounded-full border",
              r.ok ? "border-positive bg-positive/15" : "border-hairline-strong",
            )}
          >
            {r.ok && <Check className="size-2.5" strokeWidth={3} />}
          </span>
          {r.label}
          <span className="sr-only">{r.ok ? "(met)" : "(not met)"}</span>
        </li>
      ))}
    </ul>
  );
}

/** "Resend" with a countdown so people can't hammer the button. */
export function ResendButton({
  onResend,
  seconds = 60,
  label = "Resend email",
}: {
  onResend: () => Promise<void>;
  seconds?: number;
  label?: string;
}) {
  const [left, setLeft] = useState(seconds);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  return (
    <button
      type="button"
      disabled={left > 0 || busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onResend();
        } finally {
          setBusy(false);
          setLeft(seconds);
        }
      }}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-lift transition hover:text-white disabled:cursor-not-allowed disabled:text-ink-3"
    >
      {busy && <Loader2 className="size-3.5 animate-spin" />}
      {left > 0 ? `${label} in ${left}s` : label}
    </button>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-indigo-lift transition hover:text-white">
      {children}
    </Link>
  );
}

/** Full-screen spinner while the session is being checked. */
export function AuthLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-base" aria-busy="true">
      <Loader2 className="size-6 animate-spin text-ink-3" aria-label="Loading" />
    </div>
  );
}

/**
 * Sends people to the right screen for their sign-in state. Each auth page names
 * the one state it serves; everyone else is redirected. Returns the status so the
 * page can show a spinner until it's settled.
 */
export function useAuthRedirect(serves: "anonymous" | "unverified"): AuthStatus {
  const { status } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    if (status === "loading" || status === serves) return;
    if (status === "anonymous") router.replace("/login");
    else if (status === "unverified") router.replace("/verify-email");
    else router.replace(safeNext(params.get("next")));
  }, [status, serves, router, params]);
  return status;
}
