"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquare,
  Menu,
  Settings,
  Truck,
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

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kalender", label: "Kalender", icon: CalendarDays },
  { href: "/anforderungen", label: "Anforderungen", icon: ClipboardList },
  { href: "/baustellen", label: "Baustellen", icon: MapPin },
  { href: "/admin", label: "Administration", icon: Settings, rollen: ["admin"] },
  { href: "/account", label: "Mein Account", icon: UserCircle },
  { href: "/feedback", label: "Feedback", icon: MessageSquare },
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

  const items = NAV.filter(
    (item) => !item.rollen || item.rollen.includes(currentUser.rolle)
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Truck className="size-5" />
        </div>
        <div className="leading-tight">
          <div className="text-base font-semibold">Asphalt-Takt</div>
          <div className="text-xs text-muted-foreground">Mischgut-Disposition</div>
        </div>
      </div>

      <div className="px-3">
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
              onValueChange={(v) => setCurrentUserId(v)}
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

      <nav className="mt-4 flex-1 space-y-1 px-3">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
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
    <div className="flex min-h-dvh">
      {/* Desktop-Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border md:block">
        <div className="sticky top-0 h-dvh">{sidebar}</div>
      </aside>

      {/* Mobile-Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 border-r border-sidebar-border shadow-xl">
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

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile-Topbar */}
        <header className="flex items-center gap-3 border-b bg-background px-4 py-3 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Menü öffnen"
          >
            <Menu className="size-5" />
          </Button>
          <span className="font-semibold">Asphalt-Takt</span>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
