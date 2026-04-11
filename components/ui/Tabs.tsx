"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs components must be used inside <Tabs>");
  return ctx;
}

export interface TabsProps {
  defaultTab: string;
  children: React.ReactNode;
  className?: string;
  onChange?: (tab: string) => void;
}

export function Tabs({ defaultTab, children, className, onChange }: TabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultTab);

  const handleSet = (id: string) => {
    setActiveTab(id);
    onChange?.(id);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleSet }}>
      <div className={cn("flex flex-col", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex justify-center flex-wrap gap-1",
        className
      )}
    >
      {children}
    </div>
  );
}

export interface TabTriggerProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function TabTrigger({ id, children, className }: TabTriggerProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const active = activeTab === id;

  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => setActiveTab(id)}
      className={cn(
        "px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-150",
        "border-b-2 -mb-px",
        active
          ? "border-brand text-brand"
          : "border-transparent text-foreground-muted hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

export interface TabPanelProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function TabPanel({ id, children, className }: TabPanelProps) {
  const { activeTab } = useTabsContext();
  if (activeTab !== id) return null;
  return (
    <div role="tabpanel" className={cn("pt-4", className)}>
      {children}
    </div>
  );
}
