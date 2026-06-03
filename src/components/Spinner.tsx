/** Minimal teal spinner used for loading states. */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-accent ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
