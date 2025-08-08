export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-white/30 dark:bg-gray-900/30 backdrop-blur-xl border border-white/20 rounded-xl animate-shimmer-glass ${className || ""}`}
    >
      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-60 animate-shimmer" />
      <span className="invisible">&nbsp;</span>
    </div>
  );
}
