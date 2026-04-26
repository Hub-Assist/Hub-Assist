interface IconProps {
  readonly name: "buildings" | "brackets" | "shield" | "plug" | "gear" | "check";
  readonly className?: string;
}

export function Icon({ name, className = "h-5 w-5" }: Readonly<IconProps>) {
  if (name === "buildings") return <span className={className}>🏢</span>;
  if (name === "brackets") return <span className={className}>{"{ }"}</span>;
  if (name === "shield") return <span className={className}>🛡️</span>;
  if (name === "plug") return <span className={className}>🔌</span>;
  if (name === "gear") return <span className={className}>⚙️</span>;
  return <span className={className}>✅</span>;
}
