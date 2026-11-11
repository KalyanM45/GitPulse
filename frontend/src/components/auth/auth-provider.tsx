"use client";

import { useQueryClient } from "@tanstack/react-query";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AuthApiError, authApi, onSessionExpired, type AppUser, type User } from "@/lib/auth";
import { firebaseAuth } from "@/lib/firebase";
import { clearPersistedCache } from "@/lib/persist";

/**
 * loading        working out who is signed in
 * anonymous      nobody is signed in
 * unverified     signed in, email not verified yet
 * forbidden      signed in and verified, but not allowed in (ALLOWED_EMAILS)
 * authenticated  good to go
 */
export type AuthStatus = "loading" | "anonymous" | "unverified" | "forbidden" | "authenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** The API's view of the user: GitHub connection and sync state. */
  appUser: AppUser | null;
  /** Re-read appUser from the API (after connecting GitHub, or a sync finishing). */
  reloadAppUser: () => Promise<AppUser | null>;
  /** Re-read the user from Firebase, e.g. after they clicked the verification link. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const qc = useQueryClient();
  const router = useRouter();
  const lastUid = useRef<string | null>(null);

  const wipeLocalData = useCallback(() => {
    // Dashboard data must not outlive the session on a shared machine.
    qc.clear();
    clearPersistedCache();
  }, [qc]);

  /** Decide the status for a Firebase user, asking the API whether they have access. */
  const evaluate = useCallback(async (u: User | null) => {
    if (!u) {
      setUser(null);
      setAppUser(null);
      setStatus("anonymous");
      return;
    }
    setUser(u);
    if (!u.emailVerified) {
      setStatus("unverified");
      return;
    }
    try {
      setAppUser(await authApi.me());
      setStatus("authenticated");
    } catch (e) {
      if (e instanceof AuthApiError && e.code === "not_invited") setStatus("forbidden");
      else if (e instanceof AuthApiError && e.code === "email_not_verified") setStatus("unverified");
      // API unreachable or cold-starting: let the dashboard in; its own requests
      // will show errors and retry, which beats locking the user out.
      else setStatus("authenticated");
    }
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(firebaseAuth(), (u) => {
        // A different account (or none) means the cached dashboard isn't theirs.
        if ((u?.uid ?? null) !== lastUid.current) {
          if (lastUid.current !== null) wipeLocalData();
          lastUid.current = u?.uid ?? null;
        }
        setStatus("loading");
        void evaluate(u);
      }),
    [evaluate, wipeLocalData],
  );

  const signOut = useCallback(async () => {
    await authApi.signOut();
    wipeLocalData();
    router.replace("/login");
  }, [router, wipeLocalData]);

  // The API rejected a freshly refreshed token: treat the session as over.
  useEffect(() => onSessionExpired(() => void signOut()), [signOut]);

  const refresh = useCallback(async () => {
    const u = firebaseAuth().currentUser;
    if (!u) return;
    await u.reload();
    // The ID token carries email_verified; mint a new one so the API sees the change.
    if (u.emailVerified) await u.getIdToken(true);
    await evaluate(firebaseAuth().currentUser);
  }, [evaluate]);

  const reloadAppUser = useCallback(async () => {
    try {
      const me = await authApi.me();
      setAppUser(me);
      return me;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({ status, user, appUser, reloadAppUser, refresh, signOut }),
    [status, user, appUser, reloadAppUser, refresh, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
