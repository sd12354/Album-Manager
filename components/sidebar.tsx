"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CircleHelp,
  LayoutDashboard,
  Library,
  LogOut,
  PanelLeft,
  PanelLeftClose,
  Settings,
  Upload,
} from "lucide-react";
import { VinylLogo } from "@/components/vinyl-logo";
import { CollectionSwitcher } from "@/components/collection-switcher";
import { DiscogsMark, EbayMark } from "@/components/marketplace-icons";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { AccessibleCollection } from "@/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/albums", label: "Catalogue", icon: Library },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  userEmail?: string;
  ebayConnected?: boolean;
  discogsConnected?: boolean;
  collapsed?: boolean;
  collections?: AccessibleCollection[];
  activeOwnerId?: string;
  onToggle?: () => void;
  onHelpClick?: () => void;
}

export function Sidebar({
  userEmail,
  ebayConnected = false,
  discogsConnected = false,
  collapsed = false,
  collections = [],
  activeOwnerId = "",
  onToggle,
  onHelpClick,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div
        className={cn(
          "flex items-center py-6",
          collapsed ? "justify-center px-0" : "justify-between px-6"
        )}
      >
        {!collapsed && <VinylLogo />}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {collections.length > 1 && (
        <div className={cn("pb-3", collapsed ? "px-2" : "px-3")}>
          <CollectionSwitcher
            collections={collections}
            activeOwnerId={activeOwnerId}
            collapsed={collapsed}
          />
        </div>
      )}

      <nav className={cn("flex-1 space-y-1", collapsed ? "px-2" : "px-3")}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={collapsed ? label : undefined}
              className={cn(
                "relative flex items-center rounded-lg text-sm font-medium transition-colors",
                collapsed
                  ? "h-10 w-10 justify-center mx-auto"
                  : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-muted/40 text-foreground"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              )}
            >
              {isActive && !collapsed && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Help button */}
      <div className={cn("pb-2", collapsed ? "px-2" : "px-3")}>
        <button
          type="button"
          onClick={onHelpClick}
          title="Help & Guide"
          className={cn(
            "flex w-full items-center rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground",
            collapsed ? "h-10 w-10 justify-center mx-auto" : "gap-3 px-3 py-2.5"
          )}
        >
          <CircleHelp className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Help & Guide</span>}
        </button>
      </div>

      <div
        className={cn(
          "border-t border-white/6 py-4",
          collapsed ? "px-2" : "px-6"
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex items-center gap-1.5"
              title={ebayConnected ? "eBay Connected" : "eBay Not Connected"}
            >
              <EbayMark className="h-3 w-[26px]" />
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  ebayConnected ? "bg-green-500" : "bg-muted"
                )}
              />
            </div>
            <div
              className="flex items-center gap-1.5"
              title={
                discogsConnected ? "Discogs Connected" : "Discogs Not Connected"
              }
            >
              <DiscogsMark className="h-3.5 w-3.5 text-muted-foreground" />
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  discogsConnected ? "bg-green-500" : "bg-muted"
                )}
              />
            </div>
            <button
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2 text-xs">
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
            <div className="mb-3 flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  discogsConnected ? "bg-green-500" : "bg-muted"
                )}
              />
              <span className="text-muted-foreground">
                {discogsConnected ? "Discogs Connected" : "Discogs Not Connected"}
              </span>
            </div>
            {userEmail && (
              <p className="mb-3 truncate text-xs text-muted-foreground">
                {userEmail}
              </p>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="h-3 w-3" />
              Log out
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
