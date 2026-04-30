export function BuiltWithBadge({ enabled, url }: { enabled?: string; url?: string }) {
  if (enabled !== "true" || !url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 right-4 z-30 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground shadow-sm hover:bg-muted/80 transition-colors"
    >
      Built with this template
    </a>
  );
}
