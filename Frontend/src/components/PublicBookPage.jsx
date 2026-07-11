/**
 * Payments P5 (routing shell) — placeholder for the public shared-book page.
 *
 * Rendered OUTSIDE the auth gate via a `/book/{token}` pathname branch in App.jsx, because a shared link
 * must open for a logged-out visitor. This is only the shell: sv2-s13 builds the real read-only view
 * (fetch the book by its share token, render it). No data fetching here on purpose.
 */
export default function PublicBookPage({ token }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center">
          <img src="/images/cradleLogo.png" alt="CradleHQ" className="h-24 block" />
        </div>
        <h1 className="font-display font-bold text-3xl text-brand-navy">
          Cradle<span className="text-primary">HQ</span>
        </h1>
        <p className="font-display text-muted-foreground mt-4">
          Shared memory books are coming soon.
        </p>
        <p className="text-xs text-muted-foreground/70 mt-6 break-all">book token: {token}</p>
      </div>
    </div>
  );
}
