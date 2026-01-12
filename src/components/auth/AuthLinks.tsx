export interface AuthLinkItem {
  label: string;
  description?: string;
  href: string;
}

interface AuthLinksProps {
  links: AuthLinkItem[];
}

export const AuthLinks = ({ links }: AuthLinksProps) => {
  if (!links.length) return null;

  return (
    <nav aria-label="Linki pomocnicze" className="space-y-3">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="block rounded-lg border border-border/60 bg-background px-4 py-3 transition hover:border-primary/50 hover:bg-primary/5"
        >
          <p className="font-medium text-foreground">{link.label}</p>
          {link.description ? <p className="text-sm text-muted-foreground">{link.description}</p> : null}
        </a>
      ))}
    </nav>
  );
};

AuthLinks.displayName = "AuthLinks";
