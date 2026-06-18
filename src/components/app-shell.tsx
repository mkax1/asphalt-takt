"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Factory,
  GanttChartSquare,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquare,
  Menu,
  Settings,
  UserCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { ROLLE_LABEL } from "@/lib/status";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  rollen?: Array<"bauleiter" | "disposition" | "admin">;
}

interface NavGruppe {
  titel: string;
  items: NavItem[];
}

const NAV_GRUPPEN: NavGruppe[] = [
  {
    titel: "Übersicht",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    titel: "Disposition",
    items: [
      { href: "/anforderungen", label: "Anforderungen", icon: ClipboardList },
      { href: "/kalender", label: "Kalender", icon: CalendarDays },
      {
        href: "/taktplanung",
        label: "Taktplanung",
        icon: GanttChartSquare,
        rollen: ["disposition", "admin"],
      },
      { href: "/tagesbedarf", label: "Tagesbedarf", icon: Factory },
      {
        href: "/auswertungen",
        label: "Auswertungen",
        icon: BarChart3,
        rollen: ["disposition", "admin"],
      },
    ],
  },
  {
    titel: "Stammdaten",
    items: [
      { href: "/baustellen", label: "Baustellen", icon: MapPin },
      {
        href: "/admin",
        label: "Administration",
        icon: Settings,
        rollen: ["admin"],
      },
    ],
  },
  {
    titel: "Konto",
    items: [
      { href: "/account", label: "Mein Account", icon: UserCircle },
      { href: "/feedback", label: "Feedback", icon: MessageSquare },
    ],
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, benutzer, setCurrentUserId } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const gruppen = NAV_GRUPPEN.map((g) => ({
    ...g,
    items: g.items.filter(
      (item) => !item.rollen || item.rollen.includes(currentUser.rolle)
    ),
  })).filter((g) => g.items.length > 0);

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-3 pt-4">
        <div className="rounded-xl border border-sidebar-border bg-background/60 p-3">
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {initials(currentUser.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {currentUser.name}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {ROLLE_LABEL[currentUser.rolle]}
              </div>
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
              Rolle wechseln (Demo)
            </label>
            <Select
              value={currentUser.id}
              onValueChange={(v) => v && setCurrentUserId(v)}
              items={Object.fromEntries(
                benutzer.map((b) => [b.id, ROLLE_LABEL[b.rolle]])
              )}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {benutzer.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">
                    {ROLLE_LABEL[b.rolle]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <nav className="mt-5 flex-1 space-y-5 px-3">
        {gruppen.map((gruppe) => (
          <div key={gruppe.titel} className="space-y-0.5">
            <div className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {gruppe.titel}
            </div>
            {gruppe.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-accent font-semibold text-primary"
                      : "font-medium text-foreground/70 hover:bg-muted hover:text-foreground"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                  )}
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:text-destructive"
          onClick={() => router.push("/login")}
        >
          <LogOut className="size-4" />
          Abmelden
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Globale Kopfzeile im Hebel-Blau */}
      <header className="sticky top-0 z-40 border-b-2 border-hebel-gelb bg-hebel-blau text-white">
        <div className="flex h-16 items-center gap-3 px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Menü öffnen"
            className="text-white hover:bg-white/15 hover:text-white md:hidden"
          >
            <Menu className="size-5" />
          </Button>

          <Link href="/dashboard" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Josef Hebel"
              width={40}
              height={40}
              priority
              className="size-10 shrink-0 object-contain"
            />
            <span className="border-l border-white/25 pl-3 leading-tight">
              <span className="block text-base font-semibold">Asphalt-Takt</span>
              <span className="hidden text-xs text-white/70 sm:block">
                Mischgut-Disposition
              </span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight">
                {currentUser.name}
              </div>
              <div className="text-xs text-white/70 leading-tight">
                {ROLLE_LABEL[currentUser.rolle]}
              </div>
            </div>
            <Avatar className="size-9 ring-2 ring-white/30">
              <AvatarFallback className="bg-white text-xs font-semibold text-hebel-blau">
                {initials(currentUser.name)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Desktop-Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border md:block">
          <div className="sticky top-16 h-[calc(100dvh-4rem)]">{sidebar}</div>
        </aside>

        {/* Mobile-Sidebar */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-72 border-r border-sidebar-border bg-sidebar shadow-xl">
              <button
                className="absolute right-3 top-3 z-10 rounded-md p-1 hover:bg-sidebar-accent"
                onClick={() => setMobileOpen(false)}
                aria-label="Menü schließen"
              >
                <X className="size-5" />
              </button>
              {sidebar}
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
