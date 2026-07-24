import { useState } from "react";
import { Loader2, CheckCircle2, Clock, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

/**
 * Payments P7 / Share s13e-1 — the return-from-Stripe confirmation overlay. It CONFIRMS a purchase; it never
 * grants one (the webhook is the sole grant path). App.jsx polls for the webhook's signal and drives `status`,
 * an object `{ phase, kind, bookId }`:
 *   phase 'confirming' — polling, no signal yet
 *   phase 'done'       — grant landed (credits grew, or the book unlocked)
 *   phase 'slow'       — webhook is a beat behind; "on its way", never a false failure
 *   kind  'credits' | 'share' | 'bundle' — which copy to show; share/bundle offer a "Copy your link" button.
 */
export default function UpgradeConfirm({ status, credits, onDismiss }) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);

  if (!status) return null;
  const { phase, kind, bookId } = status;
  const isShare = kind === "share" || kind === "bundle";

  // Mint (or fetch) this book's share link and copy it — the "show the link immediately" decision (s13e-1).
  async function copyLink() {
    if (copying || bookId == null) return;
    setCopying(true);
    try {
      const res = await apiRequest(`/books/${bookId}/share`, { method: "POST" });
      if (res?.shareUrl) {
        await navigator.clipboard.writeText(res.shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* ignore — the StorybookTab share section is the durable place to copy from */
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 text-center shadow-lg">
        {phase === "confirming" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-color-highlight" />
            <p className="mt-3 font-medium text-foreground">Confirming your purchase…</p>
            <p className="mt-1 text-sm text-muted-foreground">This only takes a moment.</p>
          </>
        )}

        {phase === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-8 w-8 text-color-success" />
            <p className="mt-3 font-medium text-foreground">You’re all set</p>
            {isShare ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  {kind === "bundle"
                    ? "Your credits are ready and this book is unlocked for sharing."
                    : "This book is unlocked for sharing."}
                </p>
                <Button onClick={copyLink} disabled={copying} className="mt-4 w-full gap-2">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Link copied!" : "Copy your link"}
                </Button>
                <Button variant="outline" onClick={onDismiss} className="mt-2 w-full">Done</Button>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted-foreground">{credits} credits are ready to use.</p>
                <Button onClick={onDismiss} className="mt-4 w-full">Done</Button>
              </>
            )}
          </>
        )}

        {phase === "slow" && (
          <>
            <Clock className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium text-foreground">Your purchase is on its way</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isShare
                ? "Your share link will be ready shortly — no need to pay again."
                : "Your credits will appear here shortly — no need to pay again."}
            </p>
            <Button variant="outline" onClick={onDismiss} className="mt-4 w-full">Close</Button>
          </>
        )}
      </div>
    </div>
  );
}
