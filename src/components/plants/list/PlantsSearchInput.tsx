import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

interface PlantsSearchInputProps {
  value: string;
  pending?: boolean;
  debounceMs?: number;
  maxLength?: number;
  onCommit: (value: string) => void;
}

export const PlantsSearchInput = ({
  value,
  pending = false,
  debounceMs = 400,
  maxLength = 120,
  onCommit,
}: PlantsSearchInputProps) => {
  const [draft, setDraft] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedRef = useRef(value);

  useEffect(() => {
    setDraft(value);
    lastCommittedRef.current = value;
  }, [value]);

  useEffect(() => {
    if (draft === lastCommittedRef.current) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      lastCommittedRef.current = draft;
      onCommit(draft);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [debounceMs, draft, onCommit]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClear = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setDraft("");
    lastCommittedRef.current = "";
    onCommit("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    lastCommittedRef.current = draft;
    onCommit(draft);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground" htmlFor="plants-search-input">
        Wyszukaj roślinę
      </label>
      <div className="group relative flex items-center rounded-lg border bg-background/80 shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
        <input
          id="plants-search-input"
          type="search"
          inputMode="search"
          placeholder="np. monstera, kalatea, sukulent..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={maxLength}
          className="w-full rounded-lg border-0 bg-transparent px-4 py-2 pr-24 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
          autoComplete="off"
          aria-label="Wyszukaj rośliny po nazwie gatunku lub pseudonimie"
        />
        {pending && (
          <span className="pointer-events-none absolute right-14 size-4 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-primary/80" />
        )}
        {draft && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 text-muted-foreground hover:text-foreground"
          >
            Wyczyść
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Wpisz minimum 1 znak. Maksymalna długość wynosi {maxLength} znaków.
      </p>
    </form>
  );
};

PlantsSearchInput.displayName = "PlantsSearchInput";
