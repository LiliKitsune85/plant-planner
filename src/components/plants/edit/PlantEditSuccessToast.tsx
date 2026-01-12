import { Button } from "@/components/ui/button";

interface PlantEditSuccessToastProps {
  open: boolean;
  message?: string;
  onOpenChange: (open: boolean) => void;
}

export const PlantEditSuccessToast = ({
  open,
  message = "Zapisano zmiany",
  onOpenChange,
}: PlantEditSuccessToastProps) => {
  if (!open) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-emerald-600/30 bg-emerald-700/90 px-4 py-3 text-sm text-white shadow-lg">
      <div className="flex-1">
        <p className="font-semibold">Sukces</p>
        <p>{message}</p>
      </div>
      <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => onOpenChange(false)}>
        Zamknij
      </Button>
    </div>
  );
};

PlantEditSuccessToast.displayName = "PlantEditSuccessToast";
