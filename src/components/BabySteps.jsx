import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Baby, Camera, Loader2, BookOpen, Sparkles, ShoppingBag, Users, CheckCircle2, Heart, Mail, Phone, MapPin, Package } from "lucide-react";

// Storage
function save(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
}

function load(key) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
}

// Convert image to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Milestones
const MILESTONES = {
  0: ["Turns toward voices", "Lifts head during tummy time", "High contrast patterns"],
  4: ["Social smiling", "Tracks objects side to side", "Brings hands to mouth"],
  8: ["Coos and babbles", "Better head control", "Kicks and stretches"],
  12: ["Laughs out loud", "Holds head steady", "Grasps toys and shakes them"],
  16: ["Rolls tummy to back", "Reaches for objects", "Brings feet to hands"],
  20: ["Rolls both ways", "Responds to name", "Babbles ba-da sounds"],
  24: ["Sits with support", "Transfers objects hand to hand", "Explores with mouth"],
  28: ["Sits without support", "Bears weight on legs", "Object permanence begins"],
  32: ["Army crawls or pivots", "Stranger awareness", "Imitates sounds"],
  36: ["Crawls on hands/knees", "Pulls to stand", "Plays peek-a-boo"],
  40: ["Cruises along furniture", "Pincer grasp", "Says mama/dada"],
  44: ["Stands alone briefly", "Understands gestures", "Drops objects on purpose"],
  48: ["Takes first steps", "Says 1-2 words with meaning", "Claps and waves"]
};

const ACTIVITIES = {
  0: ["Skin-to-skin cuddles and gentle talking", "High-contrast black/white cards (2-3 min sessions)", "Tummy time 1-2 minutes, several times daily", "Soft music and singing"],
  8: ["Mirror play with facial expressions", "Tummy time with rolled towel support", "Rattles and crinkle books to grasp", "Gentle massage and stretching"],
  16: ["Reach-and-grab games with colorful toys", "Name recognition games", "Rolling practice with toys just out of reach", "Texture exploration with safe fabrics"],
  24: ["Sit-and-stack cups or blocks", "Hand-to-hand object transfers", "Nursery rhymes with hand motions", "Simple cause-and-effect toys"],
  32: ["Crawl obstacle courses with pillows", "Peek-a-boo and hide-and-find games", "Imitation games (clapping, waving)", "Container play (in and out)"],
  40: ["Cruising practice along furniture", "Shape sorter and simple puzzles", "Wave, clap, and simple sign language", "Push/pull toys for walking practice"]
};

// Age-appropriate products to recommend
const PRODUCTS = {
  0: [
    { name: "High-Contrast Cards Set", price: 12.99, reason: "Supports early visual development" },
    { name: "Soft Play Mat", price: 39.99, reason: "Safe space for tummy time" },
    { name: "White Noise Machine", price: 24.99, reason: "Helps with sleep" },
    { name: "Swaddle Blankets (3-pack)", price: 19.99, reason: "Comfort and security" }
  ],
  8: [
    { name: "Baby Mirror (tummy time)", price: 14.99, reason: "Encourages neck strength & visual tracking" },
    { name: "Soft Rattles Set", price: 16.99, reason: "Develops grasp reflex" },
    { name: "Crinkle Books", price: 11.99, reason: "Sensory stimulation" },
    { name: "Activity Gym", price: 49.99, reason: "Multiple sensory experiences" }
  ],
  16: [
    { name: "Soft Stacking Rings", price: 13.99, reason: "Hand-eye coordination" },
    { name: "Teething Toys Set", price: 18.99, reason: "Soothes gums, safe to mouth" },
    { name: "Rolling Ball Toy", price: 15.99, reason: "Encourages reaching and rolling" },
    { name: "Textured Sensory Balls", price: 19.99, reason: "Tactile exploration" }
  ],
  24: [
    { name: "Stacking Cups", price: 12.99, reason: "Problem-solving & nesting skills" },
    { name: "Soft Building Blocks", price: 24.99, reason: "Hand coordination & spatial awareness" },
    { name: "Pop-up Toy", price: 21.99, reason: "Cause-and-effect learning" },
    { name: "Musical Instruments Set", price: 29.99, reason: "Sound exploration & rhythm" }
  ],
  32: [
    { name: "Crawl-Through Tunnel", price: 34.99, reason: "Encourages mobility & exploration" },
    { name: "Ball Pit Balls (50-pack)", price: 22.99, reason: "Sensory play & motor skills" },
    { name: "Stacking Blocks (large)", price: 27.99, reason: "Building & knocking down fun" },
    { name: "Baby Drum Set", price: 32.99, reason: "Rhythm & hand-eye coordination" }
  ],
  40: [
    { name: "Push Walker Toy", price: 44.99, reason: "Supports first steps" },
    { name: "Shape Sorter House", price: 26.99, reason: "Problem-solving & fine motor skills" },
    { name: "Nesting Dolls", price: 18.99, reason: "Size recognition & dexterity" },
    { name: "Simple Puzzle Set", price: 19.99, reason: "Cognitive development & pincer grasp" }
  ]
};

// Demo playdate profiles
const DEMO_PROFILES = [
  { name: "Sarah M.", city: "Frisco, TX", values: "Faith, Kindness", interests: "Park walks, Library", phone: "555-0123" },
  { name: "Mike R.", city: "Plano, TX", values: "Patience, Outdoor time", interests: "Music class, Swimming", phone: "555-0124" },
  { name: "Emma L.", city: "McKinney, TX", values: "Kindness, Low-screen", interests: "Storytime, Art projects", phone: "555-0125" },
  { name: "David K.", city: "Prosper, TX", values: "Faith, Family time", interests: "Gym class, Nature walks", phone: "555-0126" },
];

function getWeek(birthdate) {
  if (!birthdate) return 0;
  const diff = Date.now() - new Date(birthdate).getTime();
  return Math.max(0, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)));
}

function getMilestones(week) {
  const key = Math.floor(week / 4) * 4;
  return MILESTONES[key] || [];
}

function getActivities(week) {
  const key = Math.floor(week / 8) * 8;
  return ACTIVITIES[key] || [];
}

function getProducts(week) {
  const key = Math.floor(week / 8) * 8;
  return PRODUCTS[key] || [];
}

export default function App() {
  const [data, setData] = useState({
    profile: { 
      name: "", 
      birthdate: "", 
      parentName: "",
      email: "",
      phone: ""
    },
    playdateProfile: { 
      city: "", 
      values: "", 
      interests: "" 
    },
    milestones: {},
    journal: [],
    marketplace: []
  });

  useEffect(() => {
    const saved = load("babyStepsData");
    if (saved) setData(saved);
  }, []);

  useEffect(() => {
    save("babyStepsData", data);
  }, [data]);

  const week = getWeek(data.profile.birthdate);
  const months = Math.floor(week / 4.345);
  const milestones = getMilestones(week);
  const activities = getActivities(week);
  const products = getProducts(week);

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-sky-50 to-emerald-50 p-4">
      <header className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center gap-3">
          <Baby className="w-12 h-12 text-fuchsia-600" />
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-600 via-sky-600 to-emerald-600">
              Baby Steps
            </h1>
            <p className="text-sm text-slate-600">Milestone tracker • Journal • AI Book • Marketplace • Playdates</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="w-full h-auto flex-wrap justify-start gap-2 bg-white/70 p-2">
            <TabsTrigger value="dashboard" className="flex-1 min-w-[100px]">Dashboard</TabsTrigger>
            <TabsTrigger value="milestones" className="flex-1 min-w-[100px]">Milestones</TabsTrigger>
            <TabsTrigger value="journal" className="flex-1 min-w-[100px]">Journal</TabsTrigger>
            <TabsTrigger value="marketplace" className="flex-1 min-w-[100px]">Marketplace</TabsTrigger>
            <TabsTrigger value="playdates" className="flex-1 min-w-[100px]">Playdates</TabsTrigger>
            <TabsTrigger value="activities" className="flex-1 min-w-[100px]">Activities</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <DashboardTab data={data} setData={setData} week={week} months={months} milestones={milestones} />
          </TabsContent>

          <TabsContent value="milestones" className="mt-4">
            <MilestonesTab data={data} setData={setData} week={week} milestones={milestones} />
          </TabsContent>

          <TabsContent value="journal" className="mt-4">
            <JournalTab data={data} setData={setData} week={week} />
          </TabsContent>

          <TabsContent value="marketplace" className="mt-4">
            <MarketplaceTab data={data} setData={setData} />
          </TabsContent>

          <TabsContent value="playdates" className="mt-4">
            <PlaydatesTab data={data} setData={setData} />
          </TabsContent>

          <TabsContent value="activities" className="mt-4">
            <ActivitiesTab 
              activities={activities} 
              products={products}
              week={week} 
              months={months}
              birthdate={data.profile.birthdate}
              babyName={data.profile.name}
            />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="max-w-6xl mx-auto mt-8 text-center text-sm text-slate-600">
        <p>Demo MVP • Not medical advice • Every baby develops uniquely</p>
      </footer>
    </div>
  );
}

function DashboardTab({ data, setData, week, months, milestones }) {
  return (
    <Card className="shadow-xl rounded-2xl">
      <CardContent className="p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Sparkles className="w-6 h-6" />
          Welcome! Baby is {months} months old ({week} weeks)
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Profile Setup</h3>
            <div>
              <Label>Baby's Name</Label>
              <Input
                value={data.profile.name}
                onChange={(e) => setData(d => ({
                  ...d,
                  profile: { ...d.profile, name: e.target.value }
                }))}
                placeholder="e.g., Harper"
                className="bg-white"
              />
            </div>
            <div>
              <Label>Birthdate</Label>
              <Input
                type="date"
                value={data.profile.birthdate}
                onChange={(e) => setData(d => ({
                  ...d,
                  profile: { ...d.profile, birthdate: e.target.value }
                }))}
                className="bg-white"
              />
            </div>
            <div>
              <Label>Your Name</Label>
              <Input
                value={data.profile.parentName}
                onChange={(e) => setData(d => ({
                  ...d,
                  profile: { ...d.profile, parentName: e.target.value }
                }))}
                placeholder="e.g., Sarah"
                className="bg-white"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={data.profile.email}
                onChange={(e) => setData(d => ({
                  ...d,
                  profile: { ...d.profile, email: e.target.value }
                }))}
                placeholder="your@email.com"
                className="bg-white"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                type="tel"
                value={data.profile.phone}
                onChange={(e) => setData(d => ({
                  ...d,
                  profile: { ...d.profile, phone: e.target.value }
                }))}
                placeholder="555-0123"
                className="bg-white"
              />
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">This Week's Milestones</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-white rounded-lg border">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-600 flex-shrink-0" />
                  <span className="text-sm text-slate-700">{m}</span>
                </div>
              ))}
              {!milestones.length && (
                <p className="text-slate-600 p-4 bg-white rounded-lg border text-center">
                  Set a birthdate above to see milestones
                </p>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="p-3 bg-white rounded-lg border text-center">
                <div className="text-2xl font-bold text-fuchsia-600">
                  {Object.keys(data.milestones).filter(k => data.milestones[k]).length}
                </div>
                <div className="text-xs text-slate-600">Milestones</div>
              </div>
              <div className="p-3 bg-white rounded-lg border text-center">
                <div className="text-2xl font-bold text-sky-600">{data.journal.length}</div>
                <div className="text-xs text-slate-600">Memories</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MilestonesTab({ data, setData, week, milestones }) {
  return (
    <Card className="shadow-xl rounded-2xl">
      <CardContent className="p-6">
        <h2 className="text-xl font-bold mb-4">Track Milestones (Week {week})</h2>
        
        {!milestones.length ? (
          <div className="p-8 text-center bg-slate-50 rounded-lg">
            <p className="text-slate-600">Set a birthdate in Dashboard to see milestones</p>
          </div>
        ) : (
          <div className="space-y-3">
            {milestones.map((m, i) => {
              const key = `${week}-${i}`;
              const checked = !!data.milestones[key];
              
              return (
                <div key={key} className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  checked ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'
                }`}>
                  <Checkbox
                    id={key}
                    checked={checked}
                    onCheckedChange={(val) => {
                      setData(d => ({
                        ...d,
                        milestones: { ...d.milestones, [key]: !!val }
                      }));
                    }}
                  />
                  <Label htmlFor={key} className="cursor-pointer flex-1 text-slate-700">
                    {m}
                  </Label>
                  {checked && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JournalTab({ data, setData, week }) {
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [generating, setGenerating] = useState(false);
  const [book, setBook] = useState("");

  const addEntry = () => {
    if (!title && !story) {
      alert("Add a title or story!");
      return;
    }
    
    const entry = {
      id: crypto.randomUUID(),
      week,
      date: new Date().toISOString(),
      title: title || `Week ${week}`,
      story
    };
    
    setData(d => ({ ...d, journal: [entry, ...d.journal] }));
    setTitle("");
    setStory("");
  };

  const generateBook = async () => {
    if (!data.journal.length) {
      alert("Add journal entries first!");
      return;
    }

    setGenerating(true);
    try {
      const entries = data.journal
        .map(e => `Week ${e.week}: ${e.title}\n${e.story || ''}`)
        .join("\n\n");

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Write a beautiful 500-word narrative story about ${data.profile.name || "this baby"}'s first year based on these journal entries:\n\n${entries}\n\nMake it heartwarming and suitable for a keepsake book.`
          }]
        })
      });

      const result = await response.json();
      if (result.content?.[0]?.text) {
        setBook(result.content[0].text);
      }
    } catch (e) {
      alert("Failed to generate book");
    }
    setGenerating(false);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="shadow-xl rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Camera className="w-5 h-5" /> New Entry
          </h2>
          
          <div>
            <Label>Title</Label>
            <Input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="First smile!"
              className="bg-white"
            />
          </div>
          
          <div>
            <Label>Story</Label>
            <Textarea 
              rows={5} 
              value={story} 
              onChange={(e) => setStory(e.target.value)} 
              placeholder="Today was special..."
              className="bg-white"
            />
          </div>
          
          <Button onClick={addEntry} className="w-full bg-sky-600">
            Save Entry
          </Button>

          <div className="pt-4 border-t">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <BookOpen className="w-5 h-5" /> AI Book
            </h3>
            <p className="text-sm text-slate-600 mb-3">
              Generate a story from your entries
            </p>
            <Button
              onClick={generateBook}
              disabled={generating || !data.journal.length}
              className="w-full bg-fuchsia-600"
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Generate Book</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2 space-y-4">
        {book && (
          <Card className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <BookOpen className="w-6 h-6" /> Your Memory Book
              </h3>
              <div className="whitespace-pre-wrap text-slate-800 leading-relaxed">{book}</div>
            </CardContent>
          </Card>
        )}

        <h3 className="text-lg font-bold">Journal Entries</h3>
        
        {!data.journal.length ? (
          <Card><CardContent className="p-8 text-center text-slate-600">
            No entries yet. Add your first memory!
          </CardContent></Card>
        ) : (
          data.journal.map(e => (
            <Card key={e.id}>
              <CardContent className="p-5">
                <h4 className="font-bold text-lg">{e.title}</h4>
                <p className="text-sm text-slate-500 mb-2">
                  Week {e.week} • {new Date(e.date).toLocaleDateString()}
                </p>
                {e.story && <p className="text-slate-700 mt-3 whitespace-pre-wrap">{e.story}</p>}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function MarketplaceTab({ data, setData }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("10");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    const base64Photos = await Promise.all(files.map(f => fileToBase64(f)));
    setPhotos(prev => [...prev, ...base64Photos]);
  };

  const addListing = () => {
    if (!title) {
      alert("Add an item name!");
      return;
    }
    
    const listing = {
      id: crypto.randomUUID(),
      title,
      description,
      price: Number(price) || 0,
      photos: photos,
      seller: data.profile.parentName || "You",
      email: data.profile.email || "",
      phone: data.profile.phone || "",
      date: new Date().toISOString()
    };
    
    setData(d => ({ ...d, marketplace: [listing, ...d.marketplace] }));
    setTitle("");
    setDescription("");
    setPrice("10");
    setPhotos([]);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="shadow-xl rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" /> Create Listing
          </h2>
          
          <div>
            <Label>Item Name</Label>
            <Input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="Baby clothes 0-3mo"
              className="bg-white"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea 
              rows={3}
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Gently used, smoke-free home..."
              className="bg-white"
            />
          </div>
          
          <div>
            <Label>Price ($)</Label>
            <Input 
              type="number"
              value={price} 
              onChange={(e) => setPrice(e.target.value)}
              className="bg-white"
            />
          </div>

          <div>
            <Label>Photos (optional)</Label>
            <Input 
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="bg-white"
            />
            {photos.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {photos.map((photo, i) => (
                  <div key={i} className="relative">
                    <img src={photo} alt={`Preview ${i + 1}`} className="w-full h-20 object-cover rounded border" />
                    <button
                      onClick={() => setPhotos(p => p.filter((_, idx) => idx !== i))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <Button onClick={addListing} className="w-full bg-fuchsia-600">
            Post Listing
          </Button>

          <div className="text-xs text-slate-500 p-2 bg-slate-50 rounded">
            Your contact info from Dashboard will be shown to buyers
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2">
        <Card className="shadow-xl rounded-2xl">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4">My Listings</h2>
            
            {!data.marketplace.length ? (
              <div className="p-8 text-center bg-slate-50 rounded-lg text-slate-600">
                No listings yet. Create your first one!
              </div>
            ) : (
              <div className="space-y-4">
                {data.marketplace.map(l => (
                  <div key={l.id} className="p-4 border-2 rounded-xl bg-white">
                    <div className="flex gap-4">
                      {l.photos && l.photos.length > 0 && (
                        <div className="w-32 h-32 flex-shrink-0">
                          <img 
                            src={l.photos[0]} 
                            alt={l.title}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                      )}
                      
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-bold text-lg">{l.title}</h3>
                            <p className="text-2xl font-bold text-fuchsia-600">${l.price}</p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              if (confirm("Delete this listing?")) {
                                setData(d => ({
                                  ...d,
                                  marketplace: d.marketplace.filter(x => x.id !== l.id)
                                }));
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>

                        {l.description && (
                          <p className="text-slate-700 text-sm mb-3">{l.description}</p>
                        )}

                        <div className="space-y-1 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>Seller: <strong>{l.seller}</strong></span>
                          </div>
                          {l.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4" />
                              <span>{l.email}</span>
                            </div>
                          )}
                          {l.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4" />
                              <span>{l.phone}</span>
                            </div>
                          )}
                          <div className="text-xs text-slate-500 mt-2">
                            Posted {new Date(l.date).toLocaleDateString()}
                          </div>
                        </div>

                        {l.photos && l.photos.length > 1 && (
                          <div className="mt-3 flex gap-2 overflow-x-auto">
                            {l.photos.slice(1).map((photo, i) => (
                              <img 
                                key={i}
                                src={photo} 
                                alt={`${l.title} ${i + 2}`}
                                className="w-20 h-20 object-cover rounded border flex-shrink-0"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PlaydatesTab({ data, setData }) {
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="shadow-xl rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5" /> Your Profile
          </h2>
          
          <div>
            <Label>City</Label>
            <Input
              value={data.playdateProfile?.city || ""}
              onChange={(e) => setData(d => ({
                ...d,
                playdateProfile: { ...d.playdateProfile, city: e.target.value }
              }))}
              placeholder="e.g., Frisco, TX"
              className="bg-white"
            />
          </div>
          
          <div>
            <Label>Your Values</Label>
            <Input
              value={data.playdateProfile?.values || ""}
              onChange={(e) => setData(d => ({
                ...d,
                playdateProfile: { ...d.playdateProfile, values: e.target.value }
              }))}
              placeholder="e.g., Faith, Kindness"
              className="bg-white"
            />
          </div>
          
          <div>
            <Label>Interests</Label>
            <Input
              value={data.playdateProfile?.interests || ""}
              onChange={(e) => setData(d => ({
                ...d,
                playdateProfile: { ...d.playdateProfile, interests: e.target.value }
              }))}
              placeholder="e.g., Park walks, Music"
              className="bg-white"
            />
          </div>

          <div className="p-3 bg-blue-50 rounded-lg text-sm text-slate-700">
            <strong>Note:</strong> This is a demo. In the full version, your profile would be shared with other parents for matching.
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2">
        <Card className="shadow-xl rounded-2xl">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-500" /> 
              Nearby Parents (Demo)
            </h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              {DEMO_PROFILES.map((p, i) => (
                <div key={i} className="p-4 rounded-xl bg-gradient-to-br from-pink-50 to-purple-50 border-2 border-pink-100">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-bold text-lg text-slate-800">{p.name}</div>
                    <div className="text-xs bg-white px-2 py-1 rounded-full text-slate-600 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {p.city}
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-sm text-slate-700 mb-3">
                    <div><strong>Values:</strong> {p.values}</div>
                    <div><strong>Interests:</strong> {p.interests}</div>
                    <div className="flex items-center gap-1 text-slate-600">
                      <Phone className="w-3 h-3" />
                      {p.phone}
                    </div>
                  </div>
                  
                  <Button 
                    size="sm" 
                    className="w-full bg-pink-500 hover:bg-pink-600"
                    onClick={() => alert(`In the full version, you'd send a playdate request to ${p.name}!`)}
                  >
                    Request Playdate
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-amber-50 rounded-lg text-sm text-slate-700">
              <strong>Full version includes:</strong> Real matching by location, baby age, values, interests, availability, and in-app messaging.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ActivitiesTab({ activities, products, week, months, birthdate, babyName }) {
  if (!birthdate) {
    return (
      <Card className="shadow-xl rounded-2xl">
        <CardContent className="p-8 text-center">
          <Baby className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">Set Baby's Birthdate First</h3>
          <p className="text-slate-600">Go to the Dashboard tab and enter a birthdate to see age-appropriate activities and product recommendations!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl rounded-2xl">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-2">Activities for {babyName || "Baby"}</h2>
          <p className="text-slate-600 mb-4">Age: {months} months ({week} weeks)</p>
          
          {!activities.length ? (
            <div className="p-8 text-center bg-slate-50 rounded-lg text-slate-600">
              Loading activities...
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {activities.map((a, i) => (
                <div key={i} className="p-5 rounded-xl bg-gradient-to-br from-sky-50 to-emerald-50 border-2 border-sky-100">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-sky-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-sky-700">{i + 1}</span>
                    </div>
                    <p className="text-slate-700">{a}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-xl rounded-2xl">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <Package className="w-6 h-6" />
            Recommended Products for This Age
          </h2>
          <p className="text-slate-600 mb-4">These toys support your baby's current developmental stage</p>
          
          {!products.length ? (
            <div className="p-8 text-center bg-slate-50 rounded-lg text-slate-600">
              No specific recommendations for this age range yet
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {products.map((p, i) => (
                <div key={i} className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-100">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-800">{p.name}</h3>
                    <span className="text-lg font-bold text-purple-600">${p.price}</span>
                  </div>
                  <p className="text-sm text-slate-700 mb-3">
                    <strong>Why:</strong> {p.reason}
                  </p>
                  <div className="text-xs text-slate-500 bg-white px-2 py-1 rounded">
                    Perfect for {months} month olds
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-slate-700">
              <strong>💡 Tip for Sellers:</strong> These are hot items parents are looking for at this stage! Consider stocking similar products in your marketplace listings.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
