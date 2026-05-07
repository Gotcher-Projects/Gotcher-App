import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PaidGate({ tier, children, feature = "this feature" }) {
  if (tier !== 'free') return children;

  return (
    <div className="flex justify-center py-8">
      <Card className="p-8 max-w-sm w-full text-center space-y-4">
        <div className="space-y-1">
          <h3 className="font-display font-semibold text-lg">Unlock {feature}</h3>
          <p className="text-muted-foreground text-sm">
            Upgrade to Plus for $5/month to generate your baby's storybook chapters and preserve every milestone as a memory.
          </p>
        </div>
        <Button className="w-full" disabled>
          Upgrade to Plus — Coming Soon
        </Button>
      </Card>
    </div>
  );
}
