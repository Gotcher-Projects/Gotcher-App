export const MILESTONES = {
  0:  ["Turns toward voices", "Lifts head during tummy time", "High contrast patterns"],
  4:  ["Social smiling", "Tracks objects side to side", "Brings hands to mouth"],
  8:  ["Coos and babbles", "Better head control", "Kicks and stretches"],
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

export const ACTIVITIES = {
  0:  ["Skin-to-skin cuddles and gentle talking", "High-contrast black/white cards (2-3 min sessions)", "Tummy time 1-2 minutes, several times daily", "Soft music and singing"],
  8:  ["Mirror play with facial expressions", "Tummy time with rolled towel support", "Rattles and crinkle books to grasp", "Gentle massage and stretching"],
  16: ["Reach-and-grab games with colorful toys", "Name recognition games", "Rolling practice with toys just out of reach", "Texture exploration with safe fabrics"],
  24: ["Sit-and-stack cups or blocks", "Hand-to-hand object transfers", "Nursery rhymes with hand motions", "Simple cause-and-effect toys"],
  32: ["Crawl obstacle courses with pillows", "Peek-a-boo and hide-and-find games", "Imitation games (clapping, waving)", "Container play (in and out)"],
  40: ["Cruising practice along furniture", "Shape sorter and simple puzzles", "Wave, clap, and simple sign language", "Push/pull toys for walking practice"]
};

export const VACCINES = {
  birth: [
    "Hepatitis B (HepB) — 1st dose",
  ],
  "2m": [
    "Hepatitis B (HepB) — 2nd dose",
    "Rotavirus (RV) — 1st dose",
    "Diphtheria/Tetanus/Pertussis (DTaP) — 1st dose",
    "Haemophilus influenzae type b (Hib) — 1st dose",
    "Pneumococcal (PCV15/PCV20) — 1st dose",
    "Inactivated Poliovirus (IPV) — 1st dose",
  ],
  "4m": [
    "Rotavirus (RV) — 2nd dose",
    "Diphtheria/Tetanus/Pertussis (DTaP) — 2nd dose",
    "Haemophilus influenzae type b (Hib) — 2nd dose",
    "Pneumococcal (PCV15/PCV20) — 2nd dose",
    "Inactivated Poliovirus (IPV) — 2nd dose",
  ],
  "6m": [
    "Hepatitis B (HepB) — 3rd dose",
    "Rotavirus (RV) — 3rd dose",
    "Diphtheria/Tetanus/Pertussis (DTaP) — 3rd dose",
    "Haemophilus influenzae type b (Hib) — 3rd dose",
    "Pneumococcal (PCV15/PCV20) — 3rd dose",
    "Inactivated Poliovirus (IPV) — 3rd dose",
    "Influenza (Flu) — annual, 1st dose",
  ],
  "12m": [
    "Measles/Mumps/Rubella (MMR) — 1st dose",
    "Varicella (VAR) — 1st dose",
    "Hepatitis A (HepA) — 1st dose",
    "Pneumococcal (PCV15/PCV20) — 4th dose",
    "Haemophilus influenzae type b (Hib) — 4th dose",
  ],
  "15m": [
    "Diphtheria/Tetanus/Pertussis (DTaP) — 4th dose",
  ],
  "18m": [
    "Hepatitis A (HepA) — 2nd dose",
    "Influenza (Flu) — annual booster",
  ],
};

export const PRODUCTS = {
  0: [
    { name: "High-Contrast Cards Set",    price: 12.99, reason: "Supports early visual development" },
    { name: "Soft Play Mat",              price: 39.99, reason: "Safe space for tummy time" },
    { name: "White Noise Machine",        price: 24.99, reason: "Helps with sleep" },
    { name: "Swaddle Blankets (3-pack)",  price: 19.99, reason: "Comfort and security" }
  ],
  8: [
    { name: "Baby Mirror (tummy time)",   price: 14.99, reason: "Encourages neck strength & visual tracking" },
    { name: "Soft Rattles Set",           price: 16.99, reason: "Develops grasp reflex" },
    { name: "Crinkle Books",              price: 11.99, reason: "Sensory stimulation" },
    { name: "Activity Gym",              price: 49.99, reason: "Multiple sensory experiences" }
  ],
  16: [
    { name: "Soft Stacking Rings",        price: 13.99, reason: "Hand-eye coordination" },
    { name: "Teething Toys Set",          price: 18.99, reason: "Soothes gums, safe to mouth" },
    { name: "Rolling Ball Toy",           price: 15.99, reason: "Encourages reaching and rolling" },
    { name: "Textured Sensory Balls",     price: 19.99, reason: "Tactile exploration" }
  ],
  24: [
    { name: "Stacking Cups",             price: 12.99, reason: "Problem-solving & nesting skills" },
    { name: "Soft Building Blocks",       price: 24.99, reason: "Hand coordination & spatial awareness" },
    { name: "Pop-up Toy",                price: 21.99, reason: "Cause-and-effect learning" },
    { name: "Musical Instruments Set",    price: 29.99, reason: "Sound exploration & rhythm" }
  ],
  32: [
    { name: "Crawl-Through Tunnel",       price: 34.99, reason: "Encourages mobility & exploration" },
    { name: "Ball Pit Balls (50-pack)",   price: 22.99, reason: "Sensory play & motor skills" },
    { name: "Stacking Blocks (large)",    price: 27.99, reason: "Building & knocking down fun" },
    { name: "Baby Drum Set",             price: 32.99, reason: "Rhythm & hand-eye coordination" }
  ],
  40: [
    { name: "Push Walker Toy",            price: 44.99, reason: "Supports first steps" },
    { name: "Shape Sorter House",         price: 26.99, reason: "Problem-solving & fine motor skills" },
    { name: "Nesting Dolls",             price: 18.99, reason: "Size recognition & dexterity" },
    { name: "Simple Puzzle Set",          price: 19.99, reason: "Cognitive development & pincer grasp" }
  ]
};
