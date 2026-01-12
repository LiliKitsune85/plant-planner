interface PlantThumbnailProps {
  photoPath: string | null | undefined;
  alt: string;
}

export const PlantThumbnail = ({ photoPath, alt }: PlantThumbnailProps) => {
  const fallbackInitial = alt.trim().charAt(0).toUpperCase() || "?";

  if (photoPath) {
    return (
      <div className="size-12 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-muted">
        <img src={photoPath} alt={alt} className="size-full object-cover" loading="lazy" decoding="async" />
      </div>
    );
  }

  return (
    <div className="size-12 shrink-0 rounded-xl border border-dashed border-border/70 bg-muted/60 text-base font-semibold text-muted-foreground flex items-center justify-center">
      {fallbackInitial}
    </div>
  );
};

PlantThumbnail.displayName = "PlantThumbnail";
