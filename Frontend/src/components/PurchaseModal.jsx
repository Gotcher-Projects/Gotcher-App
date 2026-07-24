import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Loader2, Info } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAiCredits } from "@/contexts/AiCreditsContext";

/**
 * Payments P6 — the purchase modal. Opened by the generalized `openPurchase` seam (PurchaseContext): with
 * no args for credit packs, or with `{ skus: SHARE_SKUS, bookId }` for the Share s13c upsell. A card click
 * creates a Stripe Checkout Session (P2) and sends the browser to the hosted page — no card fields here.
 *
 * Parameterized by `skus` / `bookId` / `heading` / `subheading`; `bookId` is forwarded to checkout when
 * present (required for the share + bundle SKUs, absent for credit packs).
 *
 * Display copy below is cosmetic; the real price + credit grant come from Stripe price metadata (P2/P3).
 * Each SKU card shows `title` (falls back to "<credits> credits"), `price`, `blurb`, and an optional `badge`.
 */
const CREDIT_SKUS = [
  { sku: "credits_50", credits: 50, price: "$5", blurb: "50 ✨ “write this for me” drafts." },
  { sku: "credits_125", credits: 125, price: "$10", blurb: "125 drafts — more per dollar." },
];

// Share s13c — the two SKUs for the StorybookTab share upsell. Both carry the active bookId at call time.
// share_only unlocks sharing for one book; the bundle adds 150 ✨ credits for $5 more (flagged best value).
export const SHARE_SKUS = [
  { sku: "share_only", title: "Unlock sharing", price: "$10", blurb: "Anyone with the link can read this book — no app, no login." },
  { sku: "bundle_share_150", title: "Unlock + 150 ✨ credits", price: "$15", blurb: "Sharing for this book, plus 150 “write this for me” credits.", badge: "Best value" },
];

const DEFAULT_HEADING = "Get AI credits";
const DEFAULT_SUBHEADING =
  "Credits power the ✨ “write this for me” assists. Pick a pack — you’ll finish on Stripe’s secure checkout page.";

export default function PurchaseModal({
  open,
  onClose,
  skus = CREDIT_SKUS,
  bookId = null,
  heading = DEFAULT_HEADING,
  subheading = DEFAULT_SUBHEADING,
}) {
  const { credits } = useAiCredits();
  const [loadingSku, setLoadingSku] = useState(null);
  const [error, setError] = useState(null);

  // Fresh state each time it opens (the error case; a success navigates away entirely).
  useEffect(() => {
    if (open) { setError(null); setLoadingSku(null); }
  }, [open]);

  async function buy(sku) {
    if (loadingSku) return;
    setError(null);
    setLoadingSku(sku);
    try {
      const body = bookId ? { sku, bookId } : { sku };
      const data = await apiRequest("/billing/checkout", { method: "POST", body: JSON.stringify(body) });
      if (!data?.url) throw new Error("No checkout URL returned");
      // Stash the purchase SHAPE so the P7 return can confirm the webhook's grant (s13e-1): `before` is the
      // pre-purchase credit balance (detects a credit grant); `sku`/`bookId` let confirmUpgrade watch the right
      // signal — a credits delta for packs, the book's shareUnlocked flag for a share unlock, either for a bundle.
      try {
        sessionStorage.setItem("pendingBuy", JSON.stringify({ before: credits, sku, bookId }));
      } catch { /* ignore */ }
      window.location.href = data.url; // full-page hand-off to Stripe's hosted page
    } catch (e) {
      setError("Couldn't start checkout — please try again.");
      setLoadingSku(null);
    }
  }

  function handleOpenChange(next) {
    if (!next && !loadingSku) onClose?.(); // don't let a click-out abandon an in-flight redirect
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-color-highlight" />
            {heading}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{subheading}</p>
        </DialogHeader>

        <div className="grid gap-3 pt-1">
          {skus.map((item) => (
            <button
              key={item.sku}
              onClick={() => buy(item.sku)}
              disabled={!!loadingSku}
              className="relative text-left p-4 rounded-xl border border-border bg-color-warm/10 hover:border-color-highlight/50 hover:bg-color-warm/20 transition-all disabled:opacity-60 disabled:pointer-events-none"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold text-foreground text-lg flex items-center gap-2">
                  {item.title || `${item.credits} credits`}
                  {item.badge && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-color-highlight/15 text-color-highlight">
                      {item.badge}
                    </span>
                  )}
                </p>
                <p className="font-semibold text-foreground shrink-0">{item.price}</p>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{item.blurb}</p>
              {loadingSku === item.sku && (
                <Loader2 className="absolute right-4 top-4 w-4 h-4 animate-spin text-color-highlight" />
              )}
            </button>
          ))}
        </div>

        {loadingSku && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Redirecting to secure checkout…
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Payments P8 — set expectations up front. A Radar block (non-US card) surfaces as a generic,
            uncustomizable decline on Stripe's hosted page, so we say the policy here, before checkout. */}
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-1">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Payments are currently US-only.
        </p>
      </DialogContent>
    </Dialog>
  );
}
