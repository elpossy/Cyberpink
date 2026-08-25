import Link from "next/link";

interface DonateButtonProps {
  productName?: string;
  className?: string;
  variant?: "primary" | "ghost-light" | "ghost-dark" | "outline-pink";
}

export function DonateButton({
  productName,
  className = "",
  variant = "primary",
}: DonateButtonProps) {
  const message = productName
    ? `Je contribue au développement de ma nation en investissant dans ${productName}.`
    : "Je contribue au développement de ma nation en investissant dans cyberPink.";

  const href = `/dons?message=${encodeURIComponent(message)}${
    productName ? `&product=${encodeURIComponent(productName)}` : ""
  }`;

  const variantClass =
    variant === "primary"
      ? "btn btn-primary"
      : variant === "ghost-light"
        ? "btn btn-ghost-light"
        : variant === "ghost-dark"
          ? "btn btn-ghost-dark"
          : "btn btn-outline-pink";

  return (
    <Link href={href} className={`${variantClass} ${className}`.trim()}>
      Faire un don
    </Link>
  );
}
