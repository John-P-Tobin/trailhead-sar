export default function Skeleton({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  const widths = ["w-full", "w-5/6", "w-2/3", "w-3/4", "w-1/2"];
  return (
    <div className={`space-y-2 ${className}`} aria-busy>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-3 animate-pulse rounded bg-surface-3 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}
