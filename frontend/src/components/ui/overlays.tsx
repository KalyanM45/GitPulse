"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Check, X } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ── Tooltip ───────────────────────────────────────────────────────────────── */

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  children,
  content,
  side = "top",
}: {
  children: ReactNode;
  content: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          className={cn(
            "z-50 max-w-xs rounded-lg border border-hairline bg-elevated/95 px-2.5 py-1.5",
            "text-xs leading-relaxed text-ink-2 shadow-2xl backdrop-blur-xl",
            "origin-[var(--radix-tooltip-content-transform-origin)]",
            "duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
            "data-[state=delayed-open]:scale-100 data-[state=delayed-open]:opacity-100",
            "data-[state=closed]:scale-95 data-[state=closed]:opacity-0",
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-elevated" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/* ── Dialog ────────────────────────────────────────────────────────────────── */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

function Overlay({ className, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-base/70 backdrop-blur-md",
        "transition-opacity duration-300",
        "data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

/** Centre-stage modal. Scales in from 96% — the Apple "materialise" feel. */
export const DialogContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string; description?: string }
>(function DialogContent({ className, children, title, description, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[min(94vw,32rem)] -translate-x-1/2 -translate-y-1/2",
          "rounded-panel border border-hairline bg-surface/95 shadow-[0_40px_120px_-24px_rgba(0,0,0,0.9)]",
          "backdrop-blur-2xl",
          "duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "data-[state=open]:scale-100 data-[state=open]:opacity-100",
          "data-[state=closed]:scale-95 data-[state=closed]:opacity-0",
          "motion-reduce:transition-none",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline px-6 py-5">
          <div className="space-y-1">
            <DialogPrimitive.Title className="text-base font-semibold tracking-tight text-ink">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-[13px] text-ink-3">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-3 transition hover:bg-glass hover:text-ink"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

/** Right-hand drawer. Same primitive, different geometry. */
export const DrawerContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string; description?: string }
>(function DrawerContent({ className, children, title, description, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[min(92vw,30rem)] flex-col",
          "border-l border-hairline bg-surface/95 shadow-[-40px_0_120px_-24px_rgba(0,0,0,0.9)]",
          "backdrop-blur-2xl",
          "duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "data-[state=open]:translate-x-0 data-[state=closed]:translate-x-full",
          "motion-reduce:transition-none",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline px-6 py-5">
          <div className="min-w-0 space-y-1">
            <DialogPrimitive.Title className="truncate text-base font-semibold tracking-tight text-ink">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-[13px] text-ink-3">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-3 transition hover:bg-glass hover:text-ink"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

/* ── Dropdown ──────────────────────────────────────────────────────────────── */

export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export function DropdownContent({
  children,
  align = "end",
}: {
  children: ReactNode;
  align?: "start" | "center" | "end";
}) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={8}
        className={cn(
          "z-50 min-w-48 overflow-hidden rounded-xl border border-hairline bg-elevated/95 p-1.5",
          "shadow-[0_24px_60px_-16px_rgba(0,0,0,0.85)] backdrop-blur-2xl",
          "origin-[var(--radix-dropdown-menu-content-transform-origin)]",
          "duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "data-[state=open]:scale-100 data-[state=open]:opacity-100",
          "data-[state=closed]:scale-95 data-[state=closed]:opacity-0",
        )}
      >
        {children}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  );
}

export function DropdownItem({
  children,
  onSelect,
  selected,
}: {
  children: ReactNode;
  onSelect?: () => void;
  selected?: boolean;
}) {
  return (
    <DropdownPrimitive.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2",
        "text-[13px] text-ink-2 outline-none select-none",
        "transition-colors duration-150",
        "data-[highlighted]:bg-glass data-[highlighted]:text-ink",
      )}
    >
      {children}
      {selected && <Check className="size-3.5 text-indigo-lift" />}
    </DropdownPrimitive.Item>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownPrimitive.Label className="px-2.5 py-1.5 text-[11px] font-medium tracking-wider text-ink-3 uppercase">
      {children}
    </DropdownPrimitive.Label>
  );
}

/* ── Tabs ──────────────────────────────────────────────────────────────────── */

export const Tabs = TabsPrimitive.Root;

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-hairline bg-glass p-1 backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({
  value,
  children,
  count,
}: {
  value: string;
  children: ReactNode;
  count?: number;
}) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium",
        "text-ink-3 transition-colors duration-200 outline-none",
        "hover:text-ink-2",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-lift",
        "data-[state=active]:bg-white/[0.07] data-[state=active]:text-ink",
        "data-[state=active]:shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset]",
      )}
    >
      {children}
      {count !== undefined && (
        <span className="tnum rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-ink-3">
          {count}
        </span>
      )}
    </TabsPrimitive.Trigger>
  );
}

export const TabsContent = TabsPrimitive.Content;

/* ── Switch ────────────────────────────────────────────────────────────────── */

export function Switch({
  checked,
  onCheckedChange,
  id,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  id?: string;
}) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-hairline",
        "transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-lift",
        "data-[state=unchecked]:bg-white/[0.06]",
        "data-[state=checked]:border-indigo-2/50 data-[state=checked]:bg-[linear-gradient(180deg,#6366f1,#4f46e5)]",
        "data-[state=checked]:shadow-[0_0_20px_-4px_rgba(99,102,241,0.8)]",
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-[18px] rounded-full bg-white shadow-md",
          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "translate-x-[3px] will-change-transform",
          "data-[state=checked]:translate-x-[23px]",
          "motion-reduce:transition-none",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
