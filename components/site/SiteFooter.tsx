export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="font-display text-lg font-semibold text-ink">
            East Bay Stringing
          </p>
          <p className="text-sm text-stone">
            Mobile racquet stringing · East Bay
          </p>
        </div>
        <div className="space-y-1 text-sm text-stone sm:text-right">
          <p>Contactless meetup · cash / Venmo / Zelle</p>
          <p className="text-xs text-stone/80">
            © {year} East Bay Stringing
          </p>
        </div>
      </div>
    </footer>
  );
}
