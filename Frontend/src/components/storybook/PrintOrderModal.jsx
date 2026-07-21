import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, Loader2, Info, Minus, Plus, PencilLine, AlertTriangle, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/api";

/**
 * Print pr8 — the "Order a printed book" flow. Wraps pr5.5/pr6/pr7's endpoints:
 *   1. on open, GET /orderability (the single source of truth for the gate)
 *   2. if orderable, GET /price?quantity=N for the flat, all-in total (MAIL shipping baked in)
 *   3. "Continue to payment" → POST /checkout?quantity=N, which renders the PDFs + creates the pending
 *      print_orders row + opens Stripe. We show a "preparing your book…" state while that runs, then
 *      hand the browser to the returned Stripe hosted page.
 *
 * The gate has FOUR reasons (from PrintInteriorService.Reason): OK, FILL_MORE (guided book under the
 * 32-page floor — can't add pages, must fill prompts), ADD_MORE (freeform under 32 — add pages), and
 * OVER_MAX (freeform over 50). Non-OK reasons render a blocking state instead of the order button.
 *
 * Unlike PurchaseModal this does NOT use the openPurchase seam: print is a physical good and ships on
 * native, so it must not be gated off the App Store build. The entry point is gated on the print kill
 * switch (usePrintEnabled) instead; the real money guards are pr7's checkout + pr5's Lulu client.
 */
const MAX_QUANTITY = 10; // pr7's server-side cap on the variable-amount charge

function formatCents(cents, currency = "USD") {
  if (cents == null) return "";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency });
}

export default function PrintOrderModal({ open, onClose, bookId }) {
  const [gate, setGate] = useState(null);       // Orderability payload, or null until loaded
  const [loadingGate, setLoadingGate] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(null);     // { unitPriceCents, totalCents, currency, ... }
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [placing, setPlacing] = useState(false); // checkout (render + Stripe) in flight
  const [error, setError] = useState(null);

  // Fetch the gate each time the modal opens for a book. Reset everything first so a book switch or
  // reopen never shows stale numbers.
  useEffect(() => {
    if (!open || bookId == null) return;
    let cancelled = false;
    setGate(null); setPrice(null); setQuantity(1); setError(null); setPlacing(false);
    setLoadingGate(true);
    apiRequest(`/books/${bookId}/print/orderability`)
      .then((res) => { if (!cancelled) setGate(res); })
      .catch(() => { if (!cancelled) setError("Couldn't check this book — please try again."); })
      .finally(() => { if (!cancelled) setLoadingGate(false); });
    return () => { cancelled = true; };
  }, [open, bookId]);

  // Fetch the flat price whenever the book is orderable and the quantity changes. The server recomputes
  // at checkout regardless (amount integrity), so this is display only.
  useEffect(() => {
    if (!open || bookId == null || !gate?.orderable) return;
    let cancelled = false;
    setLoadingPrice(true);
    apiRequest(`/books/${bookId}/print/price?quantity=${quantity}`)
      .then((res) => { if (!cancelled) setPrice(res); })
      .catch(() => { if (!cancelled) setError("Couldn't get a price — please try again."); })
      .finally(() => { if (!cancelled) setLoadingPrice(false); });
    return () => { cancelled = true; };
  }, [open, bookId, gate?.orderable, quantity]);

  async function placeOrder() {
    if (placing) return;
    setError(null);
    setPlacing(true);
    try {
      const data = await apiRequest(`/books/${bookId}/print/checkout?quantity=${quantity}`, { method: "POST" });
      if (!data?.url) throw new Error("No checkout URL returned");
      window.location.href = data.url; // full-page hand-off to Stripe's hosted page
    } catch (e) {
      setError("Couldn't start your order — please try again.");
      setPlacing(false);
    }
  }

  function handleOpenChange(next) {
    if (!next && !placing) onClose?.(); // don't let a click-out abandon an in-flight checkout
  }

  const currency = price?.currency || "USD";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {placing ? (
          // ── Preparing (pre-checkout render) ─────────────────────────────────
          <div className="text-center py-6">
            <Loader2 className="w-8 h-8 animate-spin text-color-highlight mx-auto mb-4" />
            <p className="font-semibold text-foreground">Preparing your book…</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
              We're building your print-ready file — this takes a few seconds. You'll jump to secure
              checkout automatically. Please don't close this window.
            </p>
          </div>
        ) : loadingGate ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Checking your book…
          </div>
        ) : gate && !gate.orderable ? (
          <GateState gate={gate} />
        ) : (
          // ── Orderable ───────────────────────────────────────────────────────
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-color-highlight" />
                Order a printed book
              </DialogTitle>
              <p className="text-sm text-muted-foreground">A keepsake copy, printed and mailed to you.</p>
            </DialogHeader>

            <div className="pt-1">
              {gate && (
                <Row label="Book length" value={`${gate.pageCount} pages`} />
              )}
              <div className="flex items-center justify-between py-2.5 border-t border-border">
                <span className="text-sm text-muted-foreground">Copies</span>
                <QuantityPicker value={quantity} onChange={setQuantity} disabled={loadingPrice} />
              </div>
              <Row label="Per copy" value={price ? formatCents(price.unitPriceCents, currency) : "—"} />

              <div className="flex items-baseline justify-between mt-3 pt-3 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  Total <span className="text-muted-foreground/70">· shipping included</span>
                </span>
                <span className="text-2xl font-semibold text-foreground tabular-nums">
                  {loadingPrice || !price ? (
                    <Loader2 className="w-4 h-4 animate-spin inline text-muted-foreground" />
                  ) : (
                    formatCents(price.totalCents, currency)
                  )}
                </span>
              </div>
            </div>

            <button
              onClick={placeOrder}
              disabled={loadingPrice || !price}
              className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-color-highlight text-white font-semibold hover:bg-color-highlight/90 transition-colors disabled:opacity-60 disabled:pointer-events-none"
            >
              Continue to payment
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-1">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Secure checkout on Stripe · US shipping only
            </p>
          </>
        )}

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-t border-border first:border-t-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function QuantityPicker({ value, onChange, disabled }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        aria-label="Fewer copies"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={disabled || value <= 1}
        className="w-8 h-8 grid place-items-center text-muted-foreground hover:bg-muted disabled:opacity-40"
      >
        <Minus className="w-4 h-4" />
      </button>
      <span className="min-w-9 h-8 grid place-items-center font-semibold tabular-nums border-x border-border">
        {value}
      </span>
      <button
        type="button"
        aria-label="More copies"
        onClick={() => onChange(Math.min(MAX_QUANTITY, value + 1))}
        disabled={disabled || value >= MAX_QUANTITY}
        className="w-8 h-8 grid place-items-center text-muted-foreground hover:bg-muted disabled:opacity-40"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

// The blocking states — one per non-OK gate reason. Copy differs because guided books can't add pages
// (they fill prompts), freeform books add pages, and an over-length book must remove them.
function GateState({ gate }) {
  const { reason, pageCount, min, max, shortBy, overBy } = gate;

  let Icon = PencilLine, title, message;
  if (reason === "OVER_MAX") {
    Icon = AlertTriangle;
    title = "This book is a bit too long";
    message = (
      <>Printed books can hold up to <b>{max} pages</b>; yours has <b>{pageCount}</b>. Remove{" "}
        <b>{overBy} page{overBy === 1 ? "" : "s"}</b> in the editor to order a printed copy.</>
    );
  } else if (reason === "FILL_MORE") {
    Icon = PencilLine;
    title = "A few more pages to go";
    message = (
      <>Your guided book has <b>{pageCount} of the {min} pages</b> a printed copy needs. Fill in{" "}
        <b>{shortBy} more</b> — keep answering the prompts — then come back to order.</>
    );
  } else {
    // ADD_MORE (freeform under the floor), and a safe default.
    Icon = Plus;
    title = "Not enough pages yet";
    message = (
      <>Your book has <b>{pageCount} page{pageCount === 1 ? "" : "s"}</b>. Printed books need at least{" "}
        <b>{min}</b> — add <b>{shortBy} more</b> in the editor, then come back to order.</>
    );
  }

  const pct = reason === "OVER_MAX" ? 100 : Math.min(100, Math.round((pageCount / min) * 100));

  return (
    <div>
      <DialogHeader>
        <div className="w-11 h-11 rounded-xl grid place-items-center bg-color-warm/50 text-amber-600 mb-1">
          <Icon className="w-5 h-5" />
        </div>
        <DialogTitle className="text-lg">{title}</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
      <div className="h-1.5 rounded-full bg-muted border border-border overflow-hidden mt-4">
        <span className="block h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground/85 mt-1.5 tabular-nums">
        {reason === "OVER_MAX"
          ? `${pageCount} / ${max} page maximum`
          : `${pageCount} / ${min} pages minimum`}
      </p>
    </div>
  );
}
