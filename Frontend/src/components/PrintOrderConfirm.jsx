import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { formatCents } from "@/lib/formatting";

/**
 * Print pr9 — the return-from-Stripe confirmation for a PRINTED book. Sibling to `UpgradeConfirm`, not an
 * extension of it: that one is digital-shaped (a boolean "did the grant land?"), while a print order has real
 * details to show — order number, copies, total, where it's going.
 *
 * It CONFIRMS, it never fulfils. The paid Lulu job is submitted by the signed Stripe webhook (pr7 commit b);
 * landing here only proves Stripe took the payment. So the status line is deliberately SOFT — 'submitted' reads
 * "sent to the printer", anything earlier reads "we're preparing it now" — and a slow webhook, or even a failed
 * lookup, never turns into an error. The customer paid; telling them something went wrong would be false.
 *
 * Props: `confirm` = { bookId, sessionId } from App's `?print=success` handler (null = closed).
 */

/** D-EST (locked pr9): static range copy, no live Lulu call — MAIL is ~3–5 production + 4–8 shipping days. */
const DELIVERY_COPY = "Printed and shipped within a few days — most books usually arrive in about 2–3 weeks.";

const POLL_MS = 1500;
const POLL_WINDOW_MS = 12000;

export default function PrintOrderConfirm({ confirm, onDismiss }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const bookId = confirm?.bookId;
  const sessionId = confirm?.sessionId;

  // Load the order, then keep polling briefly so a webhook that lands a beat late upgrades the status line
  // from "preparing" to "sent to the printer" without the user refreshing.
  useEffect(() => {
    if (bookId == null || !sessionId) return;
    let cancelled = false;
    setOrder(null);
    setLoading(true);

    async function load() {
      const deadline = Date.now() + POLL_WINDOW_MS;
      while (!cancelled) {
        try {
          const res = await apiRequest(
            `/books/${bookId}/print/order?session_id=${encodeURIComponent(sessionId)}`
          );
          if (cancelled) return;
          setOrder(res);
          setLoading(false);
          if (res?.status === "submitted" || res?.status === "shipped") return; // settled — stop polling
        } catch {
          /* keep polling — the row may not be readable yet, and we never surface this as a failure */
        }
        if (Date.now() >= deadline) break;
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [bookId, sessionId]);

  if (!confirm) return null;

  const settled = order?.status === "submitted" || order?.status === "shipped";
  const shipTo = order && [order.shipName, [order.shipCity, order.shipStateCode].filter(Boolean).join(", ")]
    .filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 text-center shadow-lg">
        {loading && !order ? (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-color-highlight" />
            <p className="mt-3 font-medium text-foreground">Confirming your order…</p>
            <p className="mt-1 text-sm text-muted-foreground">This only takes a moment.</p>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto h-8 w-8 text-color-success" />
            <p className="mt-3 font-medium text-foreground">Your book is on its way!</p>

            {order ? (
              <div className="mt-4 text-left">
                <Row label="Order" value={`#${order.orderId}`} />
                <Row
                  label="Copies"
                  value={`${order.quantity} cop${order.quantity === 1 ? "y" : "ies"}`}
                />
                <Row label="Paid" value={formatCents(order.amountCents, order.currency || "USD")} />
                {shipTo && <Row label="Ship to" value={shipTo} />}
              </div>
            ) : (
              // Lookup never came back — still a confirmation. Payment is proven by being on this screen.
              <p className="mt-1 text-sm text-muted-foreground">
                Your payment went through and we're getting your book ready.
              </p>
            )}

            <p className="mt-4 flex items-start gap-2 rounded-md bg-muted/60 p-3 text-left text-sm text-muted-foreground">
              <Truck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{DELIVERY_COPY}</span>
            </p>

            <p className="mt-2 text-xs text-muted-foreground/85">
              {settled ? "Sent to the printer." : "We're preparing it now."}
            </p>

            <Button onClick={onDismiss} className="mt-4 w-full">Done</Button>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-border py-2 first:border-t-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
