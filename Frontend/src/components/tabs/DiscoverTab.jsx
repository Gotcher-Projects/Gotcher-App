import React, { useState } from "react";
import PillNav from "@/components/ui/PillNav";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Baby, ShoppingBag, Users } from "lucide-react";

export default function DiscoverTab({ activities, week, months, birthdate, babyName }) {
  const [view, setView] = useState('marketplace');

  return (
    <>
      <PillNav
        options={[
          { value: 'marketplace', label: 'Marketplace' },
          { value: 'playdates',   label: 'Playdates' },
          { value: 'activities',  label: 'Activities' },
        ]}
        active={view}
        onChange={setView}
      />
      {view === 'marketplace' && <MarketplaceTab />}
      {view === 'playdates'   && <PlaydatesTab />}
      {view === 'activities'  && (
        <ActivitiesTab
          activities={activities}
          week={week}
          months={months}
          birthdate={birthdate}
          babyName={babyName}
        />
      )}
    </>
  );
}

function MarketplaceTab() {
  return (
    <Card className="shadow-xl rounded-2xl">
      <CardContent className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <ShoppingBag className="w-12 h-12 text-primary/30" />
        <h3 className="font-display font-semibold text-xl text-foreground">Marketplace — Coming Soon</h3>
        <p className="text-muted-foreground max-w-xs text-sm">
          Buy and sell baby items with other parents in your community. This feature is in the works!
        </p>
      </CardContent>
    </Card>
  );
}

function PlaydatesTab() {
  return (
    <Card className="shadow-xl rounded-2xl">
      <CardContent className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <Users className="w-12 h-12 text-primary/30" />
        <h3 className="font-display font-semibold text-xl text-foreground">Playdates — Coming Soon</h3>
        <p className="text-muted-foreground max-w-xs text-sm">
          Find other families nearby to schedule playdates. This feature is in the works!
        </p>
      </CardContent>
    </Card>
  );
}

function ActivitiesTab({ activities, week, months, birthdate, babyName }) {
  if (!birthdate) {
    return (
      <Card className="shadow-xl rounded-2xl">
        <CardContent className="p-8 text-center">
          <Baby className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="font-display text-xl font-bold text-foreground mb-2">Set Baby's Birthdate First</h3>
          <p className="text-muted-foreground">Go to the Dashboard tab and enter a birthdate to see age-appropriate activities and product recommendations!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl rounded-2xl">
        <CardContent className="p-6">
          <h2 className="font-display text-xl font-bold mb-2">Activities for {babyName || "Baby"}</h2>
          <p className="text-muted-foreground mb-4">Age: {months} months ({week} weeks)</p>

          {!activities.length ? (
            <EmptyState label="Loading activities..." />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {activities.map((a, i) => (
                <div key={i} className="p-5 rounded-xl bg-gradient-to-br from-brand-lavender/40 to-color-success/10 border border-brand-purple/20">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">{i + 1}</span>
                    </div>
                    <p className="text-foreground">{a}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-xl rounded-2xl">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <ShoppingBag className="w-10 h-10 text-primary/30" />
          <h3 className="font-display font-semibold text-lg text-foreground">Recommended Products — Coming Soon</h3>
          <p className="text-muted-foreground max-w-xs text-sm">
            Curated product picks for your baby's age and stage. This feature is in the works!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
