import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadingButton({ loading, loadingText = "Saving...", children, ...props }) {
  return (
    <Button disabled={loading} {...props}>
      {loading
        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{loadingText}</>
        : children}
    </Button>
  );
}
