"use client";

/**
 * Authentication, backed by Firebase Auth.
 *
 * Firebase owns passwords, email verification and password reset (it sends those
 * emails itself), and keeps the session signed in across reloads. The API trusts
 * a Firebase ID token: a JWT that Firebase refreshes about every hour, which
 * `authFetch` attaches to every request.
 */

import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  validatePassword,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "./firebase";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000").replace(/\/$/, "");

export type { User };

/** Error with a machine-readable `code` (from the API, or Firebase's own code). */
export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string = "",
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

export async function errorFromResponse(res: Response): Promise<AuthApiError> {
  let message = `Request failed (${res.status})`;
  let code = "";
  try {
    const d = (await res.json())?.detail;
    if (typeof d === "string") message = d;
    else if (d && typeof d === "object" && "message" in d) {
      message = String(d.message);
      code = String(d.code ?? "");
    }
  } catch {
    /* non-JSON body: keep the generic message */
  }
  return new AuthApiError(message, res.status, code);
}

// ── Friendly messages for Firebase errors ──────────────────────────────────

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/missing-password": "Enter your password.",
  "auth/email-already-in-use": "An account with this email already exists. Try signing in instead.",
  "auth/weak-password": "That password is too weak.",
  "auth/password-does-not-meet-requirements": "Your password doesn't meet the requirements below.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/network-request-failed": "Can't reach the server. Check your connection and try again.",
  "auth/operation-not-allowed": "This sign-in method isn't enabled in Firebase yet.",
  "auth/popup-closed-by-user": "The GitHub window was closed before finishing. Please try again.",
  "auth/cancelled-popup-request": "The GitHub window was closed before finishing. Please try again.",
  "auth/popup-blocked": "Your browser blocked the GitHub window. Allow pop-ups for this site and try again.",
  "auth/account-exists-with-different-credential": "This GitHub account's email is already used by another sign-in. Contact support.",
  "auth/unauthorized-domain": "This website isn't authorised to use sign-in. Add it in Firebase → Authentication → Settings.",
};

export function authMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof FirebaseError) return MESSAGES[err.code] ?? fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

// ── Session ────────────────────────────────────────────────────────────────

const expiredListeners = new Set<() => void>();

/** Called when the API rejects a freshly refreshed token: the session is over. */
export function onSessionExpired(fn: () => void): () => void {
  expiredListeners.add(fn);
  return () => expiredListeners.delete(fn);
}

/** fetch() for protected API routes: adds the ID token, retries once on 401. */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const user = firebaseAuth().currentUser;
  const send = (token: string | null) =>
    fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });

  // getIdToken() returns the cached token, refreshing it only when near expiry.
  let res = await send(user ? await user.getIdToken() : null);
  if (res.status !== 401 || !user) {
    if (res.status === 401) expiredListeners.forEach((fn) => fn());
    return res;
  }

  // The cached token may have been revoked or the clock may be off: force a new one.
  res = await send(await user.getIdToken(true).catch(() => null));
  if (res.status === 401) expiredListeners.forEach((fn) => fn());
  return res;
}

export interface GitHubConnection {
  connected: boolean;
  login?: string;
  name?: string;
  avatar_url?: string;
  missing_scopes?: string[];
  needs_reconnect?: boolean;
}

export interface SyncJob {
  status: "running" | "done" | "failed" | "idle";
  step?: string | null;
  steps?: { id: string; label: string }[];
  started_at?: string | null;
  finished_at?: string | null;
  error?: string | null;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  created_at: string | null;
  github: GitHubConnection;
  sync: SyncJob | null;
  last_synced_at: string | null;
}

async function apiCall<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await authFetch(`${API_BASE}${path}`, init);
  } catch {
    throw new AuthApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  if (!res.ok) throw await errorFromResponse(res);
  return res.json() as Promise<T>;
}

export const githubApi = {
  /** Hand the token from the GitHub popup to the API; starts the first sync. */
  connect: (accessToken: string) =>
    apiCall<AppUser>("/api/github/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
    }),
  syncStatus: () => apiCall<SyncJob>("/api/github/sync"),
  startSync: () => apiCall<SyncJob>("/api/github/sync", { method: "POST" }),
  disconnect: () => apiCall<{ status: string }>("/api/github/disconnect", { method: "POST" }),
};

export const authApi = {
  /** The API's record of the signed-in user; 403 means signed in but no access. */
  me: () => apiCall<AppUser>("/api/auth/me"),

  signUp: async (email: string, password: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(firebaseAuth(), email.trim(), password);
    if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() }).catch(() => undefined);
    await sendEmailVerification(cred.user);
    return cred.user;
  },

  signIn: (email: string, password: string) =>
    signInWithEmailAndPassword(firebaseAuth(), email.trim(), password).then((c) => c.user),

  resendVerification: async () => {
    const user = firebaseAuth().currentUser;
    if (user) await sendEmailVerification(user);
  },

  /** Firebase replies the same whether or not the email has an account. */
  sendPasswordReset: (email: string) => sendPasswordResetEmail(firebaseAuth(), email.trim()),

  signOut: () => firebaseSignOut(firebaseAuth()),
};

// ── Password rules (read from the policy set in the Firebase console) ─────────

export interface PasswordRule {
  label: string;
  ok: boolean;
}

export async function checkPassword(password: string): Promise<{ valid: boolean; rules: PasswordRule[] }> {
  try {
    const s = await validatePassword(firebaseAuth(), password);
    const o = s.passwordPolicy.customStrengthOptions;
    const rules: PasswordRule[] = [];
    if (o.minPasswordLength)
      rules.push({ label: `At least ${o.minPasswordLength} characters`, ok: !!s.meetsMinPasswordLength });
    if (o.containsLowercaseLetter)
      rules.push({ label: "A lowercase letter", ok: !!s.containsLowercaseLetter });
    if (o.containsUppercaseLetter)
      rules.push({ label: "An uppercase letter", ok: !!s.containsUppercaseLetter });
    if (o.containsNumericCharacter) rules.push({ label: "A number", ok: !!s.containsNumericCharacter });
    if (o.containsNonAlphanumericCharacter)
      rules.push({ label: "A symbol (e.g. ! @ # $)", ok: !!s.containsNonAlphanumericCharacter });
    return { valid: s.isValid, rules };
  } catch {
    // Policy couldn't be loaded (offline?): fall back to Firebase's minimum and let
    // the server have the final word on submit.
    const ok = password.length >= 6;
    return { valid: ok, rules: [{ label: "At least 6 characters", ok }] };
  }
}

/** Only same-site paths: never let ?next= send someone to another domain. */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
