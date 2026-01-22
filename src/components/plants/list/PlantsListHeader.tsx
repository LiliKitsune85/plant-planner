import { Button } from "@/components/ui/button";

export const PlantsListHeader = () => {
  return (
    <header className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/60 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">Kolekcja roślin</p>
        <h1 className="text-2xl font-semibold leading-tight text-foreground">Twoje rośliny</h1>
        <p className="text-sm text-muted-foreground">
          Wyszukuj, sortuj i przechodź do szczegółów każdej rośliny w jednym miejscu.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
          <a href="/calendar" data-testid="plants-back-to-calendar-button">
            Wróć do kalendarza
          </a>
        </Button>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <a href="/plants/new" data-testid="plants-add-plant-button">
            Dodaj roślinę
          </a>
        </Button>
      </div>
    </header>
  );
};

PlantsListHeader.displayName = "PlantsListHeader";
