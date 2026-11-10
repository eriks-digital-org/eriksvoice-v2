"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronLeft, LogOut, Menu, MoreHorizontal, ShieldCheck, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { adminMainNav, adminMoreNav, isActivePath, portalMainNav, portalMoreNav, type NavItem } from "./nav";

export type ShellMode = "admin" | "portal";

export interface ShellProps {
  mode: ShellMode;
  /** "/admin" or "/<client-slug>" */
  root: string;
  userName: string;
  clientName?: string;
  /** Other places this user may switch to (admin panel and/or other clients). */
  switches?: { href: string; label: string; kind: "admin" | "client" }[];
  children: React.ReactNode;
}

const LOGO = "/brand/eriksvoice-logo.webp";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function navFor(mode: ShellMode) {
  return mode === "admin"
    ? { main: adminMainNav, more: adminMoreNav }
    : { main: portalMainNav, more: portalMoreNav };
}

function NavLink({
  item,
  root,
  onNavigate,
  size = "lg",
}: {
  item: NavItem;
  root: string;
  onNavigate?: () => void;
  size?: "lg" | "sub";
}) {
  const path = usePathname();
  const href = root + item.to;
  const active = isActivePath(path, href, root);
  const Icon = item.icon;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-4 rounded-[18px] px-4 font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        size === "lg" && "h-14 text-[18px]",
        size === "sub" && "h-12 ps-14 text-[16px]",
        active ? "bg-ink text-white shadow-primary" : "text-ink-muted hover:bg-sidebar-accent hover:text-ink",
      )}
    >
      {size !== "sub" && (
        <Icon
          className={cn("size-[22px] shrink-0", active ? "text-cta-dot" : "text-ink-soft group-hover:text-violet")}
          strokeWidth={1.9}
        />
      )}
      <span className="flex-1 truncate">{item.label}</span>
    </Link>
  );
}

function MoreGroup({ items, root, onNavigate }: { items: NavItem[]; root: string; onNavigate?: () => void }) {
  const path = usePathname();
  const inside = items.some((i) => isActivePath(path, root + i.to, root));
  const [open, setOpen] = useState(inside);
  const shown = open || inside;
  return (
    <div className="mt-1.5 border-t border-sidebar-border pt-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={shown}
        className={cn(
          "flex h-[52px] w-full items-center gap-4 rounded-[18px] px-4 text-[17px] font-medium transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          shown ? "text-ink" : "text-ink-muted",
        )}
      >
        <MoreHorizontal className="size-[22px] text-ink-soft" strokeWidth={1.9} />
        <span className="flex-1 text-start">עוד</span>
        <ChevronDown className={cn("size-[18px] text-ink-soft transition-transform duration-200", shown && "rotate-180")} />
      </button>
      {shown && (
        <div className="mt-1 flex flex-col gap-0.5">
          {items.map((i) => (
            <NavLink key={i.to} item={i} root={root} onNavigate={onNavigate} size="sub" />
          ))}
        </div>
      )}
    </div>
  );
}

function ModeTag({ mode, clientName }: { mode: ShellMode; clientName?: string }) {
  if (mode === "admin") {
    return (
      <span className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-[#1a1240] ps-2.5 pe-3.5 text-white">
        <ShieldCheck className="size-4 shrink-0 text-cta-dot" strokeWidth={2} />
        <span className="text-[13px] font-semibold">פאנל ניהול</span>
      </span>
    );
  }
  return (
    <span className="mt-3 flex w-fit max-w-full items-center gap-1.5 rounded-full bg-tint py-1.5 ps-2.5 pe-3.5 text-[13px] text-ink">
      <Store className="size-4 shrink-0 text-violet" strokeWidth={2} />
      <span className="truncate font-semibold">{clientName}</span>
    </span>
  );
}

function SidebarNav({
  mode,
  root,
  userName,
  clientName,
  onNavigate,
}: Omit<ShellProps, "children" | "switches"> & { onNavigate?: () => void }) {
  const { main, more } = navFor(mode);
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-6">
      <Link href={root} onClick={onNavigate} className="px-2.5 pt-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="EriksVoice" width={183} height={34} className="h-[34px] w-auto" />
        <ModeTag mode={mode} clientName={clientName} />
      </Link>
      <nav className="flex flex-col gap-1.5" aria-label="תפריט">
        {main.map((i) => (
          <NavLink key={i.to} item={i} root={root} onNavigate={onNavigate} />
        ))}
        <MoreGroup items={more} root={root} onNavigate={onNavigate} />
      </nav>
      <div className="mt-auto flex items-center gap-3 border-t border-sidebar-border px-2.5 pt-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#ffd56e,#ff94c6)] text-[16px] font-semibold text-ink">
          {initialsOf(userName)}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[16px] font-medium text-ink">{userName}</p>
          <p className="truncate text-[13px] text-ink-muted">{mode === "admin" ? "אדמין מערכת" : clientName}</p>
        </div>
      </div>
    </div>
  );
}

function ModeBadge({ mode, clientName }: { mode: ShellMode; clientName?: string }) {
  if (mode === "admin") {
    return (
      <div className="hidden min-h-14 items-center gap-3 rounded-full bg-[#1a1240] ps-2 pe-4 text-white shadow-primary lg:flex">
        <span className="grid size-10 place-items-center rounded-full bg-white/10">
          <ShieldCheck className="size-5 text-cta-dot" strokeWidth={2} />
        </span>
        <span className="leading-tight">
          <span className="block text-[16px] font-semibold">פאנל ניהול</span>
          <span className="block text-[12px] text-white/60">כל הלקוחות במקום אחד</span>
        </span>
      </div>
    );
  }
  return (
    <div className="hidden min-h-12 items-center gap-2.5 rounded-full bg-white/80 ps-1.5 pe-4 text-ink shadow-soft lg:flex">
      <span className="grid size-9 place-items-center rounded-full bg-tint text-violet">
        <Store className="size-[18px]" strokeWidth={2} />
      </span>
      <span className="text-[15px] font-semibold">{clientName}</span>
    </div>
  );
}

function ModeStrip({ mode }: { mode: ShellMode }) {
  if (mode !== "admin") return null;
  return (
    <div className="flex min-h-14 items-center gap-3 bg-[#1a1240] px-4 text-white sm:px-8 lg:hidden">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10">
        <ShieldCheck className="size-[18px] text-cta-dot" strokeWidth={2} />
      </span>
      <span className="text-[15px] font-semibold">פאנל ניהול</span>
    </div>
  );
}

function AppHeader({
  mode,
  root,
  userName,
  clientName,
  switches,
  onMenu,
}: Omit<ShellProps, "children"> & { onMenu: () => void }) {
  return (
    <div className="sticky top-0 z-30" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <ModeStrip mode={mode} />
      <header className="flex h-[72px] items-center gap-3 bg-[#efe9fd]/80 px-4 backdrop-blur-xl sm:px-8 lg:h-24 lg:bg-transparent lg:px-14 lg:backdrop-blur-none">
        <ModeBadge mode={mode} clientName={clientName} />
        <Link href={root} className="lg:hidden" aria-label="בית">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="EriksVoice" width={150} height={28} className="h-7 w-auto" />
        </Link>
        <Button variant="ghost" size="icon" className="hidden sm:inline-flex lg:hidden" onClick={onMenu} aria-label="פתח תפריט">
          <Menu className="size-5" />
        </Button>
        <div className="ms-auto flex items-center gap-2">
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger
              aria-label="החשבון שלי"
              className="flex min-h-12 items-center gap-2.5 rounded-full p-1 outline-none transition-colors hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-ring/40 sm:pe-3"
            >
              <span className="grid size-10 place-items-center rounded-full bg-[linear-gradient(135deg,#ffd56e,#ff94c6)] text-sm font-semibold text-ink">
                {initialsOf(userName)}
              </span>
              <span className="hidden text-start leading-tight md:block">
                <span className="block text-sm font-medium">{userName}</span>
                <span className="block text-xs text-muted-foreground">{mode === "admin" ? "אדמין מערכת" : clientName}</span>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-2xl p-2">
              {switches && switches.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">מעבר אל</DropdownMenuLabel>
                  {switches.map((s) => (
                    <DropdownMenuItem key={s.href} asChild className="rounded-lg">
                      <Link href={s.href}>
                        {s.kind === "admin" ? <ShieldCheck /> : <Store />} {s.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              <form action="/auth/signout" method="post">
                <DropdownMenuItem asChild className="rounded-lg text-destructive">
                  <button type="submit" className="w-full">
                    <LogOut /> התנתקות
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </div>
  );
}

function TabBar({ mode, root }: { mode: ShellMode; root: string }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const { main, more: moreItems } = navFor(mode);
  const inMore = moreItems.some((i) => isActivePath(path, root + i.to, root));
  const tab = (active: boolean) =>
    cn(
      "flex min-h-14 flex-col items-center justify-center gap-[3px] rounded-2xl text-[13px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
      active ? "text-ink" : "text-ink-muted",
    );
  const pill = (active: boolean) =>
    cn(
      "grid h-8 w-[52px] place-items-center rounded-full transition-colors duration-200",
      active ? "bg-ink text-cta-dot" : "text-ink-soft",
    );
  return (
    <>
      <nav
        aria-label="ניווט ראשי"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid border-t border-sidebar-border bg-white/92 px-2 pt-2 shadow-[0_-12px_30px_-24px_rgba(70,40,160,0.4)] backdrop-blur-xl lg:hidden"
        style={{ gridTemplateColumns: `repeat(${main.length + 1}, minmax(0, 1fr))` }}
      >
        {main.map((i) => {
          const href = root + i.to;
          const active = isActivePath(path, href, root);
          const Icon = i.icon;
          return (
            <Link key={i.to} href={href} aria-current={active ? "page" : undefined} className={tab(active)}>
              <span className={pill(active)}>
                <Icon className="size-[22px]" strokeWidth={1.9} />
              </span>
              <span className="whitespace-nowrap">{i.label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" className={tab(inMore)}>
          <span className={pill(inMore)}>
            <MoreHorizontal className="size-[22px]" strokeWidth={1.9} />
          </span>
          <span>עוד</span>
        </button>
      </nav>
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="safe-bottom rounded-t-[28px] border-0 bg-card px-5 pt-6 lg:hidden">
          <SheetTitle className="text-[22px] font-medium text-ink">עוד</SheetTitle>
          <SheetDescription className="sr-only">עוד מקומות</SheetDescription>
          <ul className="mt-3 flex flex-col">
            {moreItems.map((i) => {
              const href = root + i.to;
              const active = isActivePath(path, href, root);
              const Icon = i.icon;
              return (
                <li key={i.to} className="border-b border-border last:border-0">
                  <Link
                    href={href}
                    onClick={() => setMore(false)}
                    aria-current={active ? "page" : undefined}
                    className="flex min-h-[60px] items-center gap-4 text-[18px] font-medium text-ink"
                  >
                    <span className={cn("grid size-11 place-items-center rounded-2xl", active ? "bg-ink text-cta-dot" : "bg-tint text-violet")}>
                      <Icon className="size-[22px]" strokeWidth={1.9} />
                    </span>
                    <span className="flex-1">{i.label}</span>
                    <ChevronLeft className="size-5 text-ink-soft" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** RTL app shell shared by the admin panel and the client portal. */
export function AppShell(props: ShellProps) {
  const { mode, root, userName, clientName, children } = props;
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex min-h-screen w-full">
      <div className="calm-blobs" aria-hidden>
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <aside className="sticky top-0 z-10 hidden h-screen w-[296px] shrink-0 py-6 ps-6 lg:block">
        <div className="h-full overflow-hidden rounded-[32px] bg-sidebar shadow-card backdrop-blur-xl">
          <SidebarNav mode={mode} root={root} userName={userName} clientName={clientName} />
        </div>
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-80 border-0 bg-card p-0">
          <SheetTitle className="sr-only">תפריט</SheetTitle>
          <SidebarNav mode={mode} root={root} userName={userName} clientName={clientName} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="relative z-[1] flex min-w-0 flex-1 flex-col">
        <AppHeader {...props} onMenu={() => setOpen(true)} />
        <main
          className={cn(
            "mx-auto w-full flex-1 pb-tabbar px-5 pt-2 sm:px-8 lg:px-14 lg:pb-16 lg:pt-4",
            mode === "portal" ? "max-w-[1080px]" : "max-w-[1240px]",
          )}
        >
          {children}
        </main>
      </div>
      <TabBar mode={mode} root={root} />
    </div>
  );
}
