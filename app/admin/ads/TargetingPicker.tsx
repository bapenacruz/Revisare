"use client";

import { useState, useEffect } from "react";
import { AD_REGIONS, AD_COMPASS_QUADRANTS } from "@/lib/ad-targeting";
import { COUNTRIES } from "@/lib/data/countries";

interface TargetingPickerProps {
  regions: string[];
  quadrants: string[];
  countries: string[];
  states: string[];
  usernames: string[];
  onRegionsChange: (r: string[]) => void;
  onQuadrantsChange: (q: string[]) => void;
  onCountriesChange: (c: string[]) => void;
  onStatesChange: (s: string[]) => void;
  onUsernamesChange: (u: string[]) => void;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export function TargetingPicker({ regions, quadrants, countries, states, usernames, onRegionsChange, onQuadrantsChange, onCountriesChange, onStatesChange, onUsernamesChange, onClick }: TargetingPickerProps) {
  const [countrySearch, setCountrySearch] = useState("");
  const [rawUsernames, setRawUsernames] = useState(() => usernames.join(";"));

  // Keep rawUsernames in sync if usernames are reset externally (e.g. form reset)
  useEffect(() => {
    setRawUsernames(usernames.join(";"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usernames.length === 0 ? 0 : null]);

  function toggleRegion(v: string) {
    onRegionsChange(regions.includes(v) ? regions.filter((r) => r !== v) : [...regions, v]);
  }
  function toggleQuadrant(v: string) {
    onQuadrantsChange(quadrants.includes(v) ? quadrants.filter((q) => q !== v) : [...quadrants, v]);
  }
  function toggleCountry(name: string) {
    const next = countries.includes(name) ? countries.filter((c) => c !== name) : [...countries, name];
    onCountriesChange(next);
    // Remove states that belong to deselected countries
    if (!next.includes(name)) {
      const countryData = COUNTRIES.find((c) => c.name === name);
      if (countryData) {
        onStatesChange(states.filter((s) => !countryData.regions.includes(s)));
      }
    }
  }
  function toggleState(s: string) {
    onStatesChange(states.includes(s) ? states.filter((x) => x !== s) : [...states, s]);
  }

  // Only show states for selected countries that have regions
  const availableStates = countries.flatMap((cName) => {
    const c = COUNTRIES.find((x) => x.name === cName);
    return c?.regions ?? [];
  });

  const filteredCountries = countrySearch.trim()
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(countrySearch.toLowerCase()))
    : COUNTRIES;

  const SIZE = 84;
  const HALF = SIZE / 2;

  return (
    <div className="flex flex-wrap gap-6 items-start" onClick={onClick}>
      {/* Region checkboxes */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
          Target Regions <span className="normal-case font-normal opacity-60">(empty = all)</span>
        </p>
        <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
          {AD_REGIONS.map((r) => (
            <label key={r.value} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={regions.includes(r.value)}
                onChange={() => toggleRegion(r.value)}
                className="accent-brand w-3.5 h-3.5"
              />
              <span className="text-xs text-foreground">{r.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Country picker */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
          Target Countries <span className="normal-case font-normal opacity-60">(empty = all)</span>
        </p>
        <input
          type="text"
          placeholder="Search countries…"
          value={countrySearch}
          onChange={(e) => setCountrySearch(e.target.value)}
          className="text-xs rounded border border-border bg-background text-foreground px-2 py-1 w-48 mb-1"
        />
        <div className="h-32 overflow-y-auto flex flex-col gap-0.5 pr-1 w-48 border border-border rounded p-1.5 bg-background">
          {filteredCountries.map((c) => (
            <label key={c.code} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={countries.includes(c.name)}
                onChange={() => toggleCountry(c.name)}
                className="accent-brand w-3 h-3 shrink-0"
              />
              <span className="text-xs text-foreground truncate">{c.name}</span>
            </label>
          ))}
        </div>
        {countries.length > 0 && (
          <p className="text-xs text-foreground-muted">{countries.length} selected</p>
        )}
      </div>

      {/* State/region picker (always shown when countries are selected) */}
      {countries.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
            Target States/Regions <span className="normal-case font-normal opacity-60">(empty = all)</span>
          </p>
          <div className="h-40 overflow-y-auto flex flex-col gap-0.5 pr-1 w-56 border border-border rounded p-1.5 bg-background">
            {availableStates.length > 0 ? availableStates.map((s) => (
              <label key={s} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={states.includes(s)}
                  onChange={() => toggleState(s)}
                  className="accent-brand w-3 h-3 shrink-0"
                />
                <span className="text-xs text-foreground truncate">{s}</span>
              </label>
            )) : (
              <p className="text-xs text-foreground-muted italic p-1">No regional data for selected countries.</p>
            )}
          </div>
          {states.length > 0 && (
            <p className="text-xs text-foreground-muted">{states.length} selected</p>
          )}
        </div>
      )}

      {/* Political compass selector */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
          Compass Targeting <span className="normal-case font-normal opacity-60">(empty = all)</span>
        </p>
        <div className="flex items-start gap-3">
          {/* Clickable 2×2 grid */}
          <svg
            width={SIZE} height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="rounded ring-1 ring-border shrink-0 cursor-pointer"
          >
            {/* auth-left: top-left */}
            <rect x={0} y={0} width={HALF} height={HALF}
              fill={quadrants.includes("auth-left") ? AD_COMPASS_QUADRANTS[0].fill : "rgba(128,128,128,0.08)"}
              onClick={() => toggleQuadrant("auth-left")} className="transition-all" />
            {/* auth-right: top-right */}
            <rect x={HALF} y={0} width={HALF} height={HALF}
              fill={quadrants.includes("auth-right") ? AD_COMPASS_QUADRANTS[1].fill : "rgba(128,128,128,0.08)"}
              onClick={() => toggleQuadrant("auth-right")} className="transition-all" />
            {/* lib-left: bottom-left */}
            <rect x={0} y={HALF} width={HALF} height={HALF}
              fill={quadrants.includes("lib-left") ? AD_COMPASS_QUADRANTS[2].fill : "rgba(128,128,128,0.08)"}
              onClick={() => toggleQuadrant("lib-left")} className="transition-all" />
            {/* lib-right: bottom-right */}
            <rect x={HALF} y={HALF} width={HALF} height={HALF}
              fill={quadrants.includes("lib-right") ? AD_COMPASS_QUADRANTS[3].fill : "rgba(128,128,128,0.08)"}
              onClick={() => toggleQuadrant("lib-right")} className="transition-all" />

            {/* Axis lines */}
            <line x1={HALF} y1={0} x2={HALF} y2={SIZE} stroke="currentColor" strokeOpacity={0.2} strokeWidth={0.75} />
            <line x1={0} y1={HALF} x2={SIZE} y2={HALF} stroke="currentColor" strokeOpacity={0.2} strokeWidth={0.75} />

            {/* Labels */}
            <text x={2} y={HALF - 2} fontSize={8} fill="currentColor" fillOpacity={0.45} style={{ pointerEvents: "none" }}>L</text>
            <text x={SIZE - 9} y={HALF - 2} fontSize={8} fill="currentColor" fillOpacity={0.45} style={{ pointerEvents: "none" }}>R</text>
            <text x={HALF + 2} y={10} fontSize={8} fill="currentColor" fillOpacity={0.45} style={{ pointerEvents: "none" }}>A</text>
            <text x={HALF + 2} y={SIZE - 2} fontSize={8} fill="currentColor" fillOpacity={0.45} style={{ pointerEvents: "none" }}>L</text>
          </svg>

          {/* Legend */}
          <div className="flex flex-col gap-1.5 pt-0.5">
            {AD_COMPASS_QUADRANTS.map((q) => (
              <button
                key={q.value}
                type="button"
                onClick={() => toggleQuadrant(q.value)}
                className={`flex items-center gap-1.5 text-xs transition-colors text-left ${
                  quadrants.includes(q.value) ? "text-foreground" : "text-foreground-muted"
                }`}
              >
                <span
                  className="w-3 h-3 rounded-sm shrink-0 ring-1 ring-border/50"
                  style={{ background: quadrants.includes(q.value) ? q.fill : "rgba(128,128,128,0.12)" }}
                />
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Specific users */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
          Target Specific Users <span className="normal-case font-normal opacity-60">(empty = all, separate with ;)</span>
        </p>
        <textarea
          rows={4}
          className="text-sm rounded border border-border bg-background text-foreground p-2 w-48 resize-none font-mono"
          placeholder={"john_doe;jane_smith"}
          value={rawUsernames}
          onChange={(e) => {
            setRawUsernames(e.target.value);
            const parts = e.target.value.split(";").map((l) => l.trim()).filter(Boolean);
            onUsernamesChange(parts);
          }}
        />
      </div>
    </div>
  );
}
