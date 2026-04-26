interface SectionHeadingProps {
  readonly eyebrow: string;
  readonly title: string;
}

export function SectionHeading({ eyebrow, title }: Readonly<SectionHeadingProps>) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-[0.16em] text-[#6B6B6B]">{eyebrow}</p>
      <h2 className="text-3xl font-bold leading-tight text-[#1A1A1A] sm:text-4xl">{title}</h2>
    </div>
  );
}
