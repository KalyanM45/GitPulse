"use client";

import { CheckCircle2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Field, FormAlert } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { Input } from "@/components/ui/primitives";
import { accessApi, authMessage, type AccessRequestInput } from "@/lib/auth";

/** The request form itself. `lockedEmail` = signed-in user, whose email can't change. */
export function RequestAccessForm({
  defaults,
  lockedEmail,
  onDone,
}: {
  defaults?: Partial<AccessRequestInput>;
  lockedEmail?: boolean;
  onDone?: () => void;
}) {
  const [form, setForm] = useState<AccessRequestInput>({
    email: defaults?.email ?? "",
    name: defaults?.name ?? "",
    github: defaults?.github ?? "",
    note: defaults?.note ?? "",
  });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof AccessRequestInput) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <CheckCircle2 className="size-9 text-positive" />
        <p className="text-[15px] font-medium text-ink">Request received</p>
        <p className="max-w-sm text-[13px] leading-relaxed text-ink-3">
          Thanks! Your request has been sent. Once you&apos;re approved, sign in with{" "}
          <span className="font-medium text-ink-2">{form.email.trim()}</span> to see your own dashboard.
        </p>
        {onDone && (
          <Button variant="secondary" size="sm" className="mt-2" onClick={onDone}>
            Close
          </Button>
        )}
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await accessApi.request(form);
      setSent(true);
    } catch (err) {
      setError(authMessage(err, "Couldn't send your request. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormAlert>{error}</FormAlert>
      <Field label="Email" htmlFor="ra-email">
        <Input
          id="ra-email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={set("email")}
          readOnly={lockedEmail}
          placeholder="you@example.com"
          className={lockedEmail ? "opacity-70" : undefined}
        />
      </Field>
      <Field label="Why are you interested?" htmlFor="ra-note">
        <textarea
          id="ra-note"
          required
          minLength={10}
          maxLength={500}
          rows={4}
          value={form.note}
          onChange={set("note")}
          className="w-full resize-none rounded-control border border-hairline bg-black/20 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-3 transition hover:border-hairline-strong focus:border-indigo-2/60 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] focus:outline-none"
          placeholder="A line or two, e.g. I maintain a few open-source repos and want long-term traffic history."
        />
        <p className="text-right text-[11.5px] text-ink-3">{(form.note ?? "").length}/500</p>
      </Field>
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        loading={busy}
        disabled={!form.email.trim() || (form.note ?? "").trim().length < 10}
      >
        Request access
      </Button>
    </form>
  );
}

/** A button that opens the request form in a dialog. */
export function RequestAccessDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        title="Request access"
        description="GitPulse is invite-only for now. Leave your email and a short note, and you'll hear back."
      >
        <div className="px-6 py-5">
          {/* Remount on each open so a finished request doesn't stick around. */}
          {open && <RequestAccessForm onDone={() => setOpen(false)} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
