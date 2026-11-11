"use client";

import { ArrowRight, Eye } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RequestAccessDialog } from "@/components/access/request-access";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { demoApi, type DemoInfo } from "@/lib/auth";

/**
 * Top of every demo page: whose dashboard this is, that it's read-only, and the
 * next step: "Open my dashboard" for invited users, "Request access" for others.
 */
export function DemoBanner() {
  const { status } = useAuth();
  const [info, setInfo] = useState<DemoInfo | null>(null);

  useEffect(() => {
    demoApi.info().then(setInfo).catch(() => setInfo({ available: false }));
  }, []);

  const invited = status === "authenticated";

  return (
    <div className="mb-8 flex flex-col gap-4 rounded-card border border-indigo-2/25 bg-indigo-2/[0.07] px-5 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {info?.avatar_url ? (
          <Image
            src={info.avatar_url}
            alt=""
            width={36}
            height={36}
            unoptimized
            className="size-9 rounded-full ring-1 ring-hairline"
          />
        ) : (
          <span className="flex size-9 items-center justify-center rounded-full border border-hairline bg-glass">
            <Eye className="size-4 text-indigo-lift" />
          </span>
        )}
        <div className="text-[13px] leading-relaxed">
          <p className="font-medium text-ink">
            Live demo{info?.login ? <> · @{info.login}&apos;s GitPulse</> : null}
          </p>
          <p className="text-ink-3">
            {info && !info.available
              ? "The demo isn't available right now."
              : `Read-only. You're seeing a real account's analysis${
                  info?.private_repos_hidden ? `, with ${info.private_repos_hidden} private repositories hidden` : ""
                }.`}
          </p>
        </div>
      </div>

      {invited ? (
        <Button asChild variant="primary" size="sm" className="shrink-0">
          <Link href="/dashboard">
            Open my dashboard <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      ) : (
        <RequestAccessDialog>
          <Button variant="primary" size="sm" className="shrink-0">
            Request access for your account <ArrowRight className="size-3.5" />
          </Button>
        </RequestAccessDialog>
      )}
    </div>
  );
}
