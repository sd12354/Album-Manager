"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";

const STORAGE_KEY = "vinylvault.sidebar.collapsed";

interface AppShellProps {
  userEmail?: string;
  ebayConnected?: boolean;
  children: React.ReactNode;
}

export function AppShell({ userEmail, ebayConnected, children }: AppShellProps) {
  // Default to expanded; hydrate the persisted choice on mount.
  // We accept a brief FOUC on first paint instead of blocking SSR on
  // window access — keeps the root layout server-renderable.
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      // localStorage can throw in private mode / restricted contexts.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // Ignore quota / availability errors.
    }
  }, [collapsed, hydrated]);

  return (
    <div className="min-h-screen bg-base">
      <Sidebar
        userEmail={userEmail}
        ebayConnected={ebayConnected}
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
      />
      <main
        className={`min-h-screen p-8 transition-[margin] duration-200 ease-out ${
          collapsed ? "ml-16" : "ml-60"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
