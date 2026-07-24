import { Sparkles, Plus } from "lucide-react";
import { useAiCredits } from "@/contexts/AiCreditsContext";
import { usePurchase } from "@/contexts/PurchaseContext";

/**
 * Payments P10 — the persistent header credit balance, which doubles as the proactive "buy credits"
 * entry point (the credits "Shop"). Design B+C: a soft tinted pill (B) with a `+` add badge (C); clicking
 * anywhere on the pill opens the P6 PurchaseModal via `openPurchase` (PurchaseContext). Always clickable, not only at zero.
 *
 * Bare count only — "12 credits", NOT "12 / 20" and NOT "resets on…". Credits are purchased and don't
 * expire, so allotment/reset framing would misrepresent the product.
 *
 * Web only. On native `openPurchase` is undefined (the P9 gate), so the pill degrades to a plain,
 * non-clickable count — informational, no `+`, no buy affordance — keeping the native app free of any
 * purchase call-to-action.
 */
export default function CreditsPill({ className = "" }) {
  const { credits } = useAiCredits();
  const { openPurchase } = usePurchase();  // no args → the modal defaults to the credit packs
  const zero = credits <= 0;
  const label = credits === 1 ? "credit" : "credits";

  // Native / no buy path: informational chip only.
  if (!openPurchase) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
          zero
            ? "border-brand-pink/30 bg-brand-pink/10 text-brand-pink"
            : "border-brand-purple/25 bg-brand-purple/10 text-brand-purple"
        } ${className}`}
        title={zero ? "Out of AI credits" : `${credits} AI credits remaining`}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="font-extrabold tabular-nums">{credits}</span> {label}
      </span>
    );
  }

  const tone = zero
    ? "border-brand-pink/30 bg-brand-pink/10 text-brand-pink hover:bg-brand-pink/20"
    : "border-brand-purple/25 bg-brand-purple/10 text-brand-purple hover:bg-brand-purple/20";
  const plusTone = zero
    ? "bg-brand-pink/15 group-hover:bg-brand-pink group-hover:text-white"
    : "bg-brand-purple/15 group-hover:bg-brand-purple group-hover:text-white";

  return (
    <button
      type="button"
      onClick={() => openPurchase()}
      title={zero ? "Out of AI credits · click to buy more" : `${credits} AI credits remaining · click to buy more`}
      className={`group inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 text-xs font-semibold transition-all hover:-translate-y-px ${tone} ${className}`}
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span className="font-extrabold tabular-nums">{credits}</span> {label}
      <span
        className={`ml-0.5 grid h-[19px] w-[19px] place-items-center rounded-full transition-colors ${plusTone}`}
        aria-hidden="true"
      >
        <Plus className="h-3 w-3" />
      </span>
    </button>
  );
}
