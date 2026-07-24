import { useState, useEffect, useCallback } from "react";
import { Share2, Copy, Check, RefreshCw, Trash2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { usePurchase } from "@/contexts/PurchaseContext";
import { SHARE_SKUS } from "@/components/PurchaseModal";

/**
 * Share s13c — the in-app share surface at the bottom of the Storybook tab. State follows the ACTIVE
 * book's unlock (`shareUnlocked`, from the /books DTO):
 *  - not unlocked → an upsell that opens the purchase modal scoped to THIS book (both SKUs). Rendered
 *    only when `openPurchase` is defined, so it's absent on native (Payments P9 gate).
 *  - unlocked → copy / generate-new / revoke, wired to the s13a token endpoints. These aren't purchase
 *    UI, so they remain available on native for an already-unlocked book.
 *
 * Regenerating a link never re-charges — the entitlement is `books.share_unlocked_at`, which the token
 * lifecycle never touches (s13a).
 *
 * s13e-3: the unlocked state also carries a "Mark as finished" toggle — an unfinished book shows a
 * work-in-progress gate/badge on the public link (visibility itself is content-based, decided server-side).
 */
export default function ShareSection({ bookId, shareUnlocked, finished, pagesAdded = 0, onFinishedChange, onError }) {
  const { openPurchase } = usePurchase();
  const [shareUrl, setShareUrl] = useState(null);
  const [loading, setLoading] = useState(false); // initial token fetch
  const [busy, setBusy] = useState(false);        // mint / regenerate / revoke in flight
  const [copied, setCopied] = useState(false);
  const [savingFinished, setSavingFinished] = useState(false);

  async function toggleFinished() {
    if (savingFinished) return;
    const next = !finished;
    setSavingFinished(true);
    onFinishedChange?.(next);   // optimistic
    try {
      await apiRequest(`/books/${bookId}`, { method: "PATCH", body: JSON.stringify({ finished: next }) });
    } catch {
      onFinishedChange?.(!next); // revert
      onError?.("Couldn't update — please try again");
    } finally {
      setSavingFinished(false);
    }
  }

  // Load the existing token when this book is unlocked. Re-runs on book switch so the URL always
  // matches the active book (never a stale token from the previously-viewed one).
  useEffect(() => {
    setShareUrl(null);
    setCopied(false);
    if (!shareUnlocked || bookId == null) return;
    let cancelled = false;
    setLoading(true);
    apiRequest(`/books/${bookId}/share`)
      .then(res => { if (!cancelled) setShareUrl(res?.shareUrl ?? null); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bookId, shareUnlocked]);

  const mint = useCallback(async (regenerate) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await apiRequest(`/books/${bookId}/share`, { method: "POST" });
      setShareUrl(res?.shareUrl ?? null);
      setCopied(false);
    } catch {
      onError?.(regenerate ? "Couldn't generate a new link" : "Couldn't create the link");
    } finally {
      setBusy(false);
    }
  }, [bookId, busy, onError]);

  async function revoke() {
    if (busy) return;
    setBusy(true);
    try {
      await apiRequest(`/books/${bookId}/share`, { method: "DELETE" });
      setShareUrl(null);
      setCopied(false);
    } catch {
      onError?.("Couldn't revoke the link");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError?.("Couldn't copy — long-press the link to copy it manually");
    }
  }

  // ── Not unlocked → upsell (hidden entirely on native, where openPurchase is undefined) ──────────
  if (!shareUnlocked) {
    if (!openPurchase) return null;
    return (
      <Shell>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Anyone with the link can read this book — no app, no login. One-time, this book only.
        </p>
        <Button
          className="mt-3 bg-color-highlight hover:bg-color-highlight/90 gap-2"
          onClick={() => openPurchase({
            skus: SHARE_SKUS,
            bookId,
            heading: "Share this book",
            subheading: "Anyone with the link can read it — no app, no login. One-time, this book only.",
          })}
        >
          <Share2 className="w-4 h-4" />
          Share this book
        </Button>
      </Shell>
    );
  }

  // ── Unlocked → manage ───────────────────────────────────────────────────────────────────────
  return (
    <Shell>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Anyone with this link can read your book. They don't need an account.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground mt-3">Loading…</p>
      ) : !shareUrl ? (
        <Button className="mt-3 gap-2" onClick={() => mint(false)} disabled={busy}>
          <LinkIcon className="w-4 h-4" />
          Create share link
        </Button>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" className="gap-1.5" onClick={copy}>
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy link"}
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={() => mint(true)} disabled={busy}>
              <RefreshCw className="w-4 h-4" />
              Generate new link
            </Button>
          </div>
          <button
            onClick={revoke}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Revoke access
          </button>
        </>
      )}

      {/* Mark as finished (s13e-3) — controls the visitor work-in-progress note, not which pages show. */}
      <div className="mt-5 flex items-center gap-4 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-left">
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Mark as finished</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {finished
              ? "Visitors see your book as complete."
              : "Visitors see a “work in progress” note until you switch this on."}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1.5">📖 {pagesAdded} page{pagesAdded === 1 ? "" : "s"} added</p>
        </div>
        <button
          role="switch"
          aria-checked={!!finished}
          onClick={toggleFinished}
          disabled={savingFinished}
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${finished ? "bg-emerald-600" : "bg-muted-foreground/40"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${finished ? "translate-x-5" : ""}`} />
        </button>
      </div>
    </Shell>
  );
}

// Shared framing: a divider + centered "Share your baby's story" section header.
function Shell({ children }) {
  return (
    <div className="border-t border-border pt-6 mt-2 text-center">
      <h3 className="font-display font-semibold text-lg text-foreground">Share your baby's story</h3>
      <div className="mt-1">{children}</div>
    </div>
  );
}
