"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { FirebaseError } from "firebase/app";
import {
  getAuth,
  GithubAuthProvider,
  linkWithPopup,
  reauthenticateWithPopup,
  type Auth,
} from "firebase/auth";

/**
 * Firebase web config. These values identify the project; they are public by
 * design and ship in every browser bundle. Who may sign in and what they may see
 * is enforced by Firebase Auth and by the API, not by hiding these.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

let auth: Auth | null = null;

/** Lazily initialised so prerendering on the server never touches Firebase. */
export function firebaseAuth(): Auth {
  if (auth) return auth;
  if (!config.apiKey || !config.projectId) {
    throw new Error("Firebase is not configured: set the NEXT_PUBLIC_FIREBASE_* variables.");
  }
  const app = getApps().length ? getApp() : initializeApp(config);
  auth = getAuth(app);
  return auth;
}

/**
 * Opens GitHub's consent popup and returns the GitHub access token it grants.
 *
 * The GitHub identity is linked to the signed-in Firebase user. If it's already
 * linked (reconnecting), re-authenticating with GitHub yields a fresh token
 * instead; if it's linked to a different Firebase user, the token is still
 * returned and the API decides whether that's allowed.
 */
export async function getGitHubAccessToken(): Promise<string> {
  const user = firebaseAuth().currentUser;
  if (!user) throw new Error("Sign in first.");
  const provider = new GithubAuthProvider();
  // `repo`: GitHub only shows repository traffic (views/clones) and private repos
  // to tokens with this scope. `read:user`: profile.
  provider.addScope("repo");
  provider.addScope("read:user");
  provider.setCustomParameters({ allow_signup: "false" });

  let token: string | undefined;
  try {
    const result = await linkWithPopup(user, provider);
    token = GithubAuthProvider.credentialFromResult(result)?.accessToken;
  } catch (e) {
    if (e instanceof FirebaseError && e.code === "auth/provider-already-linked") {
      const result = await reauthenticateWithPopup(user, provider);
      token = GithubAuthProvider.credentialFromResult(result)?.accessToken;
    } else if (e instanceof FirebaseError && e.code === "auth/credential-already-in-use") {
      token = GithubAuthProvider.credentialFromError(e)?.accessToken;
    } else {
      throw e;
    }
  }
  if (!token) throw new Error("GitHub didn't return access. Please try again.");
  return token;
}

