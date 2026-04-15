import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Trash2,
  Plus,
  Car,
  Wrench,
  ShieldCheck,
  BadgeDollarSign,
  PiggyBank,
  ClipboardList,
} from "lucide-react";

const uid = () => Math.random().toString(36).slice(2, 10);

function currency(n) {
  const v = Number.isFinite(Number(n)) ? Number(n) : 0;
  return v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function numberOr0(v) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

const demoVehicles = [
  {
    id: uid(),
    name: "Family SUV",
    year: 2021,
    make: "Chevrolet",
    model: "Tahoe",
    trim: "LT",
    driver: "Windy",
    mileage: 48200,
    marketValue: 46300,
    loanBalance: 29800,
    interestRate: 6.9,
    monthlyPayment: 690,
    insuranceMonthly: 210,
    warrantyExpDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 95).toISOString().slice(0, 10),
    registrationExpDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 140).toISOString().slice(0, 10),
  },
  {
    id: uid(),
    name: "Work Truck",
    year: 2020,
    make: "Ford",
    model: "F-150",
    trim: "XLT",
    driver: "Kevin",
    mileage: 58200,
    marketValue: 31400,
    loanBalance: 24200,
    interestRate: 7.4,
    monthlyPayment: 620,
    insuranceMonthly: 187,
    warrantyExpDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 280).toISOString().slice(0, 10),
    registrationExpDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 40).toISOString().slice(0, 10),
  },
  {
    id: uid(),
    name: "Fun Car",
    year: 1965,
    make: "Ford",
    model: "Mustang",
    trim: "Fastback",
    driver: "Kevin",
    mileage: 99999,
    marketValue: 68000,
    loanBalance: 0,
    interestRate: 0,
    monthlyPayment: 0,
    insuranceMonthly: 58,
    warrantyExpDate: "",
    registrationExpDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 220).toISOString().slice(0, 10),
    notes: "Classic — values shown are estimates.",
  },
];

const demoMaintenance = [
  {
    id: uid(),
    vehicleId: "",
    title: "Oil change",
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20).toISOString().slice(0, 10),
    estCost: 89,
    priority: "Low",
    shop: "Local quick lube",
  },
  {
    id: uid(),
    vehicleId: "",
    title: "Brake inspection",
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString().slice(0, 10),
    estCost: 150,
    priority: "Medium",
    notes: "Slight vibration under braking.",
  },
];

function StatCard({ title, value, hint, icon }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">{title}</div>
            <div className="text-2xl font-semibold mt-1">{value}</div>
            {hint ? <div className="text-xs text-muted-foreground mt-1">{hint}</div> : null}
          </div>
          <div className="mt-1 text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Pill({ children }) {
  return <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">{children}</span>;
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function VehicleBadges({ v }) {
  const w = daysUntil(v.warrantyExpDate);
  const r = daysUntil(v.registrationExpDate);
  const equity = numberOr0(v.marketValue) - numberOr0(v.loanBalance);

  const badges = [];
  if (w !== null) {
    if (w <= 120) badges.push(<Badge key="w" variant="destructive" className="rounded-full">Warranty expiring</Badge>);
    else badges.push(<Badge key="w" variant="secondary" className="rounded-full">Warranty OK</Badge>);
  }
  if (r !== null) {
    if (r <= 45) badges.push(<Badge key="r" variant="destructive" className="rounded-full">Registration due</Badge>);
    else if (r <= 90) badges.push(<Badge key="r" variant="secondary" className="rounded-full">Registration soon</Badge>);
  }
  if (equity > 5000) badges.push(<Badge key="e" className="rounded-full">Strong equity</Badge>);
  if (equity < 0) badges.push(<Badge key="ne" variant="destructive" className="rounded-full">Negative equity</Badge>);

  if (!badges.length) return null;
  return <div className="flex flex-wrap gap-2">{badges}</div>;
}

export default function HomeFleetMVP() {
  const [vehicles, setVehicles] = useState(() => demoVehicles);

  const [maintenance, setMaintenance] = useState(() => {
    const v0 = demoVehicles[0]?.id;
    const v1 = demoVehicles[1]?.id;
    const items = [...demoMaintenance];
    if (items[0]) items[0] = { ...items[0], vehicleId: v0 };
    if (items[1]) items[1] = { ...items[1], vehicleId: v1 };
    return items;
  });

  const [events, setEvents] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(() => demoVehicles[0]?.id ?? "");
  const [simpleMode, setSimpleMode] = useState(true);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0],
    [vehicles, selectedVehicleId]
  );

  const totals = useMemo(() => {
    const totalValue = vehicles.reduce((s, v) => s + numberOr0(v.marketValue), 0);
    const totalDebt = vehicles.reduce((s, v) => s + numberOr0(v.loanBalance), 0);
    const totalEquity = totalValue - totalDebt;
    const ins = vehicles.reduce((s, v) => s + numberOr0(v.insuranceMonthly), 0);
    const pmt = vehicles.reduce((s, v) => s + numberOr0(v.monthlyPayment), 0);
    return { totalValue, totalDebt, totalEquity, monthlyAutoSpend: ins + pmt };
  }, [vehicles]);

  const upcomingMaintenance = useMemo(() => {
    const now = new Date();
    const horizon = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);
    return maintenance
      .filter((m) => {
        if (!m.dueDate) return false;
        const d = new Date(m.dueDate);
        return d >= new Date(now.toISOString().slice(0, 10)) && d <= horizon;
      })
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  }, [maintenance]);

  const handleLog = (vehicleId, action) => {
    setEvents((prev) => [{ id: uid(), ts: new Date().toISOString(), vehicleId, action }, ...prev]);
  };

  const addVehicle = (v) => {
    const nv = { ...v, id: uid() };
    setVehicles((prev) => [nv, ...prev]);
    setSelectedVehicleId(nv.id);
  };

  const updateVehicle = (id, patch) => {
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };

  const deleteVehicle = (id) => {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    setMaintenance((prev) => prev.filter((m) => m.vehicleId !== id));
    setEvents((prev) => prev.filter((e) => e.vehicleId !== id));
    setSelectedVehicleId((prev) => (prev === id ? (vehicles.find((v) => v.id !== id)?.id ?? "") : prev));
  };

  const addMaintenanceItem = (m) => {
    setMaintenance((prev) => [{ ...m, id: uid() }, ...prev]);
  };

  const deleteMaintenance = (id) => {
    setMaintenance((prev) => prev.filter((m) => m.id !== id));
  };

  const estimatedMarketRate = (v) => {
    const base = 5.9;
    const age = Math.max(0, new Date().getFullYear() - v.year);
    const ageAdj = Math.min(2.0, age * 0.15);
    const classicAdj = v.year < 1990 ? 1.0 : 0;
    return Math.max(2.9, base + ageAdj + classicAdj);
  };

  const estRefiSavings = (v) => {
    const bal = numberOr0(v.loanBalance);
    if (bal <= 0) return 0;
    const current = numberOr0(v.interestRate);
    const market = estimatedMarketRate(v);
    const diff = current - market;
    if (diff <= 0.5) return 0;
    return Math.max(0, (bal * (diff / 100)) / 12);
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              <h1 className="text-xl md:text-2xl font-semibold">HomeFleet</h1>
              <Pill>Demo</Pill>
            </div>
            <p className="text-sm text-muted-foreground">A practical family vehicle dashboard — organize everything and see your equity at a glance.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Simple mode</Label>
              <Switch checked={simpleMode} onCheckedChange={setSimpleMode} />
            </div>
            <AddVehicleDialog onAdd={addVehicle} />
          </div>
        </div>

        <Tabs defaultValue="home" className="w-full">
          <TabsList className="grid w-full grid-cols-4 rounded-2xl">
            <TabsTrigger value="home">Home</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="events">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="home" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <StatCard title="Total Vehicle Value" value={currency(totals.totalValue)} icon={<BadgeDollarSign className="h-5 w-5" />} />
              <StatCard title="Total Loan Balance" value={currency(totals.totalDebt)} icon={<ClipboardList className="h-5 w-5" />} />
              <StatCard title="Total Equity" value={currency(totals.totalEquity)} hint="Value minus debt" icon={<PiggyBank className="h-5 w-5" />} />
              <StatCard title="Monthly Auto Spend" value={currency(totals.monthlyAutoSpend)} hint="Payments + insurance" icon={<ShieldCheck className="h-5 w-5" />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Card className="rounded-2xl shadow-sm lg:col-span-2">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Your vehicles</div>
                      <div className="text-xs text-muted-foreground">Tap a vehicle to view details and options.</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{vehicles.length} total</div>
                  </div>
                  <div className="space-y-2">
                    {vehicles.map((v) => {
                      const equity = numberOr0(v.marketValue) - numberOr0(v.loanBalance);
                      const selected = selectedVehicleId === v.id;
                      return (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVehicleId(v.id)}
                          className={`w-full text-left rounded-2xl border p-3 transition hover:bg-muted/40 ${selected ? "bg-muted/50" : "bg-background"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="font-medium">
                                {v.year} {v.make} {v.model}{v.trim ? ` ${v.trim}` : ""}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {v.name}{v.driver ? ` • Driver: ${v.driver}` : ""} • {Number(v.mileage || 0).toLocaleString()} miles
                              </div>
                              {!simpleMode ? <VehicleBadges v={v} /> : null}
                            </div>
                            <div className="text-right">
                              <div className="text-sm">Value: {currency(v.marketValue)}</div>
                              <div className={`text-sm font-semibold ${equity >= 0 ? "" : "text-destructive"}`}>Equity: {currency(equity)}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Upcoming (30 days)</div>
                      <div className="text-xs text-muted-foreground">Maintenance reminders to keep you organized.</div>
                    </div>
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Separator />
                  {upcomingMaintenance.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No maintenance due in the next 30 days.</div>
                  ) : (
                    <div className="space-y-2">
                      {upcomingMaintenance.slice(0, 5).map((m) => {
                        const v = vehicles.find((x) => x.id === m.vehicleId);
                        return (
                          <div key={m.id} className="rounded-2xl border p-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium">{m.title}</div>
                              <Badge variant={m.priority === "High" ? "destructive" : m.priority === "Medium" ? "secondary" : "outline"} className="rounded-full">
                                {m.priority}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {v ? `${v.year} ${v.make} ${v.model}` : ""} {m.dueDate ? `• Due ${m.dueDate}` : ""}
                            </div>
                            <div className="text-xs text-muted-foreground">Est. {currency(m.estCost)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <VehicleDetails
              key={selectedVehicle?.id || "none"}
              vehicle={selectedVehicle}
              simpleMode={simpleMode}
              maintenance={maintenance.filter((m) => m.vehicleId === selectedVehicle?.id)}
              onUpdate={(patch) => selectedVehicle && updateVehicle(selectedVehicle.id, patch)}
              onDelete={() => selectedVehicle && deleteVehicle(selectedVehicle.id)}
              onAddMaintenance={(m) => selectedVehicle && addMaintenanceItem({ ...m, vehicleId: selectedVehicle.id })}
              onDeleteMaintenance={deleteMaintenance}
              onAction={(action) => selectedVehicle && handleLog(selectedVehicle.id, action)}
              estMarketRate={selectedVehicle ? estimatedMarketRate(selectedVehicle) : 0}
              estSavings={selectedVehicle ? estRefiSavings(selectedVehicle) : 0}
            />
          </TabsContent>

          <TabsContent value="vehicles" className="space-y-4">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Vehicles</div>
                    <div className="text-xs text-muted-foreground">Edit values, balances, and costs. All totals update instantly.</div>
                  </div>
                  <AddVehicleDialog onAdd={addVehicle} />
                </div>
                <Separator className="my-3" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {vehicles.map((v) => (
                    <Card key={v.id} className="rounded-2xl">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium">{v.name}</div>
                            <div className="text-sm text-muted-foreground">{v.year} {v.make} {v.model}{v.trim ? ` ${v.trim}` : ""}</div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => deleteVehicle(v.id)} aria-label="Delete vehicle">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Mileage"><Input value={v.mileage} onChange={(e) => updateVehicle(v.id, { mileage: numberOr0(e.target.value) })} /></Field>
                          <Field label="Market value"><Input value={v.marketValue} onChange={(e) => updateVehicle(v.id, { marketValue: numberOr0(e.target.value) })} /></Field>
                          <Field label="Loan balance"><Input value={v.loanBalance} onChange={(e) => updateVehicle(v.id, { loanBalance: numberOr0(e.target.value) })} /></Field>
                          <Field label="Insurance / mo"><Input value={v.insuranceMonthly} onChange={(e) => updateVehicle(v.id, { insuranceMonthly: numberOr0(e.target.value) })} /></Field>
                        </div>
                        <div className="text-sm">
                          Equity: <span className="font-semibold">{currency(numberOr0(v.marketValue) - numberOr0(v.loanBalance))}</span> • Monthly auto spend: <span className="font-semibold">{currency(numberOr0(v.monthlyPayment) + numberOr0(v.insuranceMonthly))}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-4">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Maintenance</div>
                    <div className="text-xs text-muted-foreground">A simple list across the household (keeps the family organized).</div>
                  </div>
                  <AddMaintenanceDialog vehicles={vehicles} onAdd={(m) => addMaintenanceItem(m)} />
                </div>
                <Separator />
                {maintenance.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No maintenance items yet.</div>
                ) : (
                  <div className="space-y-2">
                    {maintenance
                      .slice()
                      .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
                      .map((m) => {
                        const v = vehicles.find((x) => x.id === m.vehicleId);
                        return (
                          <div key={m.id} className="rounded-2xl border p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium">{m.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  {v ? `${v.year} ${v.make} ${v.model}` : ""}
                                  {m.dueDate ? ` • Due ${m.dueDate}` : ""}
                                  {m.dueMiles ? ` • ${Number(m.dueMiles).toLocaleString()} miles` : ""}
                                </div>
                                <div className="text-xs text-muted-foreground">Est. {currency(m.estCost)}</div>
                                {m.troubleCodes ? <div className="text-xs text-muted-foreground">Codes: {m.troubleCodes}</div> : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={m.priority === "High" ? "destructive" : m.priority === "Medium" ? "secondary" : "outline"} className="rounded-full">
                                  {m.priority}
                                </Badge>
                                <Button variant="ghost" size="icon" onClick={() => deleteMaintenance(m.id)} aria-label="Delete maintenance">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Activity</div>
                    <div className="text-xs text-muted-foreground">Track what people tap.</div>
                  </div>
                  <Button variant="outline" className="rounded-2xl" onClick={() => setEvents([])}>Clear</Button>
                </div>
                <Separator />
                {events.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No activity yet. Tap a vehicle action button to create events.</div>
                ) : (
                  <div className="space-y-2">
                    {events.map((e) => {
                      const v = vehicles.find((x) => x.id === e.vehicleId);
                      return (
                        <div key={e.id} className="rounded-2xl border p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium">{e.action}</div>
                              <div className="text-xs text-muted-foreground">{v ? `${v.year} ${v.make} ${v.model}` : ""}</div>
                            </div>
                            <div className="text-xs text-muted-foreground">{new Date(e.ts).toLocaleString()}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-xs text-muted-foreground">Demo note: values and rates are estimates for prototyping only.</div>
      </div>
    </div>
  );
}

function AddVehicleDialog({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    year: new Date().getFullYear(),
    make: "",
    model: "",
    trim: "",
    driver: "",
    mileage: 0,
    marketValue: 0,
    loanBalance: 0,
    interestRate: 0,
    monthlyPayment: 0,
    insuranceMonthly: 0,
    warrantyExpDate: "",
    registrationExpDate: "",
    notes: "",
  });

  const reset = () =>
    setForm({
      name: "",
      year: new Date().getFullYear(),
      make: "",
      model: "",
      trim: "",
      driver: "",
      mileage: 0,
      marketValue: 0,
      loanBalance: 0,
      interestRate: 0,
      monthlyPayment: 0,
      insuranceMonthly: 0,
      warrantyExpDate: "",
      registrationExpDate: "",
      notes: "",
    });

  const canSave = form.name.trim() && form.make.trim() && form.model.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="rounded-2xl"><Plus className="h-4 w-4 mr-2" /> Add vehicle</Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl max-w-2xl">
        <DialogHeader><DialogTitle>Add a vehicle</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nickname (e.g., Family SUV)"><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></Field>
          <Field label="Driver"><Input value={form.driver} onChange={(e) => setForm((p) => ({ ...p, driver: e.target.value }))} /></Field>
          <Field label="Year"><Input value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: numberOr0(e.target.value) }))} /></Field>
          <Field label="Mileage"><Input value={form.mileage} onChange={(e) => setForm((p) => ({ ...p, mileage: numberOr0(e.target.value) }))} /></Field>
          <Field label="Make"><Input value={form.make} onChange={(e) => setForm((p) => ({ ...p, make: e.target.value }))} /></Field>
          <Field label="Model"><Input value={form.model} onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))} /></Field>
          <Field label="Trim"><Input value={form.trim} onChange={(e) => setForm((p) => ({ ...p, trim: e.target.value }))} /></Field>
          <div />
          <Field label="Market value"><Input value={form.marketValue} onChange={(e) => setForm((p) => ({ ...p, marketValue: numberOr0(e.target.value) }))} /></Field>
          <Field label="Loan balance"><Input value={form.loanBalance} onChange={(e) => setForm((p) => ({ ...p, loanBalance: numberOr0(e.target.value) }))} /></Field>
          <Field label="Interest rate (%)"><Input value={form.interestRate} onChange={(e) => setForm((p) => ({ ...p, interestRate: numberOr0(e.target.value) }))} /></Field>
          <Field label="Monthly payment"><Input value={form.monthlyPayment} onChange={(e) => setForm((p) => ({ ...p, monthlyPayment: numberOr0(e.target.value) }))} /></Field>
          <Field label="Insurance / mo"><Input value={form.insuranceMonthly} onChange={(e) => setForm((p) => ({ ...p, insuranceMonthly: numberOr0(e.target.value) }))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Warranty end"><Input type="date" value={form.warrantyExpDate} onChange={(e) => setForm((p) => ({ ...p, warrantyExpDate: e.target.value }))} /></Field>
            <Field label="Registration exp"><Input type="date" value={form.registrationExpDate} onChange={(e) => setForm((p) => ({ ...p, registrationExpDate: e.target.value }))} /></Field>
          </div>
          <div />
          <div className="md:col-span-2"><Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="min-h-[72px]" /></Field></div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-2">
          <Button variant="outline" className="rounded-2xl" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            className="rounded-2xl"
            disabled={!canSave}
            onClick={() => {
              onAdd({
                ...form,
                year: numberOr0(form.year),
                mileage: numberOr0(form.mileage),
                marketValue: numberOr0(form.marketValue),
                loanBalance: numberOr0(form.loanBalance),
                interestRate: numberOr0(form.interestRate),
                monthlyPayment: numberOr0(form.monthlyPayment),
                insuranceMonthly: numberOr0(form.insuranceMonthly),
              });
              setOpen(false);
              reset();
            }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddMaintenanceDialog({ vehicles, onAdd }) {
  const [open, setOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const [title, setTitle] = useState("Oil change");
  const [dueDate, setDueDate] = useState("");
  const [dueMiles, setDueMiles] = useState("");
  const [codes, setCodes] = useState("");
  const [estCost, setEstCost] = useState("");
  const [priority, setPriority] = useState("Low");
  const [shop, setShop] = useState("");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setVehicleId(vehicles[0]?.id ?? "");
    setTitle("Oil change");
    setDueDate("");
    setDueMiles("");
    setCodes("");
    setEstCost("");
    setPriority("Low");
    setShop("");
    setLink("");
    setNotes("");
  };

  const canSave = vehicleId && title.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-2xl"><Plus className="h-4 w-4 mr-2" /> Add maintenance</Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl max-w-2xl">
        <DialogHeader><DialogTitle>Add a maintenance item</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vehicle</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger className="rounded-2xl"><SelectValue placeholder="Select vehicle" /></SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name} — {v.year} {v.make} {v.model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Due date"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
          <Field label="Due mileage"><Input value={dueMiles} onChange={(e) => setDueMiles(e.target.value)} /></Field>
          <Field label="Trouble codes"><Input value={codes} onChange={(e) => setCodes(e.target.value)} placeholder="e.g., P0420" /></Field>
          <Field label="Estimated cost"><Input value={estCost} onChange={(e) => setEstCost(e.target.value)} /></Field>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Shop (optional)"><Input value={shop} onChange={(e) => setShop(e.target.value)} /></Field>
          <Field label="Booking link (optional)"><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." /></Field>
          <div className="md:col-span-2"><Field label="Notes (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[72px]" /></Field></div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-2">
          <Button variant="outline" className="rounded-2xl" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            className="rounded-2xl"
            disabled={!canSave}
            onClick={() => {
              onAdd({
                vehicleId,
                title,
                dueDate: dueDate || undefined,
                dueMiles: dueMiles ? numberOr0(dueMiles) : undefined,
                troubleCodes: codes || undefined,
                estCost: numberOr0(estCost),
                priority,
                shop: shop || undefined,
                link: link || undefined,
                notes: notes || undefined,
              });
              setOpen(false);
              reset();
            }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VehicleDetails({
  vehicle,
  maintenance,
  onUpdate,
  onDelete,
  onAddMaintenance,
  onDeleteMaintenance,
  onAction,
  simpleMode,
  estMarketRate,
  estSavings,
}) {
  if (!vehicle) return null;

  const equity = numberOr0(vehicle.marketValue) - numberOr0(vehicle.loanBalance);
  const monthlySpend = numberOr0(vehicle.monthlyPayment) + numberOr0(vehicle.insuranceMonthly);
  const w = daysUntil(vehicle.warrantyExpDate);
  const r = daysUntil(vehicle.registrationExpDate);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">Selected vehicle</div>
            <div className="text-lg font-semibold">{vehicle.name}</div>
            <div className="text-sm text-muted-foreground">
              {vehicle.year} {vehicle.make} {vehicle.model}{vehicle.trim ? ` ${vehicle.trim}` : ""}
              {vehicle.driver ? ` • Driver: ${vehicle.driver}` : ""}
            </div>
          </div>
          <Button variant="outline" className="rounded-2xl" onClick={onDelete}><Trash2 className="h-4 w-4 mr-2" /> Remove</Button>
        </div>

        {!simpleMode ? <VehicleBadges v={vehicle} /> : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="rounded-2xl"><CardContent className="p-4 space-y-2">
            <div className="text-sm font-medium">Financial snapshot</div>
            <div className="text-sm">Value: <span className="font-semibold">{currency(vehicle.marketValue)}</span></div>
            <div className="text-sm">Loan: <span className="font-semibold">{currency(vehicle.loanBalance)}</span></div>
            <div className={`text-lg font-semibold ${equity < 0 ? "text-destructive" : ""}`}>Equity: {currency(equity)}</div>
            <div className="text-sm text-muted-foreground">Monthly auto spend: {currency(monthlySpend)}</div>
          </CardContent></Card>

          <Card className="rounded-2xl"><CardContent className="p-4 space-y-2">
            <div className="text-sm font-medium">Coverage & dates</div>
            <div className="text-sm">Warranty end: <span className="font-semibold">{vehicle.warrantyExpDate || "—"}</span></div>
            {w !== null ? (
              <div className={`text-sm ${w <= 120 ? "text-destructive" : ""}`}>Warranty days left: <span className="font-semibold">{w}</span></div>
            ) : (
              <div className="text-sm text-muted-foreground">Warranty tracking not set.</div>
            )}
            <div className="text-sm">Registration: <span className="font-semibold">{vehicle.registrationExpDate || "—"}</span></div>
            {r !== null ? (
              <div className={`text-sm ${r <= 45 ? "text-destructive" : r <= 90 ? "" : "text-muted-foreground"}`}>Registration days left: <span className="font-semibold">{r}</span></div>
            ) : null}
          </CardContent></Card>

          <Card className="rounded-2xl"><CardContent className="p-4 space-y-2">
            <div className="text-sm font-medium">Options (demo)</div>
            <div className="text-xs text-muted-foreground">Tap to simulate interest and log activity.</div>
            <div className="grid grid-cols-2 gap-2">
              <Button className="rounded-2xl" variant="secondary" onClick={() => onAction("Service")}>Service</Button>
              <Button className="rounded-2xl" variant="secondary" onClick={() => onAction("Insurance")}>Insurance</Button>
              <Button className="rounded-2xl" variant="secondary" onClick={() => onAction("Refinance")}>Refinance</Button>
              <Button className="rounded-2xl" variant="secondary" onClick={() => onAction("Warranty")}>Warranty</Button>
            </div>
            <Button className="rounded-2xl w-full" onClick={() => onAction("Sell/Trade")}>Sell / Trade</Button>
            <Separator />
            <div className="text-sm">Est. market rate: <span className="font-semibold">{Number(estMarketRate || 0).toFixed(1)}%</span></div>
            <div className="text-sm">Est. refi savings: <span className="font-semibold">{currency(estSavings)}</span><span className="text-xs text-muted-foreground">/mo</span></div>
          </CardContent></Card>
        </div>

        <Card className="rounded-2xl"><CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Maintenance for this vehicle</div>
              <div className="text-xs text-muted-foreground">Keep things organized with simple reminders.</div>
            </div>
            <QuickAddMaintenance onAdd={onAddMaintenance} />
          </div>
          <Separator />
          {maintenance.length === 0 ? (
            <div className="text-sm text-muted-foreground">No items yet.</div>
          ) : (
            <div className="space-y-2">
              {maintenance
                .slice()
                .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
                .map((m) => (
                  <div key={m.id} className="rounded-2xl border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{m.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {m.dueDate ? `Due ${m.dueDate}` : "No due date"}
                          {m.dueMiles ? ` • ${Number(m.dueMiles).toLocaleString()} miles` : ""}
                          {m.troubleCodes ? ` • Codes: ${m.troubleCodes}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">Est. {currency(m.estCost)} {m.shop ? `• ${m.shop}` : ""}</div>
                        {m.notes ? <div className="text-xs text-muted-foreground mt-1">{m.notes}</div> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={m.priority === "High" ? "destructive" : m.priority === "Medium" ? "secondary" : "outline"} className="rounded-full">{m.priority}</Badge>
                        <Button variant="ghost" size="icon" className="rounded-2xl" onClick={() => onDeleteMaintenance(m.id)} aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent></Card>

        <Card className="rounded-2xl"><CardContent className="p-4 space-y-3">
          <div className="text-sm font-medium">Quick edit (demo)</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label="Mileage"><Input value={vehicle.mileage} onChange={(e) => onUpdate({ mileage: numberOr0(e.target.value) })} /></Field>
            <Field label="Market value"><Input value={vehicle.marketValue} onChange={(e) => onUpdate({ marketValue: numberOr0(e.target.value) })} /></Field>
            <Field label="Loan balance"><Input value={vehicle.loanBalance} onChange={(e) => onUpdate({ loanBalance: numberOr0(e.target.value) })} /></Field>
            <Field label="Insurance / mo"><Input value={vehicle.insuranceMonthly} onChange={(e) => onUpdate({ insuranceMonthly: numberOr0(e.target.value) })} /></Field>
          </div>
        </CardContent></Card>
      </CardContent>
    </Card>
  );
}

function QuickAddMaintenance({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Oil change");
  const [dueDate, setDueDate] = useState("");
  const [estCost, setEstCost] = useState("");
  const [priority, setPriority] = useState("Low");

  const reset = () => {
    setTitle("Oil change");
    setDueDate("");
    setEstCost("");
    setPriority("Low");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-2xl"><Plus className="h-4 w-4 mr-2" /> Add</Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl max-w-lg">
        <DialogHeader><DialogTitle>Add maintenance</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Due date"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
          <Field label="Estimated cost"><Input value={estCost} onChange={(e) => setEstCost(e.target.value)} /></Field>
        </div>
        <div className="flex items-center justify-end gap-2 mt-2">
          <Button variant="outline" className="rounded-2xl" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            className="rounded-2xl"
            disabled={!title.trim()}
            onClick={() => {
              onAdd({
                title,
                dueDate: dueDate || undefined,
                estCost: numberOr0(estCost),
                priority,
              });
              setOpen(false);
              reset();
            }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
