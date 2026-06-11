"use client";

import { useEffect, useState } from "react";
import { Bell, CircleHelp, Moon, Sun } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { OnboardingModal } from "@/components/onboarding-modal";
import { HelpPanel } from "@/components/help-panel";

const SIDEBAR_KEY = "vinylvault.sidebar.collapsed";
const THEME_KEY = "vinylvault.theme";

interface AppShellProps {
  userEmail?: string;
  ebayConnected?: boolean;
  children: React.ReactNode;
}

export function AppShell({ userEmail, ebayConnected, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);

  useEffect(() => {
    try {
      const storedSidebar = window.localStorage.getItem(SIDEBAR_KEY);
      if (storedSidebar === "1") setCollapsed(true);

      const storedTheme = window.localStorage.getItem(THEME_KEY) as "dark" | "light" | null;
      const initial = storedTheme ?? "dark";
      setTheme(initial);
      applyTheme(initial);
    } catch {
      applyTheme("dark");
    }
    setHydrated(true);
  }, []);

  function applyTheme(t: "dark" | "light") {
    try {
      const root = document.documentElement;
      if (t === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    } catch {
      // SSR guard
    }
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed, hydrated]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        userEmail={userEmail}
        ebayConnected={ebayConnected}
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        onHelpClick={() => setHelpPanelOpen(true)}
      />

      <div
        className={`min-h-screen flex flex-col transition-[margin] duration-200 ease-out ${
          collapsed ? "ml-16" : "ml-60"
        }`}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-12 items-center justify-end gap-1 border-b border-border bg-background/80 px-6 backdrop-blur-sm">
          {/* Help */}
          <button
            onClick={() => setHelpPanelOpen(true)}
            title="Help & Guide"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <CircleHelp className="h-4 w-4" />
          </button>

          {/* Notifications (placeholder) */}
          <button
            title="Notifications"
            className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            {/* Unread dot — remove when no notifications */}
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        </header>

        <main className="flex-1 p-8">{children}</main>
      </div>

      {/* First-time-only welcome tour (auto-opens once per browser) */}
      <OnboardingModal />

      {/* In-depth help, opened from the Help & Guide buttons */}
      <HelpPanel open={helpPanelOpen} onOpenChange={setHelpPanelOpen} />
    </div>
  );
}
