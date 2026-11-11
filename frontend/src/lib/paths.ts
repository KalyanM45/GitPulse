"use client";

import { usePathname } from "next/navigation";

/**
 * "/demo" on demo pages, "" on the real dashboard. Dashboard pages are shared by
 * both, so in-app links are written as `${base}/repositories` to stay in the
 * section the visitor is in.
 */
export function useBasePath(): "" | "/demo" {
  const pathname = usePathname();
  return pathname.startsWith("/demo") ? "/demo" : "";
}
