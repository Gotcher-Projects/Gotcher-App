import { useState } from "react";
import { Sparkles, Loader2, RotateCcw } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAiCredits } from "@/contexts/AiCreditsContext";
import { usePurchase } from "@/contexts/PurchaseContext";

// Reshape chips (idea B): re-run a draft biased shorter / warmer / more detailed. The keys are
// server-whitelisted in AiAssistService — the client can't inject a free-form instruction.
const RESHAPES = [
  ["shorter", "Shorter"],
  ["warmer", "Warmer"],
  ["more_detail", "More detail"],
];

// Fields that need real material to draft (the letter) require at least this much seed text before ✨
// is allowed — an empty long-form draft only makes the model refuse. Tunable.
const MIN_SEED_CHARS = 12;

/**
 * The ONLY AI surface in v2: a per-field "✨ write this for me" helper. It words ONE text field the
 * user already has — it never makes pages or book structure. Gated purely on the credit balance
 * (1 credit per generate / reshape), NOT subscription tier — see useAiCredits.
 *
 * Blended write-or-generate UX (sv2-s10b):
 *  - Adaptive: empty field → "Write this for me"; once there's text → recedes to a quiet "Polish this".
 *  - Option A "review before apply": the draft appears in a review box (with your-note-vs-reworded
 *    compare when polishing) and NEVER overwrites the field until the user hits "Use & edit".
 *  - Reshape chips let the user steer the draft; nothing is persisted here (the field's own save path
 *    stores the accepted text).
 *
 * Rich-text-agnostic: the caller passes plain `context.seedText` (the field's current text) and applies
 * the returned plain string via `onResult`, so this works on plain textareas and, via `variant="toolbar"`,
 * inside the book builder's Tiptap format toolbar (the caller's onResult converts the string to a doc).
 *
 * Props:
 *   promptType – 'letter' | 'birth_note' | 'bio' | 'first_note' | 'bump_note' | 'journal' (server owns the prompt)
 *   context    – structured values woven into the server prompt (babyName, parentName, role, label,
 *                title, seedText…). `seedText` = the field's current text; its presence drives the
 *                adaptive label / compare view. Never a raw prompt.
 *   onResult   – (text) => void, called with the accepted draft
 *   variant    – 'inline' (default, under a textarea) | 'toolbar' (a compact button for FormatToolbar)
 *   requireSeed– if true, ✨ is disabled until the field has ≥ MIN_SEED_CHARS of text (the letter, which
 *                can't be drafted well from an empty body)
 *   label      – empty-state button text (default "Write this for me"; inline only)
 */
export default function AiAssistField({ promptType, context = {}, onResult, label = "Write this for me", variant = "inline", requireSeed = false, className = "" }) {
  const { credits, setCredits } = useAiCredits();
  const { openPurchase } = usePurchase();  // no args → the modal defaults to the credit packs
  const [status, setStatus] = useState("idle"); // 'idle' | 'loading' | 'review'
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(null);

  const seed = (context.seedText || "").trim();
  const hasText = seed.length > 0;
  const seedOk = !requireSeed || seed.length >= MIN_SEED_CHARS;
  const hasCredits = credits > 0;
  const loading = status === "loading";

  async function generate(reshape) {
    if (loading) return;
    if (!seedOk) return; // guarded UI-side too; nothing to draft from
    if (!hasCredits) { openPurchase?.(); return; }
    setError(null);
    setStatus("loading");
    try {
      const payload = { promptType, context: reshape ? { ...context, reshape } : context };
      const res = await apiRequest("/storybook/assist-field", { method: "POST", body: JSON.stringify(payload) });
      setDraft(res?.text || "");
      setStatus("review");
      setCredits(credits - 1); // each generate/reshape charges one credit server-side
    } catch (e) {
      // 402 = a concurrent spend drained the balance → route to the buy-credits flow.
      // 422 = the model returned nothing usable (empty / refusal); the credit was refunded server-side
      //       and the message is user-facing, so show it (nothing to accept).
      if (e?.status === 402) openPurchase?.();
      else if (e?.status === 422) setError(e.message || "Couldn't draft that — try adding a note first.");
      else setError("Couldn't write that — please try again.");
      setStatus("idle");
    }
  }

  function accept() { onResult?.(draft); reset(); }
  function reset() { setStatus("idle"); setDraft(""); }

  // The review box (Option A: nothing is applied until "Use & edit"). Shared by both variants.
  const reviewBox = (
    <div className="rounded-lg border border-dashed border-brand-purple/50 bg-brand-purple/5 p-3">
      {hasText && (
        <div className="mb-2">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Your note</div>
          <div className="rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">{seed}</div>
        </div>
      )}
      <div className="mb-2">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand-purple">✨ {hasText ? "Reworded" : "Suggested draft"}</div>
        <div className="rounded-md border border-brand-purple/40 bg-background px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">{draft}</div>
      </div>
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {RESHAPES.map(([key, text]) => (
          <button
            key={key}
            type="button"
            onClick={() => generate(key)}
            className="inline-flex items-center gap-1 rounded-full border border-brand-purple/35 bg-background px-2.5 py-1 text-[11.5px] font-semibold text-brand-purple hover:bg-brand-purple/10"
          >
            <RotateCcw className="h-3 w-3 opacity-60" /> {text}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={accept} className="rounded-md bg-brand-purple px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-purple/90">
          Use &amp; edit
        </button>
        <button type="button" onClick={reset} className="px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
          Discard
        </button>
        <span className="ml-auto text-[11px] text-muted-foreground">1 credit · {credits} left</span>
      </div>
      {error && <div className="mt-1.5 text-[11px] text-red-500">{error}</div>}
    </div>
  );

  // ── Toolbar variant: a compact button for the Tiptap FormatToolbar; review box floats below ──
  if (variant === "toolbar") {
    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => generate()}
          disabled={loading || !hasCredits || !seedOk}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-purple/10 px-2.5 text-xs font-semibold text-brand-purple transition-colors hover:bg-brand-purple/20 disabled:opacity-50"
          title={!seedOk ? "Jot a line or two first, then ✨ can help" : hasCredits ? "Draft with AI (1 credit)" : "You're out of AI credits"}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? "Writing…" : hasText ? "Polish" : "Write"}
        </button>
        {status === "review" && (
          <div className="absolute left-1/2 top-full z-50 mt-2 w-[min(420px,80vw)] -translate-x-1/2 rounded-lg border border-border bg-card shadow-xl">
            {reviewBox}
          </div>
        )}
        {error && status !== "review" && (
          <div className="absolute left-0 top-full mt-1 whitespace-nowrap text-[11px] text-red-500">{error}</div>
        )}
      </div>
    );
  }

  // ── Inline variant (under a textarea) ──
  if (status === "review") {
    return <div className={`mt-2 ${className}`}>{reviewBox}</div>;
  }

  // Out of credits. On web (openPurchase defined) this is a buy CTA. On native it's undefined (Payments P9
  // gate in App.jsx) → render a plain, non-clickable indicator with NO button and NO "get more"/buy-on-web
  // steering, so the native app carries no purchase call-to-action (App Store 3.1.3(f) exemption).
  if (!hasCredits) {
    if (!openPurchase) {
      return (
        <div className={`mt-2 flex flex-wrap items-center gap-2 ${className}`}>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
            title="You're out of AI credits"
          >
            <Sparkles className="h-3.5 w-3.5" /> Out of AI credits
          </span>
        </div>
      );
    }
    return (
      <div className={`mt-2 flex flex-wrap items-center gap-2 ${className}`}>
        <button
          type="button"
          onClick={() => openPurchase()}
          className="inline-flex items-center gap-1.5 rounded-full border border-pink-300 bg-pink-50 px-3 py-1 text-xs font-medium text-pink-700"
          title="You're out of AI credits"
        >
          <Sparkles className="h-3.5 w-3.5" /> Out of credits
        </button>
        <span className="text-[11px] text-muted-foreground">Get more credits to use AI</span>
      </div>
    );
  }

  // Idle, with text: recede to a quiet "polish this" link so it never nags (idea C).
  if (hasText) {
    return (
      <div className={`mt-1.5 ${className}`}>
        <button
          type="button"
          onClick={() => generate()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-brand-purple disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? "Writing…" : "Polish this"}
        </button>
        {error && <span className="ml-2 text-[11px] text-red-500">{error}</span>}
      </div>
    );
  }

  // Idle, empty: full invitation + "write your own, or let AI help" hint.
  return (
    <div className={`mt-2 flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => generate()}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand-purple/40 bg-brand-purple/5 px-3 py-1 text-xs font-medium text-brand-purple transition hover:bg-brand-purple/10 disabled:opacity-60"
        title="Draft this with AI (1 credit)"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {loading ? "Writing…" : label}
      </button>
      <span className="text-[11px] text-muted-foreground">Write your own, or ✨ let AI help · {credits} left</span>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </div>
  );
}
