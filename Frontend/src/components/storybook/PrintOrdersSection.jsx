import { useState, useEffect } from "react";
import { Package, Truck, AlertCircle, RotateCcw } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { formatDate, formatCents } from "@/lib/formatting";

/**
 * Print s14c — "Your printed books". A read-only list of orders the user has actually paid for.
 *
 * <p>It exists because the pr9 confirmation is a one-shot overlay that vanishes on dismiss. Once s14a-1 is
 * recording status, a shipped order carries a real tracking link with nowhere to show it, and a `failed` order
 * has no in-app existence at all — its only signal is an email that may never land. "Where's my book?" is the
 * likeliest support email, and this makes it self-serve.
 *
 * Deliberately absent: cancel (s14b), reorder, address editing.
 */

// Our internal statuses are not customer language. `paid` in particular means "we have your money and the
// printer hasn't taken the job yet" — which to a customer is simply "being printed".
const STATUS_COPY = {
  paid:      { label: "Being printed", icon: Package, tone: "text-muted-foreground" },
  submitted: { label: "Being printed", icon: Package, tone: "text-muted-foreground" },
  shipped:   { label: "Shipped",       icon: Truck,   tone: "text-emerald-600" },
  failed:    { label: "There was a problem", icon: AlertCircle, tone: "text-destructive" },
};

export default function PrintOrdersSection() {
  const [orders, setOrders] = useState(null);   // null = still loading / never loaded

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let result = [];
      try {
        const res = await apiRequest("/print-orders");
        if (Array.isArray(res)) result = res;
      } catch {
        // A failed fetch just hides the section. There is nothing actionable to tell the user here, and an
        // error box on the main Storybook screen would be worse than the absence of a list they may not have.
      }
      if (!cancelled) setOrders(result);
    })();
    return () => { cancelled = true; };
  }, []);

  // Hidden entirely until there's something to show — the vast majority of users have never ordered a
  // printed book, and an empty state would be clutter on the main Storybook screen.
  if (!orders || orders.length === 0) return null;

  return (
    <div className="border-t border-border pt-6 mt-2">
      <h3 className="font-display font-semibold text-lg text-foreground text-center">Your printed books</h3>
      <div className="mt-3 space-y-2 max-w-md mx-auto">
        {orders.map(order => <OrderRow key={order.orderId} order={order} />)}
      </div>
    </div>
  );
}

function OrderRow({ order }) {
  const status = STATUS_COPY[order.status] ?? STATUS_COPY.submitted;
  const Icon = order.refunded ? RotateCcw : status.icon;

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {order.bookTitle || "Your memory book"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Order #{order.orderId} · {formatDate(order.createdAt)} ·{" "}
            {order.quantity} cop{order.quantity === 1 ? "y" : "ies"} ·{" "}
            {formatCents(order.amountCents, order.currency)}
          </p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-medium flex-shrink-0 ${order.refunded ? "text-muted-foreground" : status.tone}`}>
          <Icon className="w-3.5 h-3.5" />
          {order.refunded ? "Refunded" : status.label}
        </span>
      </div>

      {/* Shipped → the tracking link this whole section was promoted pre-launch to provide. */}
      {order.status === "shipped" && order.trackingUrl && (
        <a
          href={order.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs font-medium text-color-highlight hover:underline"
        >
          Track package{order.carrierName ? ` (${order.carrierName})` : ""}
        </a>
      )}

      {/* Failed → an apology and a way to reach a human. NEVER the raw Lulu reason — the backend doesn't
          even send it, so there's nothing here to leak. */}
      {order.status === "failed" && !order.refunded && (
        <p className="mt-2 text-xs text-muted-foreground">
          We couldn't finish printing this one, and we're sorting it out — you'll be refunded in full.
          Email <a href="mailto:privacy@cradlehq.app" className="underline">privacy@cradlehq.app</a> with
          order #{order.orderId} if you'd like an update.
        </p>
      )}
      {order.status === "failed" && order.refunded && (
        <p className="mt-2 text-xs text-muted-foreground">
          We couldn't finish printing this one, so we've refunded it in full. Refunds usually take 5–10
          business days to appear.
        </p>
      )}
    </div>
  );
}
