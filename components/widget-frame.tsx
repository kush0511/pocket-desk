import { cn } from "@/lib/utils";

const SIZES = {
  small: "size-[158px] sm:size-[170px] rounded-[22px] p-3.5",
  medium: "h-[158px] w-[338px] sm:h-[170px] sm:w-[364px] rounded-[22px] p-3.5",
  lock: "h-[72px] w-[158px] rounded-2xl px-3 py-2",
} as const;

export function WidgetFrame({
  size,
  href,
  label,
  className,
  children,
}: {
  size: keyof typeof SIZES;
  href: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "relative flex flex-col overflow-hidden text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)] ring-1 ring-white/10 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/60",
          SIZES[size],
          className,
        )}
      >
        {children}
      </a>
      <figcaption className="text-xs text-white/50">{label}</figcaption>
    </figure>
  );
}

export function WidgetSkeleton({ size }: { size: keyof typeof SIZES }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("animate-pulse bg-white/[0.06] ring-1 ring-white/10", SIZES[size])} />
      <div className="h-3 w-20 animate-pulse rounded bg-white/[0.06]" />
    </div>
  );
}
