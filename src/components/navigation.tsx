"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  IndianRupee,
  Wrench,
  Hotel,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "@/components/role-switcher";

interface NavigationProps {
  role: string | null;
}

const navItems = [
  {
    name: "Live Board",
    href: "/",
    icon: LayoutDashboard,
    shortName: "Rooms",
  },
  {
    name: "Bookings",
    href: "/bookings",
    icon: CalendarDays,
    shortName: "Bookings",
  },
  {
    name: "Guests",
    href: "/guests",
    icon: Users,
    shortName: "Guests",
  },
  {
    name: "Finance",
    href: "/finance",
    icon: IndianRupee,
    shortName: "Finance",
  },
  {
    name: "Issues",
    href: "/issues",
    icon: Wrench,
    shortName: "Issues",
  },
];

export function Sidebar({ role }: NavigationProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 border-r bg-card/60 backdrop-blur-md p-4 min-h-screen justify-between shrink-0">
      <div className="space-y-5">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md">
            <Hotel className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">
              Lodge MS
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-muted-foreground">17 Inventory Rooms</span>
            </div>
          </div>
        </div>

        {/* Local Role Switcher */}
        <div className="px-1">
          <RoleSwitcher currentRole={role} />
        </div>

        {/* Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Footer */}
      <div className="border-t pt-4 px-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <UserCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold">Active Session</span>
            <span className="text-[11px] text-muted-foreground capitalize">
              {role?.toLowerCase() || "Admin"} (Local Mode)
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileHeader({ role }: NavigationProps) {
  return (
    <header className="lg:hidden sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b px-3 py-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow">
          <Hotel className="h-4 w-4" />
        </div>
        <span className="font-bold text-sm leading-none">Lodge MS</span>
      </div>

      {/* 1-Click Role Switcher in Top Bar */}
      <RoleSwitcher currentRole={role} />
    </header>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-lg border-t px-2 py-1.5 flex items-center justify-around shadow-lg">
      {navItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[11px] font-medium transition-colors min-w-[56px]",
              isActive
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div
              className={cn(
                "p-1 rounded-md transition-colors",
                isActive ? "bg-primary/10" : ""
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <span className="mt-0.5 leading-none">{item.shortName}</span>
          </Link>
        );
      })}
    </nav>
  );
}
