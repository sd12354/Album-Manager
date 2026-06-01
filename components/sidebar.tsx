"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Library,
  Upload,
  Settings,
  LogOut,
} from "lucide-react";
import { VinylLogo } from "@/components/vinyl-logo";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/albums", label: "Catalogue", icon: Library },
  { href: "/import", label: "Import CSV", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  userEmail?: string;
  ebayConnected?: boolean;
}

export function Sidebar({ userEmail, ebayConnected = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-60 flex-col border-r border-white/6 bg-sidebar">
      <div className="px-6 py-6">
        <VinylLogo />
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/[0.06] text-[#F5F4F0]"
                  : "text-muted-foreground hover:bg-white/[0.03] hover:text-[#F5F4F0]"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
              )}
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/6 px-6 py-4">
        <div className="mb-3 flex items-center gap-2 text-xs">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              ebayConnected ? "bg-green-500" : "bg-muted"
            )}
          />
          <span className="text-muted-foreground">
            {ebayConnected ? "eBay Connected" : "eBay Not Connected"}
          </span>
        </div>
        {userEmail && (
          <p className="mb-3 truncate text-xs text-muted-foreground">
            {userEmail}
          </p>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-[#F5F4F0]"
        >
          <LogOut className="h-3 w-3" />
          Log out
        </button>
      </div>
    </aside>
  );
}
