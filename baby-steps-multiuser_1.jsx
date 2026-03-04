import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Baby,
  Calendar as CalendarIcon,
  Camera,
  CheckCircle2,
  Download,
  HeartHandshake,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  LogOut,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Trash2,
  Users,
  BookOpen,
} from "lucide-react";

// =====================
// Storage Helpers (Using window.storage API)
// =====================
async function loadUserData(username, key) {
  try {
    const result = await window.storage.get(`user:${username}:${key}`);
    return result ? JSON.parse(result.value) : null;
  } catch (error) {
    console.error(`Failed to load ${key}:`, error);
    return null;
  }
}

async function saveUserData(username, key, data) {
  try {
    await window.storage.set(`user:${username}:${key}`, JSON.stringify(data));
  } catch (error) {
    console.error(`Failed to save ${key}:`, error);
  }
}

async function loadSharedData(key) {
  try {
    const result = await window.storage.get(key, true);
    return result ? JSON.parse(result.value) : null;
  } catch (error) {
    console.error(`Failed to load shared ${key}:`, error);
    return null;
  }
}

async function saveSharedData(key, data) {
  try {
    await window.storage.set(key, JSON.stringify(data), true);
  } catch (error) {
    console.error(`Failed to save shared ${key}:`, error);
  }
}

async function listUsers() {
  try {
    const result = await window.storage.list("user:");
    return result ? result.keys : [];
  } catch (error) {
    return [];
  }
}

// =====================
// Auth Helpers
// =====================
async function registerUser(username, password) {
  const userKey = `auth:${username}`;
  try {
    const existing = await window.storage.get(userKey, true);
    if (existing) return { success: false, error: "Username already exists" };
    
    // Simple hash (NOT secure for production, fine for MVP testing)
    const hash = btoa(password + username);
    await window.storage.set(userKey, JSON.stringify({ username, hash }), true);
    
    // Initialize user data
    const initialProfile = {
      babyName: "",
      birthdate: "",
      sex: "female",
      parentName: username,
    };
    await saveUserData(username, "profile", initialProfile);
    await saveUserData(username, "milestones", {});
    await saveUserData(username, "customMilestones", []);
    await saveUserData(username, "journal", []);
    await saveUserData(username, "preferences", { theme: "pastel", contactEmail: "" });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: "Registration failed" };
  }
}

async function loginUser(username, password) {
  try {
    const result = await window.storage.get(`auth:${username}`, true);
    if (!result) return { success: false, error: "User not found" };
    
    const userData = JSON.parse(result.value);
    const hash = btoa(password + username);
    
    if (userData.hash === hash) {
      return { success: true, username };
    }
    return { success: false, error: "Invalid password" };
  } catch (error) {
    return { success: false, error: "Login failed" };
  }
}

// =====================
// Content: Milestones & Activities
// =====================
const MILESTONES = [
  {
    fromWeek: 0,
    toWeek: 3,
    items: [
      "Turns toward familiar voices",
      "Briefly lifts head during tummy time",
      "Stares at high-contrast patterns",
    ],
    skills: ["Sensory", "Neck Strength"],
  },
  {
    fromWeek: 4,
    toWeek: 7,
    items: ["Begins social smiling", "Tracks objects side to side", "Brings hands to mouth"],
    skills: ["Social", "Vision Tracking"],
  },
  {
    fromWeek: 8,
    toWeek: 11,
    items: ["Coos and makes vowel sounds", "Improved head control", "Kicks and stretches more"],
    skills: ["Language", "Core Strength"],
  },
  {
    fromWeek: 12,
    toWeek: 15,
    items: ["Laughs and squeals", "Holds head steady without support", "Grasps a toy and shakes it"],
    skills: ["Language", "Grasp"],
  },
  {
    fromWeek: 16,
    toWeek: 19,
    items: ["Rolls from tummy to back", "Reaches for objects", "Brings feet to hands"],
    skills: ["Gross Motor", "Reach"],
  },
  {
    fromWeek: 20,
    toWeek: 23,
    items: ["Rolls both directions", "Responds to name sometimes", "Starts babbling (ba, da)"],
    skills: ["Gross Motor", "Language"],
  },
  {
    fromWeek: 24,
    toWeek: 27,
    items: ["Sits with minimal support", "Transfers objects hand to hand", "Explores with mouth"],
    skills: ["Sitting", "Transfer"],
  },
  {
    fromWeek: 28,
    toWeek: 31,
    items: ["Sits without support briefly", "Bears weight on legs", "Starts object permanence"],
    skills: ["Sitting", "Problem Solving"],
  },
  {
    fromWeek: 32,
    toWeek: 35,
    items: ["Army crawls or pivots on tummy", "Stranger awareness begins", "Imitates sounds"],
    skills: ["Mobility", "Social"],
  },
  {
    fromWeek: 36,
    toWeek: 39,
    items: ["Crawls on hands/knees", "Pulls to stand (early)", "Plays peek-a-boo"],
    skills: ["Mobility", "Standing"],
  },
  {
    fromWeek: 40,
    toWeek: 43,
    items: [
      "Cruises along furniture",
      "Pincer grasp (thumb + finger)",
      "Says "mama"/"dada" nonspecific",
    ],
    skills: ["Pincer", "Standing"],
  },
  {
    fromWeek: 44,
    toWeek: 47,
    items: [
      "Stands alone briefly",
      "Understands simple gestures",
      "Drops objects on purpose (experiments)",
    ],
    skills: ["Standing", "Understanding"],
  },
  {
    fromWeek: 48,
    toWeek: 52,
    items: [
      "Takes a few independent steps",
      "Says 1–2 words with meaning",
      "Claps, waves, plays simple games",
    ],
    skills: ["Walking", "Language"],
  },
];

const ACTIVITIES = [
  {
    range: [0, 7],
    ideas: [
      "Skin-to-skin cuddles and soft singing",
      "High-contrast black/white cards for 2–3 minutes",
      "1–2 minute tummy time sessions several times daily",
    ],
  },
  {
    range: [8, 15],
    ideas: [
      "Mirror faces + gentle babble conversations",
      "Tummy time with rolled towel under chest",
      "Rattles and crinkle books to grasp",
    ],
  },
  {
    range: [16, 23],
    ideas: [
      "Reach-and-grab play with soft rings",
      "Name recognition game (say baby's name, smile)",
      "Rolling practice with toys just out of reach",
    ],
  },
  {
    range: [24, 31],
    ideas: ["Sit-and-stack cups", "Transfer objects hand-to-hand", "Nursery rhymes with actions"],
  },
  {
    range: [32, 39],
    ideas: [
      "Crawl tunnels (pillows/blankets)",
      "Peek-a-boo hide-and-find",
      "Imitation babble back-and-forth",
    ],
  },
  {
    range: [40, 52],
    ideas: [
      "Cruising along the couch (supervised)",
      "Drop-in shape sorter play",
      "Wave, clap, and simple sign language",
    ],
  },
];

// =====================
// Demo Shop Products
// =====================
const DEMO_SHOP_PRODUCTS = [
  {
    id: "s1",
    name: "Contrast Card Set (0–3 mo)",
    price: 14.99,
    ageFromW: 0,
    ageToW: 12,
    skillTags: ["Sensory", "Vision Tracking"],
    description: "Bold black/white patterns to support early visual focus.",
  },
  {
    id: "s2",
    name: "Soft Rattle Trio",
    price: 18.0,
    ageFromW: 8,
    ageToW: 24,
    skillTags: ["Grasp", "Sensory"],
    description: "Gentle sound + easy grip for little hands.",
  },
  {
    id: "s3",
    name: "Stack & Nest Cups",
    price: 12.5,
    ageFromW: 20,
    ageToW: 60,
    skillTags: ["Problem Solving", "Transfer"],
    description: "Stacking, nesting, bath play—so many ways to learn.",
  },
  {
    id: "s4",
    name: "Shape Sorter House",
    price: 24.99,
    ageFromW: 32,
    ageToW: 80,
    skillTags: ["Problem Solving", "Pincer"],
    description: "Match shapes, practice pincer grasp, and build focus.",
  },
  {
    id: "s5",
    name: "Push & Cruise Walker (Supervised)",
    price: 39.0,
    ageFromW: 40,
    ageToW: 90,
    skillTags: ["Standing", "Walking"],
    description: "Encourages cruising and early steps—always supervise.",
  },
];

// =====================
// Utilities
// =====================
function weeksSince(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 7)));
}

function getMilestonesForWeek(week) {
  const block = MILESTONES.find((b) => week >= b.fromWeek && week <= b.toWeek);
  return block ? block.items : [];
}

function getSkillsForWeek(week) {
  const block = MILESTONES.find((b) => week >= b.fromWeek && week <= b.toWeek);
  return block?.skills || [];
}

function getActivitiesForWeek(week) {
  const b = ACTIVITIES.find((a) => week >= a.range[0] && week <= a.range[1]);
  return b ? b.ideas : [];
}

function ageStringFromWeeks(weeks) {
  const months = Math.floor(weeks / 4.345);
  const approxWeeksInMonths = Math.round(months * 4.345);
  const remWeeks = Math.max(0, weeks - approxWeeksInMonths);
  return `${months} mo ${remWeeks} wk`;
}

function money(n) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
  } catch {
    return `$${Number(n).toFixed(2)}`;
  }
}

function escapeHtml(str) {
  return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// =====================
// App
// =====================
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in (session storage)
    const savedUser = sessionStorage.getItem("currentUser");
    if (savedUser) {
      setCurrentUser(savedUser);
    }
    setLoading(false);
  }, []);

  const handleLogin = (username) => {
    setCurrentUser(username);
    sessionStorage.setItem("currentUser", username);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem("currentUser");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-sky-50 to-emerald-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-600" />
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return <MainApp username={currentUser} onLogout={handleLogout} />;
}

// =====================
// Auth Screen
// =====================
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!username.trim() || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const result = await loginUser(username.trim(), password);
        if (result.success) {
          onLogin(result.username);
        } else {
          setError(result.error);
        }
      } else {
        const result = await registerUser(username.trim(), password);
        if (result.success) {
          onLogin(username.trim());
        } else {
          setError(result.error);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-sky-50 to-emerald-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl rounded-2xl border-0 bg-white/90">
        <CardContent className="p-8">
          <div className="flex flex-col items-center mb-6">
            <Baby className="w-16 h-16 text-fuchsia-600 mb-3" />
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-600 via-sky-600 to-emerald-600">
              Baby Steps
            </h1>
            <p className="text-slate-600 text-sm mt-2">Multi-user milestone tracking & marketplace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Username</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                disabled={loading}
              />
            </div>

            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm p-3 bg-red-50 rounded-lg">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-fuchsia-600 hover:bg-fuchsia-700"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === "login" ? (
                "Log In"
              ) : (
                "Sign Up"
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError("");
                }}
                className="text-sky-600 hover:text-sky-700 text-sm"
                disabled={loading}
              >
                {mode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
              </button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-amber-50 rounded-lg text-sm text-slate-700">
            <strong>Test Group Info:</strong> All users share the same marketplace and can see each other's playdate profiles. Your personal milestones and journal are private.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =====================
// Main App
// =====================
function MainApp({ username, onLogout }) {
  const [state, setState] = useState({
    profile: { babyName: "", birthdate: "", sex: "female", parentName: username },
    milestones: {},
    customMilestones: [],
    journal: [],
    playdateProfile: {
      caregiverRole: "Mom",
      city: "",
      values: ["Kindness", "Patience"],
      interests: ["Walks", "Storytime"],
      availability: "Weekdays AM",
    },
    preferences: { theme: "pastel", contactEmail: "" },
    cart: [],
    saved: [],
  });

  const [sharedData, setSharedData] = useState({
    listings: [],
    playdates: [],
  });

  const [dataLoaded, setDataLoaded] = useState(false);

  // Load user data
  useEffect(() => {
    async function loadData() {
      const profile = await loadUserData(username, "profile");
      const milestones = await loadUserData(username, "milestones");
      const customMilestones = await loadUserData(username, "customMilestones");
      const journal = await loadUserData(username, "journal");
      const preferences = await loadUserData(username, "preferences");
      const cart = await loadUserData(username, "cart");
      const saved = await loadUserData(username, "saved");

      setState((s) => ({
        ...s,
        profile: profile || s.profile,
        milestones: milestones || {},
        customMilestones: customMilestones || [],
        journal: journal || [],
        preferences: preferences || s.preferences,
        cart: cart || [],
        saved: saved || [],
      }));

      // Load playdate profile separately
      const playdateProfile = await loadUserData(username, "playdateProfile");
      if (playdateProfile) {
        setState((s) => ({ ...s, playdateProfile }));
      }

      setDataLoaded(true);
    }
    loadData();
  }, [username]);

  // Load shared data
  useEffect(() => {
    async function loadShared() {
      const listings = await loadSharedData("marketplace:listings");
      const playdates = await loadSharedData("playdates:profiles");

      setSharedData({
        listings: listings || [],
        playdates: playdates || [],
      });
    }
    loadShared();
  }, []);

  // Save user data when it changes
  useEffect(() => {
    if (!dataLoaded) return;
    saveUserData(username, "profile", state.profile);
    saveUserData(username, "milestones", state.milestones);
    saveUserData(username, "customMilestones", state.customMilestones);
    saveUserData(username, "journal", state.journal);
    saveUserData(username, "preferences", state.preferences);
    saveUserData(username, "playdateProfile", state.playdateProfile);
    saveUserData(username, "cart", state.cart);
    saveUserData(username, "saved", state.saved);
  }, [state, username, dataLoaded]);

  // Save shared data when it changes
  useEffect(() => {
    if (!dataLoaded) return;
    saveSharedData("marketplace:listings", sharedData.listings);
    saveSharedData("playdates:profiles", sharedData.playdates);
  }, [sharedData, dataLoaded]);

  const week = useMemo(() => weeksSince(state.profile.birthdate), [state.profile.birthdate]);
  const currentMilestones = useMemo(() => getMilestonesForWeek(week), [week]);
  const currentSkills = useMemo(() => getSkillsForWeek(week), [week]);
  const currentActivities = useMemo(() => getActivitiesForWeek(week), [week]);

  const themeBg =
    state.preferences.theme === "bright"
      ? "bg-gradient-to-br from-amber-100 via-pink-100 to-sky-100"
      : "bg-gradient-to-br from-rose-50 via-sky-50 to-emerald-50";

  const titleGrad = "bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-600 via-sky-600 to-emerald-600";

  if (!dataLoaded) {
    return (
      <div className={`min-h-screen ${themeBg} flex items-center justify-center`}>
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-600" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeBg} p-4 md:p-8`}>
      <header className="max-w-6xl mx-auto mb-4 md:mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Baby className="w-10 h-10 text-fuchsia-600" />
            <div>
              <h1 className={`text-2xl md:text-4xl font-extrabold ${titleGrad}`}>Baby Steps</h1>
              <p className="text-slate-600 text-sm">Logged in as: {username}</p>
            </div>
          </div>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-7 gap-2 bg-white/70">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
            <TabsTrigger value="activities">Activities</TabsTrigger>
            <TabsTrigger value="journal">Journal</TabsTrigger>
            <TabsTrigger value="market">Marketplace</TabsTrigger>
            <TabsTrigger value="playdates">Playdates</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <Dashboard
              state={state}
              setState={setState}
              week={week}
              currentMilestones={currentMilestones}
              currentActivities={currentActivities}
              currentSkills={currentSkills}
              username={username}
            />
          </TabsContent>

          <TabsContent value="milestones" className="mt-4">
            <MilestonesTab state={state} setState={setState} week={week} />
          </TabsContent>

          <TabsContent value="activities" className="mt-4">
            <ActivitiesTab state={state} setState={setState} week={week} />
          </TabsContent>

          <TabsContent value="journal" className="mt-4">
            <JournalTab state={state} setState={setState} week={week} username={username} />
          </TabsContent>

          <TabsContent value="market" className="mt-4">
            <MarketplaceTab
              state={state}
              setState={setState}
              sharedData={sharedData}
              setSharedData={setSharedData}
              week={week}
              skills={currentSkills}
              username={username}
            />
          </TabsContent>

          <TabsContent value="playdates" className="mt-4">
            <PlaydatesTab
              state={state}
              setState={setState}
              sharedData={sharedData}
              setSharedData={setSharedData}
              username={username}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <SettingsTab state={state} setState={setState} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="max-w-6xl mx-auto mt-10 text-center text-slate-600">
        <p className="text-sm">
          This MVP is for testing only. Not medical advice. Every child develops uniquely.
        </p>
      </footer>
    </div>
  );
}

// =====================
// Dashboard
// =====================
function Dashboard({ state, setState, week, currentMilestones, currentActivities, currentSkills, username }) {
  return (
    <Card className="shadow-xl rounded-2xl border-0 bg-white/80">
      <CardContent className="p-4 md:p-6">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> Welcome
              {state.profile.parentName ? `, ${state.profile.parentName}` : ""}!
            </h2>
            <p className="text-slate-700 mt-1">
              Baby {state.profile.babyName || "(name)"} is <strong>{ageStringFromWeeks(week)}</strong> old.
            </p>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <StatBox label="This Week" value={`${week} wks`} icon={<CalendarIcon className="w-5 h-5" />} />
              <StatBox
                label="Milestones Checked"
                value={`${Object.values(state.milestones).filter((m) => m.done).length}`}
                icon={<CheckCircle2 className="w-5 h-5" />}
              />
            </div>

            <div className="mt-6">
              <h3 className="font-semibold text-slate-900 mb-2">Typical Milestones This Week</h3>
              <ul className="space-y-2">
                {currentMilestones.length ? (
                  currentMilestones.map((m, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Checkbox
                        id={`dash-m-${i}`}
                        checked={!!state.milestones[`${week}-${i}`]?.done}
                        onCheckedChange={(v) => {
                          setState((s) => ({
                            ...s,
                            milestones: { ...s.milestones, [`${week}-${i}`]: { label: m, done: !!v } },
                          }));
                        }}
                      />
                      <Label htmlFor={`dash-m-${i}`} className="text-slate-800 cursor-pointer">
                        {m}
                      </Label>
                    </li>
                  ))
                ) : (
                  <p className="text-slate-600">Enter a birthdate to personalize milestones.</p>
                )}
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="font-semibold text-slate-900 mb-2">Recommended Play Ideas</h3>
              <div className="grid md:grid-cols-2 gap-3">
                {currentActivities.map((a, i) => (
                  <div key={i} className="p-3 rounded-xl bg-sky-50 border border-sky-100 text-slate-800">
                    • {a}
                  </div>
                ))}
                {!currentActivities.length && (
                  <p className="text-slate-600">Activities will appear after you set a birthdate.</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" /> Toy Recommendations
              </h3>
              <div className="text-slate-700 mb-3">
                Skill focus:{" "}
                {currentSkills.length ? (
                  currentSkills.map((s) => <SkillPill key={s} label={s} />)
                ) : (
                  <span className="text-slate-600">—</span>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {DEMO_SHOP_PRODUCTS.filter((p) => week >= p.ageFromW && week <= p.ageToW)
                  .filter((p) => (currentSkills.length ? p.skillTags?.some((t) => currentSkills.includes(t)) : true))
                  .slice(0, 4)
                  .map((p) => (
                    <ProductCard
                      key={p.id}
                      title={p.name}
                      subtitle={p.description}
                      price={money(p.price)}
                      tags={p.skillTags}
                      saved={state.saved.some((x) => x.kind === "shop" && x.id === p.id)}
                      onSave={() => {
                        setState((s) => ({
                          ...s,
                          saved: s.saved.some((x) => x.kind === "shop" && x.id === p.id)
                            ? s.saved.filter((x) => !(x.kind === "shop" && x.id === p.id))
                            : [...s.saved, { kind: "shop", id: p.id }],
                        }));
                      }}
                      onAdd={() => {
                        setState((s) => {
                          const existing = s.cart.find((c) => c.kind === "shop" && c.id === p.id);
                          return {
                            ...s,
                            cart: existing
                              ? s.cart.map((c) =>
                                  c.kind === "shop" && c.id === p.id ? { ...c, qty: c.qty + 1 } : c
                                )
                              : [...s.cart, { kind: "shop", id: p.id, qty: 1 }],
                          };
                        });
                      }}
                      note="Demo"
                    />
                  ))}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-white to-rose-50 rounded-2xl p-4 border border-rose-100">
            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" /> Quick Setup
            </h3>
            <div className="space-y-3">
              <div>
                <Label className="text-slate-700">Baby Name</Label>
                <Input
                  placeholder="e.g., Harper"
                  value={state.profile.babyName}
                  onChange={(e) => setState((s) => ({ ...s, profile: { ...s.profile, babyName: e.target.value } }))}
                />
              </div>
              <div>
                <Label className="text-slate-700">Birthdate</Label>
                <Input
                  type="date"
                  value={state.profile.birthdate}
                  onChange={(e) => setState((s) => ({ ...s, profile: { ...s.profile, birthdate: e.target.value } }))}
                />
              </div>
              <div>
                <Label className="text-slate-700">Sex</Label>
                <Select
                  value={state.profile.sex}
                  onValueChange={(v) => setState((s) => ({ ...s, profile: { ...s.profile, sex: v } }))}
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="unspecified">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-700">Parent/Caregiver</Label>
                <Input
                  placeholder="Your name"
                  value={state.profile.parentName}
                  onChange={(e) => setState((s) => ({ ...s, profile: { ...s.profile, parentName: e.target.value } }))}
                />
              </div>
            </div>

            <div className="mt-6">
              <h4 className="font-semibold text-slate-900 mb-2">Cart</h4>
              <CartMini state={state} setState={setState} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatBox({ label, value, icon }) {
  return (
    <div className="rounded-2xl p-4 bg-white border flex items-center gap-4">
      <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">{icon}</div>
      <div>
        <div className="text-slate-500 text-sm">{label}</div>
        <div className="font-bold text-slate-900 text-xl">{value}</div>
      </div>
    </div>
  );
}

function SkillPill({ label }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 border text-xs text-slate-800 mr-2">
      <Tag className="w-3 h-3" /> {label}
    </span>
  );
}

function ProductCard({ title, subtitle, price, tags = [], onAdd, onSave, saved, note }) {
  return (
    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-slate-700">{subtitle}</div>
          {!!tags?.length && (
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((t) => (
                <SkillPill key={t} label={t} />
              ))}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="font-bold">{price}</div>
          {note && <div className="text-xs text-slate-600">({note})</div>}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={onAdd}>
          Add
        </Button>
        <Button variant="outline" onClick={onSave}>
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// =====================
// Milestones
// =====================
function MilestonesTab({ state, setState, week }) {
  const [newMilestone, setNewMilestone] = useState("");
  const weekMilestones = getMilestonesForWeek(week);

  const addCustom = () => {
    if (!newMilestone.trim()) return;
    const entry = { id: crypto.randomUUID(), week, text: newMilestone.trim() };
    setState((s) => ({ ...s, customMilestones: [entry, ...s.customMilestones] }));
    setNewMilestone("");
  };

  const toggle = (key, label, value) => {
    setState((s) => ({ ...s, milestones: { ...s.milestones, [key]: { label, done: value } } }));
  };

  return (
    <Card className="shadow-xl rounded-2xl border-0 bg-white/80">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ListChecks className="w-5 h-5" /> Weekly Milestones ({ageStringFromWeeks(week)})
          </h2>
        </div>
        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-sky-50 border border-sky-100">
            <h3 className="font-semibold text-slate-900 mb-2">Typical</h3>
            <ul className="space-y-2">
              {weekMilestones.map((m, i) => {
                const key = `${week}-typ-${i}`;
                const done = !!state.milestones[key]?.done;
                return (
                  <li key={key} className="flex items-start gap-3">
                    <Checkbox id={key} checked={done} onCheckedChange={(v) => toggle(key, m, !!v)} />
                    <Label htmlFor={key} className="text-slate-800 cursor-pointer">
                      {m}
                    </Label>
                  </li>
                );
              })}
              {!weekMilestones.length && <p className="text-slate-600">Set a birthdate in Dashboard.</p>}
            </ul>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100">
            <h3 className="font-semibold text-slate-900 mb-2">Custom for This Week</h3>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Add custom milestone"
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
              />
              <Button onClick={addCustom}>Add</Button>
            </div>
            <ul className="space-y-2">
              {state.customMilestones
                .filter((c) => c.week === week)
                .map((c) => {
                  const key = `cust-${c.id}`;
                  const done = !!state.milestones[key]?.done;
                  return (
                    <li key={c.id} className="flex items-start gap-3">
                      <Checkbox id={key} checked={done} onCheckedChange={(v) => toggle(key, c.text, !!v)} />
                      <Label htmlFor={key} className="text-slate-800 cursor-pointer">
                        {c.text}
                      </Label>
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =====================
// Activities
// =====================
function ActivitiesTab({ state, setState, week }) {
  const ideas = getActivitiesForWeek(week);
  const skills = getSkillsForWeek(week);

  return (
    <Card className="shadow-xl rounded-2xl border-0 bg-white/80">
      <CardContent className="p-4 md:p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Activities ({ageStringFromWeeks(week)})</h2>
        <p className="text-slate-700 mb-4">Age-appropriate play ideas.</p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ideas.map((a, i) => (
            <div key={i} className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-slate-800">
              {a}
            </div>
          ))}
        </div>

        <div className="mt-8">
          <h3 className="font-semibold text-slate-900 mb-2">Educational Toys</h3>
          <div className="text-slate-700 mb-3">
            Skill focus: {skills.length ? skills.map((s) => <SkillPill key={s} label={s} />) : "—"}
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {DEMO_SHOP_PRODUCTS.filter((p) => week >= p.ageFromW && week <= p.ageToW)
              .filter((p) => (skills.length ? p.skillTags?.some((t) => skills.includes(t)) : true))
              .slice(0, 6)
              .map((p) => (
                <ProductCard
                  key={p.id}
                  title={p.name}
                  subtitle={p.description}
                  price={money(p.price)}
                  tags={p.skillTags}
                  saved={state.saved.some((x) => x.kind === "shop" && x.id === p.id)}
                  onSave={() => {
                    setState((s) => ({
                      ...s,
                      saved: s.saved.some((x) => x.kind === "shop" && x.id === p.id)
                        ? s.saved.filter((x) => !(x.kind === "shop" && x.id === p.id))
                        : [...s.saved, { kind: "shop", id: p.id }],
                    }));
                  }}
                  onAdd={() => {
                    setState((s) => {
                      const existing = s.cart.find((c) => c.kind === "shop" && c.id === p.id);
                      return {
                        ...s,
                        cart: existing
                          ? s.cart.map((c) => (c.kind === "shop" && c.id === p.id ? { ...c, qty: c.qty + 1 } : c))
                          : [...s.cart, { kind: "shop", id: p.id, qty: 1 }],
                      };
                    });
                  }}
                  note="Demo"
                />
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =====================
// Journal with AI Book Generation
// =====================
function JournalTab({ state, setState, week, username }) {
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [photos, setPhotos] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [bookContent, setBookContent] = useState("");

  async function onPhotoChange(e) {
    const files = Array.from(e.target.files || []);
    const base64s = await Promise.all(files.map(fileToBase64));
    setPhotos((p) => [...p, ...base64s]);
  }

  const addEntry = () => {
    if (!title.trim() && !story.trim() && !photos.length) return;
    const entry = {
      id: crypto.randomUUID(),
      week,
      dateISO: new Date().toISOString(),
      title: title.trim() || `Week ${week} check-in`,
      story: story.trim(),
      photos,
    };
    setState((s) => ({ ...s, journal: [entry, ...s.journal] }));
    setTitle("");
    setStory("");
    setPhotos([]);
  };

  const generateBook = async () => {
    if (state.journal.length === 0) {
      alert("You need journal entries to generate a book!");
      return;
    }

    setGenerating(true);
    setBookContent("");

    try {
      // Prepare journal content for AI
      const journalText = state.journal
        .map((entry) => {
          return `Week ${entry.week} (${ageStringFromWeeks(entry.week)}): ${entry.title}\n${entry.story || "(no story)"}`;
        })
        .join("\n\n");

      const prompt = `You are a creative writer specializing in baby memory books. Based on these journal entries from a parent tracking their baby's first year, write a beautiful, heartwarming narrative story that captures the journey. Make it emotional, personal, and suitable for a keepsake book.

Baby's name: ${state.profile.babyName || "Baby"}
Parent: ${state.profile.parentName || "Parent"}

Journal Entries:
${journalText}

Write a cohesive narrative (500-800 words) that weaves these moments into a touching story about watching this baby grow. Include specific milestones and memories mentioned. Make it sound like a loving parent reflecting on their child's first year.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();
      
      if (data.content && data.content[0] && data.content[0].text) {
        setBookContent(data.content[0].text);
      } else {
        throw new Error("No content in response");
      }
    } catch (error) {
      console.error("Book generation error:", error);
      alert("Failed to generate book. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadBook = () => {
    if (!bookContent) return;

    const fullBook = `
# ${state.profile.babyName || "Baby"}'s First Year
### A Story of Love and Growth

${bookContent}

---

*This book was created from journal entries by ${state.profile.parentName || "Parent"}*
    `.trim();

    const blob = new Blob([fullBook], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.profile.babyName || "baby"}-first-year-book.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="shadow-xl rounded-2xl border-0 bg-white/80 lg:col-span-1">
        <CardContent className="p-4 md:p-6 space-y-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Camera className="w-5 h-5" /> New Check-In
          </h2>
          <div>
            <Label className="text-slate-700">Title</Label>
            <Input placeholder="First giggles!" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label className="text-slate-700">Story</Label>
            <Textarea
              rows={6}
              placeholder="Write a memory…"
              value={story}
              onChange={(e) => setStory(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-slate-700">Photos</Label>
            <Input type="file" accept="image/*" multiple onChange={onPhotoChange} />
            <div className="mt-2 grid grid-cols-4 gap-2">
              {photos.map((src, i) => (
                <img key={i} src={src} alt="preview" className="w-full h-20 object-cover rounded-xl border" />
              ))}
            </div>
          </div>
          <Button onClick={addEntry} className="bg-sky-600 hover:bg-sky-700 w-full">
            Save Check-In
          </Button>

          <div className="pt-4 border-t">
            <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <BookOpen className="w-5 h-5" /> AI Book Generator
            </h3>
            <p className="text-sm text-slate-600 mb-3">
              Create a beautiful narrative story from your journal entries using AI
            </p>
            <Button
              onClick={generateBook}
              disabled={generating || state.journal.length === 0}
              className="w-full bg-fuchsia-600 hover:bg-fuchsia-700"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Book
                </>
              )}
            </Button>
            {state.journal.length === 0 && (
              <p className="text-xs text-slate-500 mt-2">Add journal entries first</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2 space-y-4">
        {bookContent && (
          <Card className="rounded-2xl border-0 bg-gradient-to-br from-amber-50 to-white shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-6 h-6" />
                  Your AI-Generated Book
                </h3>
                <Button onClick={downloadBook} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
              <div className="prose prose-slate max-w-none">
                <div className="whitespace-pre-wrap text-slate-800 leading-relaxed">
                  {bookContent}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <h3 className="text-lg font-bold text-slate-900">Journal Entries</h3>
        {state.journal.length ? (
          state.journal.map((entry) => (
            <Card key={entry.id} className="rounded-2xl border-0 bg-white/90 shadow">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-lg">{entry.title}</h3>
                  <div className="text-slate-500 text-sm">{new Date(entry.dateISO).toLocaleString()}</div>
                </div>
                <div className="text-slate-700 mt-1">
                  Week {entry.week} • {ageStringFromWeeks(entry.week)}
                </div>
                {entry.story && <p className="text-slate-800 mt-3 whitespace-pre-wrap">{entry.story}</p>}
                {entry.photos?.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {entry.photos.map((src, i) => (
                      <img key={i} src={src} alt="journal" className="w-full h-32 object-cover rounded-xl border" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <EmptyState
            icon={<ImageIcon className="w-6 h-6" />}
            title="No check-ins yet"
            subtitle="Add your first memory"
          />
        )}
      </div>
    </div>
  );
}

// =====================
// Marketplace
// =====================
function MarketplaceTab({ state, setState, sharedData, setSharedData, week, skills, username }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");

  const shop = useMemo(() => {
    return DEMO_SHOP_PRODUCTS.filter((p) => week >= p.ageFromW && week <= p.ageToW)
      .filter((p) => (skills?.length ? p.skillTags?.some((t) => skills.includes(t)) : true))
      .filter((p) => (q ? `${p.name} ${p.description}`.toLowerCase().includes(q.toLowerCase()) : true));
  }, [week, skills, q]);

  const communityAll = useMemo(() => {
    return sharedData.listings
      .filter((l) => (category === "All" ? true : l.category === category))
      .filter((l) => (q ? `${l.title} ${l.city} ${l.seller}`.toLowerCase().includes(q.toLowerCase()) : true));
  }, [sharedData.listings, category, q]);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="rounded-2xl border-0 bg-white/80 shadow lg:col-span-2">
        <CardContent className="p-4 md:p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Store className="w-5 h-5" /> Marketplace
          </h2>

          <Tabs defaultValue="shop" className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="shop">Curated Shop</TabsTrigger>
              <TabsTrigger value="community">Community</TabsTrigger>
            </TabsList>

            <div className="mt-4 flex flex-col md:flex-row gap-2">
              <Input
                className="flex-1 bg-white"
                placeholder="Search…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-white w-full md:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Categories</SelectItem>
                  <SelectItem value="Clothes">Clothes</SelectItem>
                  <SelectItem value="Toys">Toys</SelectItem>
                  <SelectItem value="Books">Books</SelectItem>
                  <SelectItem value="Gear">Gear</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <TabsContent value="shop" className="mt-4">
              <div className="grid md:grid-cols-2 gap-3">
                {shop.map((p) => (
                  <ProductCard
                    key={p.id}
                    title={p.name}
                    subtitle={p.description}
                    price={money(p.price)}
                    tags={p.skillTags}
                    saved={state.saved.some((x) => x.kind === "shop" && x.id === p.id)}
                    onSave={() => {
                      setState((s) => ({
                        ...s,
                        saved: s.saved.some((x) => x.kind === "shop" && x.id === p.id)
                          ? s.saved.filter((x) => !(x.kind === "shop" && x.id === p.id))
                          : [...s.saved, { kind: "shop", id: p.id }],
                      }));
                    }}
                    onAdd={() => {
                      setState((s) => {
                        const existing = s.cart.find((c) => c.kind === "shop" && c.id === p.id);
                        return {
                          ...s,
                          cart: existing
                            ? s.cart.map((c) => (c.kind === "shop" && c.id === p.id ? { ...c, qty: c.qty + 1 } : c))
                            : [...s.cart, { kind: "shop", id: p.id, qty: 1 }],
                        };
                      });
                    }}
                    note="Demo"
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="community" className="mt-4">
              <div className="grid md:grid-cols-2 gap-3">
                {communityAll.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    saved={state.saved.some((x) => x.kind === "community" && x.id === l.id)}
                    onSave={() => {
                      setState((s) => ({
                        ...s,
                        saved: s.saved.some((x) => x.kind === "community" && x.id === l.id)
                          ? s.saved.filter((x) => !(x.kind === "community" && x.id === l.id))
                          : [...s.saved, { kind: "community", id: l.id }],
                      }));
                    }}
                    onAdd={() => {
                      setState((s) => {
                        const existing = s.cart.find((c) => c.kind === "community" && c.id === l.id);
                        return {
                          ...s,
                          cart: existing
                            ? s.cart.map((c) =>
                                c.kind === "community" && c.id === l.id ? { ...c, qty: c.qty + 1 } : c
                              )
                            : [...s.cart, { kind: "community", id: l.id, qty: 1 }],
                        };
                      });
                    }}
                  />
                ))}
                {!communityAll.length && (
                  <EmptyState icon={<Users className="w-6 h-6" />} title="No listings" subtitle="Be the first to post!" />
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="rounded-2xl border-0 bg-white/80 shadow">
          <CardContent className="p-4 md:p-6">
            <h3 className="font-bold text-slate-900 mb-3">Cart</h3>
            <CartMini state={state} setState={setState} showCheckout />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 bg-white/80 shadow">
          <CardContent className="p-4 md:p-6">
            <h3 className="font-bold text-slate-900 mb-3">Create Listing</h3>
            <CreateListing
              sharedData={sharedData}
              setSharedData={setSharedData}
              username={username}
              city={state.playdateProfile.city}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ListingCard({ listing, onAdd, onSave, saved }) {
  return (
    <div className="p-4 rounded-2xl bg-white border shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-900">{listing.title}</div>
          <div className="text-sm text-slate-700">
            {listing.category} • {listing.condition}
          </div>
          <div className="text-sm text-slate-700">
            {listing.city} • By: {listing.seller}
          </div>
        </div>
        <div className="font-bold text-slate-900">{money(listing.price)}</div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button className="bg-sky-600 hover:bg-sky-700" onClick={onAdd}>
          Add
        </Button>
        <Button variant="outline" onClick={onSave}>
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function CreateListing({ sharedData, setSharedData, username, city }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("10");
  const [category, setCategory] = useState("Clothes");
  const [condition, setCondition] = useState("Good");
  const [listingCity, setListingCity] = useState(city || "");

  const add = async () => {
    if (!title.trim()) return;

    const listing = {
      id: `listing-${crypto.randomUUID()}`,
      seller: username,
      city: listingCity.trim() || "Unknown",
      title: title.trim(),
      category,
      condition,
      price: Number(price) || 0,
      ageFromW: 0,
      ageToW: 52,
      photos: [],
    };

    setSharedData((s) => ({
      ...s,
      listings: [listing, ...s.listings],
    }));

    setTitle("");
    setPrice("10");
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Title</Label>
        <Input
          className="bg-white"
          placeholder="e.g., Baby onesies"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Price ($)</Label>
          <Input className="bg-white" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <Label>City</Label>
          <Input className="bg-white" value={listingCity} onChange={(e) => setListingCity(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Clothes">Clothes</SelectItem>
              <SelectItem value="Toys">Toys</SelectItem>
              <SelectItem value="Books">Books</SelectItem>
              <SelectItem value="Gear">Gear</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Condition</Label>
          <Select value={condition} onValueChange={setCondition}>
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Like new">Like new</SelectItem>
              <SelectItem value="Very good">Very good</SelectItem>
              <SelectItem value="Good">Good</SelectItem>
              <SelectItem value="Fair">Fair</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button className="w-full bg-fuchsia-600 hover:bg-fuchsia-700" onClick={add}>
        Post Listing
      </Button>
    </div>
  );
}

function CartMini({ state, setState, showCheckout }) {
  const lines = state.cart
    .map((c) => {
      if (c.kind === "shop") {
        const p = DEMO_SHOP_PRODUCTS.find((x) => x.id === c.id);
        if (!p) return null;
        return { key: `${c.kind}-${c.id}`, name: p.name, price: p.price, qty: c.qty, kind: c.kind, id: c.id };
      }
      return null;
    })
    .filter(Boolean);

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);

  return (
    <div className="space-y-2">
      {lines.length ? (
        <>
          {lines.map((l) => (
            <div key={l.key} className="p-3 rounded-xl bg-white border flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-slate-900 truncate text-sm">{l.name}</div>
                <div className="text-xs text-slate-600">
                  {money(l.price)} × {l.qty}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setState((s) => ({
                      ...s,
                      cart: s.cart
                        .map((c) => (c.kind === l.kind && c.id === l.id ? { ...c, qty: c.qty - 1 } : c))
                        .filter((c) => c.qty > 0),
                    }));
                  }}
                >
                  -
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setState((s) => ({
                      ...s,
                      cart: s.cart.map((c) => (c.kind === l.kind && c.id === l.id ? { ...c, qty: c.qty + 1 } : c)),
                    }));
                  }}
                >
                  +
                </Button>
              </div>
            </div>
          ))}
          <div className="p-3 rounded-xl bg-slate-50 border flex items-center justify-between">
            <div className="text-slate-700">Subtotal</div>
            <div className="font-bold text-slate-900">{money(subtotal)}</div>
          </div>
          {showCheckout && (
            <Button
              className="w-full bg-amber-500 hover:bg-amber-600"
              onClick={() => {
                alert("Demo checkout - in production this connects to Stripe");
                setState((s) => ({ ...s, cart: [] }));
              }}
            >
              Checkout (Demo)
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={() => setState((s) => ({ ...s, cart: [] }))}>
            Clear Cart
          </Button>
        </>
      ) : (
        <div className="text-slate-600 text-sm">Empty cart</div>
      )}
    </div>
  );
}

// =====================
// Playdates
// =====================
function PlaydatesTab({ state, setState, sharedData, setSharedData, username }) {
  const [query, setQuery] = useState("");

  // Update shared playdates when profile changes
  useEffect(() => {
    const myProfile = {
      username,
      displayName: state.profile.parentName || username,
      caregiverRole: state.playdateProfile.caregiverRole,
      city: state.playdateProfile.city,
      values: state.playdateProfile.values,
      interests: state.playdateProfile.interests,
      availability: state.playdateProfile.availability,
    };

    setSharedData((s) => {
      const others = s.playdates.filter((p) => p.username !== username);
      return { ...s, playdates: [myProfile, ...others] };
    });
  }, [state.playdateProfile, state.profile.parentName, username, setSharedData]);

  const filtered = sharedData.playdates
    .filter((p) => p.username !== username)
    .filter(
      (p) =>
        p.city.toLowerCase().includes(query.toLowerCase()) ||
        p.values.some((v) => v.toLowerCase().includes(query.toLowerCase()))
    );

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="rounded-2xl border-0 bg-white/80 shadow">
        <CardContent className="p-4 md:p-6 space-y-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5" /> Your Profile
          </h2>
          <div>
            <Label>Caregiver Role</Label>
            <Select
              value={state.playdateProfile.caregiverRole}
              onValueChange={(v) =>
                setState((s) => ({ ...s, playdateProfile: { ...s.playdateProfile, caregiverRole: v } }))
              }
            >
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mom">Mom</SelectItem>
                <SelectItem value="Dad">Dad</SelectItem>
                <SelectItem value="Grandparent">Grandparent</SelectItem>
                <SelectItem value="Nanny">Nanny</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>City</Label>
            <Input
              placeholder="e.g., Frisco, TX"
              value={state.playdateProfile.city}
              onChange={(e) =>
                setState((s) => ({ ...s, playdateProfile: { ...s.playdateProfile, city: e.target.value } }))
              }
            />
          </div>
          <div>
            <Label>Values (comma-separated)</Label>
            <Input
              placeholder="Kindness, Faith"
              value={state.playdateProfile.values.join(", ")}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  playdateProfile: {
                    ...s.playdateProfile,
                    values: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                }))
              }
            />
          </div>
          <div>
            <Label>Interests (comma-separated)</Label>
            <Input
              placeholder="Walks, Library"
              value={state.playdateProfile.interests.join(", ")}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  playdateProfile: {
                    ...s.playdateProfile,
                    interests: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                }))
              }
            />
          </div>
          <div>
            <Label>Availability</Label>
            <Select
              value={state.playdateProfile.availability}
              onValueChange={(v) =>
                setState((s) => ({ ...s, playdateProfile: { ...s.playdateProfile, availability: v } }))
              }
            >
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Weekdays AM">Weekdays AM</SelectItem>
                <SelectItem value="Weekdays PM">Weekdays PM</SelectItem>
                <SelectItem value="Weekends">Weekends</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2">
        <Card className="rounded-2xl border-0 bg-white/80 shadow">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <h3 className="font-bold text-slate-900 text-lg">Other Parents</h3>
              <Input
                placeholder="Search values or city"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-white md:w-64"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {filtered.map((p) => (
                <div key={p.username} className="p-4 rounded-2xl border bg-gradient-to-br from-sky-50 to-white">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-900">{p.displayName}</div>
                    <div className="text-xs text-slate-600">{p.caregiverRole}</div>
                  </div>
                  <div className="text-slate-700 text-sm mt-1">
                    {p.city} • {p.availability}
                  </div>
                  <div className="mt-2 text-slate-800 text-sm">
                    <span className="font-medium">Values:</span> {p.values.join(", ")}
                  </div>
                  <div className="text-slate-800 text-sm">
                    <span className="font-medium">Interests:</span> {p.interests.join(", ")}
                  </div>
                  <Button
                    className="mt-3 w-full"
                    onClick={() => alert(`In production, this would send a playdate request to ${p.displayName}`)}
                  >
                    Request Playdate
                  </Button>
                </div>
              ))}
              {!filtered.length && (
                <EmptyState icon={<Users className="w-6 h-6" />} title="No matches" subtitle="Try adjusting search" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// =====================
// Settings
// =====================
function SettingsTab({ state, setState }) {
  return (
    <Card className="rounded-2xl border-0 bg-white/80 shadow">
      <CardContent className="p-4 md:p-6 space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Settings</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Theme</Label>
            <Select
              value={state.preferences.theme}
              onValueChange={(v) => setState((s) => ({ ...s, preferences: { ...s.preferences, theme: v } }))}
            >
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pastel">Pastel</SelectItem>
                <SelectItem value="bright">Bright</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Contact Email</Label>
            <Input
              placeholder="your@email.com"
              value={state.preferences.contactEmail}
              onChange={(e) => setState((s) => ({ ...s, preferences: { ...s.preferences, contactEmail: e.target.value } }))}
            />
          </div>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg text-sm text-slate-700">
          <strong>Multi-User Testing Mode:</strong> All users share marketplace listings and can see each other's playdate profiles. Your personal data (milestones, journal) is private to your account.
        </div>
      </CardContent>
    </Card>
  );
}

// =====================
// Shared UI
// =====================
function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="p-6 rounded-2xl border bg-white/70 text-center">
      <div className="p-3 rounded-full bg-slate-100 text-slate-700 mb-2 inline-block">{icon}</div>
      <div className="font-semibold text-slate-800">{title}</div>
      <div className="text-slate-600 text-sm">{subtitle}</div>
    </div>
  );
}
