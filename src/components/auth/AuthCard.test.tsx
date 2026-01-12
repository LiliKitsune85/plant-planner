import { render, screen } from "@testing-library/react";

import { AuthCard } from "./AuthCard";

describe("AuthCard", () => {
  const baseChildren = <div>Form content</div>;

  it("renders eyebrow, title and description when provided", () => {
    render(
      <AuthCard eyebrow="Beta access" title="Sign in" description="Use your email address">
        {baseChildren}
      </AuthCard>
    );

    expect(screen.getByText("Beta access")).toBeInTheDocument();
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.getByText("Use your email address")).toBeInTheDocument();
  });

  it("merges custom className with default card styling", () => {
    render(
      <AuthCard title="Class merge" className="border-primary">
        {baseChildren}
      </AuthCard>
    );

    const card = screen.getByText("Class merge").closest('[data-slot="card"]');
    expect(card).not.toBeNull();
    expect(card).toHaveClass("border-primary");
    expect(card).toHaveClass("shadow-lg");
  });

  it("renders footer node when provided and ignores footerLinks", () => {
    render(
      <AuthCard
        title="With footer"
        footer={<div>Custom footer</div>}
        footerLinks={[
          { label: "Reset password", href: "/reset" },
          { label: "Register", href: "/register" },
        ]}
      >
        {baseChildren}
      </AuthCard>
    );

    expect(screen.getByText("Custom footer")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /linki pomocnicze/i })).not.toBeInTheDocument();
  });

  it("renders footerLinks when footer is omitted", () => {
    render(
      <AuthCard
        title="Helper links"
        footerLinks={[{ label: "Reset password", description: "Przypomnij hasło", href: "/reset" }]}
      >
        {baseChildren}
      </AuthCard>
    );

    expect(screen.getByRole("navigation", { name: /linki pomocnicze/i })).toBeInTheDocument();
    expect(screen.getByText("Reset password")).toBeInTheDocument();
    expect(screen.getByText("Przypomnij hasło")).toBeInTheDocument();
  });

  it("omits footer entirely when footerLinks is empty", () => {
    const { container } = render(
      <AuthCard title="No footer" footerLinks={[]}>
        {baseChildren}
      </AuthCard>
    );

    expect(container.querySelector('[data-slot="card-footer"]')).toBeNull();
  });
});
