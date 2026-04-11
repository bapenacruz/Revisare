"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronRight, ArrowLeft, Search, X, Check } from "lucide-react";
import { COUNTRIES } from "@/lib/data/countries";

interface CountryRegionPickerProps {
  country: string;
  region: string;
  onCountryChange: (country: string) => void;
  onRegionChange: (region: string) => void;
  required?: boolean;
  label?: string;
}

export function CountryRegionPicker({
  country,
  region,
  onCountryChange,
  onRegionChange,
  required,
  label = "Country / Region",
}: CountryRegionPickerProps) {
  const [open, setOpen] = useState<"country" | "region" | null>(null);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedCountry = COUNTRIES.find((c) => c.name === country) ?? null;
  const hasRegions = (selectedCountry?.regions?.length ?? 0) > 0;

  const filteredCountries = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredRegions = (selectedCountry?.regions ?? []).filter((r) =>
    r.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setSearch("");
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open]);

  const handleCountrySelect = (name: string) => {
    onCountryChange(name);
    onRegionChange(""); // clear region when country changes
    const c = COUNTRIES.find((x) => x.name === name);
    if (c && c.regions.length > 0) {
      setSearch("");
      setOpen("region");
    } else {
      setOpen(null);
    }
  };

  const handleRegionSelect = (r: string) => {
    onRegionChange(r);
    setOpen(null);
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-sm font-medium text-foreground">
            {label}
            {required && <span className="text-danger ml-1">*</span>}
          </label>
        )}
        <button
          type="button"
          onClick={() => setOpen("country")}
          className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm transition-colors hover:border-brand focus:outline-none focus:border-brand"
        >
          <span className={country ? "text-foreground" : "text-foreground-muted"}>
            {country || "Select country"}
          </span>
          <ChevronRight size={16} className="text-foreground-muted shrink-0" />
        </button>
        {hasRegions && (
          <button
            type="button"
            onClick={() => setOpen("region")}
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg border border-border bg-surface text-sm transition-colors hover:border-brand focus:outline-none focus:border-brand"
          >
            <span className={region ? "text-foreground" : "text-foreground-muted"}>
              {region || "Select state / province / region"}
            </span>
            <ChevronRight size={16} className="text-foreground-muted shrink-0" />
          </button>
        )}
      </div>

      {/* Full-screen sheet */}
      {open && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-background">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="p-2 -ml-2 rounded-lg hover:bg-surface transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-base font-semibold text-foreground flex-1">
              {open === "country" ? "Select Country" : `Select Region — ${country}`}
            </h2>
            {open === "region" && (
              <button
                type="button"
                onClick={() => { onRegionChange(""); setOpen(null); }}
                className="text-xs text-foreground-muted hover:text-foreground"
              >
                Skip
              </button>
            )}
          </div>

          {/* Search */}
          <div className="px-4 py-2 border-b border-border shrink-0">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={open === "country" ? "Search countries..." : "Search regions..."}
                className="w-full pl-9 pr-9 py-2.5 bg-surface rounded-lg border border-border text-sm outline-none focus:border-brand transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {open === "country" &&
              filteredCountries.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleCountrySelect(c.name)}
                  className="flex items-center justify-between w-full px-4 py-3.5 text-sm border-b border-border/40 hover:bg-surface transition-colors"
                >
                  <span className="text-foreground">{c.name}</span>
                  <div className="flex items-center gap-2">
                    {c.regions.length > 0 && (
                      <span className="text-xs text-foreground-muted">{c.regions.length} regions</span>
                    )}
                    {country === c.name && <Check size={16} className="text-brand" />}
                  </div>
                </button>
              ))}
            {open === "region" &&
              filteredRegions.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRegionSelect(r)}
                  className="flex items-center justify-between w-full px-4 py-3.5 text-sm border-b border-border/40 hover:bg-surface transition-colors"
                >
                  <span className="text-foreground">{r}</span>
                  {region === r && <Check size={16} className="text-brand" />}
                </button>
              ))}
            {((open === "country" && filteredCountries.length === 0) ||
              (open === "region" && filteredRegions.length === 0)) && (
              <p className="px-4 py-8 text-center text-sm text-foreground-muted">No results</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
