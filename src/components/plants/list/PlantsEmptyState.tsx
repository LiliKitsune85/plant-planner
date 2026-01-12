import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface PlantsEmptyStateProps {
  query?: string;
  onClearFilters?: () => void;
  ctaHref?: string;
}

export const PlantsEmptyState = ({ query, onClearFilters, ctaHref = "/plants/new" }: PlantsEmptyStateProps) => {
  const hasQuery = Boolean(query && query.length > 0);
  const title = hasQuery ? `Brak wyników dla „${query}”` : "Nie dodałeś jeszcze żadnej rośliny";
  const description = hasQuery
    ? "Spróbuj zmienić filtr wyszukiwania lub wyczyść zapytanie, aby wrócić do pełnej listy."
    : "Dodaj pierwszą roślinę i zacznij planować jej pielęgnację.";

  return (
    <Card className="mx-auto max-w-2xl text-center">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-6xl">🌱</div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        {hasQuery && onClearFilters && (
          <Button type="button" variant="outline" onClick={onClearFilters}>
            Wyczyść filtry
          </Button>
        )}
        <Button asChild>
          <a href={ctaHref}>Dodaj roślinę</a>
        </Button>
      </CardFooter>
    </Card>
  );
};

PlantsEmptyState.displayName = "PlantsEmptyState";
