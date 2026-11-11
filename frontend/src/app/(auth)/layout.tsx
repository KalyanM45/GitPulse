import { Suspense } from "react";
import { AuthLoading } from "@/components/auth/auth-ui";

// The auth pages read ?email= and ?next= from the URL, which needs a Suspense
// boundary for Next to prerender them.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<AuthLoading />}>{children}</Suspense>;
}
