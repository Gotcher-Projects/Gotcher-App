// Weekly "size of your baby" dataset, weeks 4–40.
// length/weight are approximate keepsake figures (single-unit: cm + g) drawn from common fetal
// growth references — not medical guidance. `label` is the comparison object, `art` is an asset
// key for future illustrations, `emoji` is the S2 fallback, `blurb` is the one-line card copy,
// and `detail` is the 2–3 sentence "This week" copy. Copy is original to CradleHQ.
export const PREGNANCY_SIZES = [
  {
    week: 4, label: 'a poppy seed', art: 'poppy-seed', emoji: '🌱', lengthCm: 0.1, weightG: 0,
    blurb: 'Smaller than this sentence’s period, but already busy.',
    detail: "The tiny ball of cells has just settled in and is starting to form the layers that " +
            "become your baby’s body. It’s the very first chapter — and it’s already underway.",
  },
  {
    week: 5, label: 'a sesame seed', art: 'sesame-seed', emoji: '🌱', lengthCm: 0.2, weightG: 0,
    blurb: 'A sesame seed with a heartbeat on the way.',
    detail: "The earliest version of the heart and circulatory system is taking shape this week. " +
            "It’s incredibly small, but the foundations are being laid fast.",
  },
  {
    week: 6, label: 'a lentil', art: 'lentil', emoji: '🫘', lengthCm: 0.4, weightG: 0,
    blurb: 'About the size of a lentil — and the heart is fluttering.',
    detail: "A tiny heart is beginning to beat, often around now. Little buds that will become arms " +
            "and legs are just starting to appear.",
  },
  {
    week: 7, label: 'a blueberry', art: 'blueberry', emoji: '🫐', lengthCm: 1.0, weightG: 1,
    blurb: 'Blueberry-sized, doubling in size week to week.',
    detail: "Your baby is growing quickly and the face is starting to form, with tiny spots where " +
            "the eyes and nose will be. The brain is developing at a remarkable pace.",
  },
  {
    week: 8, label: 'a raspberry', art: 'raspberry', emoji: '🍓', lengthCm: 1.6, weightG: 1,
    blurb: 'Tiny fingers and toes are starting to form.',
    detail: "Webbed fingers and toes are taking shape and the heart is beating fast. Facial features " +
            "are becoming a little more defined this week.",
  },
  {
    week: 9, label: 'a grape', art: 'grape', emoji: '🍇', lengthCm: 2.3, weightG: 2,
    blurb: 'Grape-sized, with all the essential parts in place.',
    detail: "The basic structure of your baby’s body is now formed and the tiny tail has disappeared. " +
            "Little muscles are beginning to develop, even if you can’t feel anything yet.",
  },
  {
    week: 10, label: 'a kumquat', art: 'kumquat', emoji: '🍊', lengthCm: 3.1, weightG: 4,
    blurb: 'Kumquat-sized — officially a fetus now.',
    detail: "Vital organs are in place and starting to function. Tiny nails are forming and the bones " +
            "and cartilage are beginning to take shape.",
  },
  {
    week: 11, label: 'a kiwi', art: 'kiwi', emoji: '🥝', lengthCm: 4.1, weightG: 7,
    blurb: 'Kiwi-sized and starting to stretch and wriggle.',
    detail: "Your baby is moving around, though you won’t feel it for a while yet. Tooth buds and " +
            "tiny fingernails are forming this week.",
  },
  {
    week: 12, label: 'a lemon', art: 'lemon', emoji: '🍋', lengthCm: 5.4, weightG: 14,
    blurb: 'Reflexes are kicking in — fingers will soon open and close.',
    detail: "Your baby’s reflexes are developing and the fingers may curl. Most of the major systems " +
            "are formed, and from here it’s largely about growing bigger and stronger.",
  },
  {
    week: 13, label: 'a pea pod', art: 'pea-pod', emoji: '🫛', lengthCm: 7.4, weightG: 23,
    blurb: 'Pea-pod-sized — the last week of the first trimester.',
    detail: "Tiny ribs and vocal cords are forming, and the fingerprints that are uniquely your baby’s " +
            "have appeared. You’re wrapping up the first trimester this week.",
  },
  {
    week: 14, label: 'a peach', art: 'peach', emoji: '🍑', lengthCm: 8.7, weightG: 43,
    blurb: 'Peach-sized, and may be making little facial expressions.',
    detail: "Your baby can squint, frown, and grimace as the facial muscles develop. The body is now " +
            "growing faster than the head as proportions even out.",
  },
  {
    week: 15, label: 'an apple', art: 'apple', emoji: '🍎', lengthCm: 10.1, weightG: 70,
    blurb: 'Apple-sized and sensing light from the outside.',
    detail: "Even with eyes still closed, your baby may sense bright light filtering in. The legs are " +
            "growing longer than the arms now, and the ears are nearly in their final position.",
  },
  {
    week: 16, label: 'an avocado', art: 'avocado', emoji: '🥑', lengthCm: 11.6, weightG: 100,
    blurb: 'Avocado-sized — you may feel the first flutters soon.',
    detail: "Tiny back muscles let your baby straighten out a bit more. Some parents start to feel the " +
            "very first flutters around now, though it’s often a little later.",
  },
  {
    week: 17, label: 'a potato', art: 'potato', emoji: '🥔', lengthCm: 13.0, weightG: 140,
    blurb: 'Potato-sized, with a strong, steady heartbeat.',
    detail: "Your baby’s skeleton is shifting from soft cartilage to bone, and a protective coating " +
            "is forming over the skin. The heart is now regulated by the brain.",
  },
  {
    week: 18, label: 'a bell pepper', art: 'bell-pepper', emoji: '🫑', lengthCm: 14.2, weightG: 190,
    blurb: 'Bell-pepper-sized and yawning, hiccuping, and flexing.',
    detail: "Your baby is busy yawning, stretching, and even getting the hiccups. The ears are in place " +
            "and may start to pick up sounds.",
  },
  {
    week: 19, label: 'a mango', art: 'mango', emoji: '🥭', lengthCm: 15.3, weightG: 240,
    blurb: 'Mango-sized, developing a protective, waxy coat.',
    detail: "A creamy coating called vernix now protects your baby’s skin in the womb. The senses — " +
            "smell, taste, hearing, sight, and touch — are developing in the brain.",
  },
  {
    week: 20, label: 'a banana', art: 'banana', emoji: '🍌', lengthCm: 16.4, weightG: 300,
    blurb: 'You may start feeling those first flutters of movement.',
    detail: "You’re halfway there! Your baby is swallowing more and producing the first stool, and " +
            "many parents clearly feel kicks and rolls around this point.",
  },
  {
    week: 21, label: 'a carrot', art: 'carrot', emoji: '🥕', lengthCm: 26.7, weightG: 360,
    blurb: 'Carrot-sized and practicing coordinated movements.',
    detail: "Your baby’s movements are becoming more coordinated as arms and legs work together. " +
            "Tiny taste buds are forming, and a little eyebrow fuzz is appearing.",
  },
  {
    week: 22, label: 'a spaghetti squash', art: 'spaghetti-squash', emoji: '🎃', lengthCm: 27.8, weightG: 430,
    blurb: 'Looking more like a tiny newborn, with features filling in.',
    detail: "Your baby is starting to look much more like a newborn, with lips, eyelids, and tiny eyebrows " +
            "more distinct. The sense of touch is developing as nerve endings mature.",
  },
  {
    week: 23, label: 'a large grapefruit', art: 'grapefruit', emoji: '🍊', lengthCm: 28.9, weightG: 501,
    blurb: 'Grapefruit-sized and responding to your voice.',
    detail: "Your baby can hear your voice and may startle at loud sounds. The skin is still a little " +
            "loose and wrinkly — there’s plenty of growing left to fill it out.",
  },
  {
    week: 24, label: 'an ear of corn', art: 'corn', emoji: '🌽', lengthCm: 30.0, weightG: 600,
    blurb: 'Corn-cob-sized — tiny taste buds are forming and hearing is developing.',
    detail: "Your baby can now hear your voice and may respond to sound. The inner ear is developed " +
            "enough to sense which way is up.",
  },
  {
    week: 25, label: 'an acorn squash', art: 'acorn-squash', emoji: '🎃', lengthCm: 34.6, weightG: 660,
    blurb: 'Acorn-squash-sized, with a head of hair coming in.',
    detail: "Hair is growing in and even has color and texture now. Your baby is putting on baby fat, " +
            "which will smooth out that wrinkled skin.",
  },
  {
    week: 26, label: 'a head of lettuce', art: 'lettuce', emoji: '🥬', lengthCm: 35.6, weightG: 760,
    blurb: 'Lettuce-sized — eyes are about to open.',
    detail: "Your baby’s eyes are beginning to open after weeks of being fused shut. The lungs are " +
            "developing air sacs and practicing tiny breathing movements.",
  },
  {
    week: 27, label: 'a cauliflower', art: 'cauliflower', emoji: '🥦', lengthCm: 36.6, weightG: 875,
    blurb: 'Cauliflower-sized — last week of the second trimester.',
    detail: "Your baby now sleeps and wakes on a regular schedule and may even have hiccups you can feel. " +
            "The brain is very active as the third trimester approaches.",
  },
  {
    week: 28, label: 'an eggplant', art: 'eggplant', emoji: '🍆', lengthCm: 37.6, weightG: 1005,
    blurb: 'Eggplant-sized and starting to dream.',
    detail: "Your baby can blink, and brain activity now includes the kind of sleep where dreaming happens. " +
            "Welcome to the third trimester.",
  },
  {
    week: 29, label: 'a butternut squash', art: 'butternut-squash', emoji: '🎃', lengthCm: 38.6, weightG: 1153,
    blurb: 'Squash-sized, with stronger and more frequent kicks.',
    detail: "Those kicks and jabs are getting stronger as muscles and lungs continue to mature. Your baby’s " +
            "energy needs are growing right along with them.",
  },
  {
    week: 30, label: 'a cabbage', art: 'cabbage', emoji: '🥬', lengthCm: 39.9, weightG: 1319,
    blurb: 'Cabbage-sized, with eyesight improving daily.',
    detail: "Your baby’s eyesight continues to develop, though it’s still blurry. The soft downy hair that " +
            "covered the body is beginning to disappear.",
  },
  {
    week: 31, label: 'a coconut', art: 'coconut', emoji: '🥥', lengthCm: 41.1, weightG: 1502,
    blurb: 'Coconut-sized and processing all five senses.',
    detail: "Your baby can now take in information from all five senses. Most of the major development is " +
            "done — from here it’s about gaining weight and getting stronger.",
  },
  {
    week: 32, label: 'a squash', art: 'squash', emoji: '🎃', lengthCm: 42.4, weightG: 1702,
    blurb: 'Squash-sized, practicing breathing for the big day.',
    detail: "Your baby is practicing breathing movements and the toenails and fingernails have grown in. " +
            "Many babies settle into a head-down position around now.",
  },
  {
    week: 33, label: 'a pineapple', art: 'pineapple', emoji: '🍍', lengthCm: 43.7, weightG: 1918,
    blurb: 'Pineapple-sized, with bones hardening up.',
    detail: "Your baby’s bones are hardening, though the skull stays soft and flexible for the journey out. " +
            "The pupils can now constrict and dilate in response to light.",
  },
  {
    week: 34, label: 'a cantaloupe', art: 'cantaloupe-large', emoji: '🍈', lengthCm: 45.0, weightG: 2146,
    blurb: 'Melon-sized, with lungs nearly ready.',
    detail: "Your baby’s central nervous system and lungs are maturing steadily. The protective vernix " +
            "coating on the skin is getting thicker.",
  },
  {
    week: 35, label: 'a honeydew melon', art: 'honeydew', emoji: '🍈', lengthCm: 46.2, weightG: 2383,
    blurb: 'Honeydew-sized — it’s getting cozy in there.',
    detail: "Your baby is running out of room to do somersaults, though you’ll still feel plenty of wriggling. " +
            "The kidneys are fully developed and the liver is processing some waste.",
  },
  {
    week: 36, label: 'a head of romaine lettuce', art: 'romaine-lettuce', emoji: '🥬', lengthCm: 47.4, weightG: 2622,
    blurb: 'Long as a head of romaine — and likely settling head-down.',
    detail: "Your baby is probably head-down now, getting into position for birth. The skin is getting smoother " +
            "and softer as more baby fat fills in.",
  },
  {
    week: 37, label: 'a stalk of Swiss chard', art: 'swiss-chard', emoji: '🥬', lengthCm: 48.6, weightG: 2859,
    blurb: 'Considered “early term” — nearly ready.',
    detail: "Your baby is practicing for life outside — inhaling and exhaling amniotic fluid, blinking, and " +
            "gripping. The big systems are ready, with just some final polishing to do.",
  },
  {
    week: 38, label: 'a leek', art: 'leek', emoji: '🥬', lengthCm: 49.8, weightG: 3083,
    blurb: 'Leek-sized, with a firm little grip.',
    detail: "Your baby now has a surprisingly strong grasp and the organs are ready for the outside world. " +
            "The first stool, called meconium, is building up in the intestines.",
  },
  {
    week: 39, label: 'a mini watermelon', art: 'watermelon', emoji: '🍉', lengthCm: 50.7, weightG: 3288,
    blurb: 'Full term — your baby could arrive any day.',
    detail: "Your baby is officially full term and ready to meet you. They’re continuing to add a layer of " +
            "fat that will help control body temperature after birth.",
  },
  {
    week: 40, label: 'a small pumpkin', art: 'pumpkin', emoji: '🎃', lengthCm: 51.2, weightG: 3462,
    blurb: 'Fully cooked — ready to meet you any day now!',
    detail: "Your baby has reached full size and is ready for the big arrival. Due dates are just estimates, " +
            "so it’s perfectly normal to wait a little longer — hang in there.",
  },
];

// Exact match, else the nearest defined week at or below (clamps below week 4 to the first row).
export function sizeForWeek(week) {
  return PREGNANCY_SIZES.filter(s => s.week <= week).at(-1) ?? PREGNANCY_SIZES[0];
}

// Imperial primary, metric secondary. Dataset stays single-unit (cm + g); we convert here.
export function formatLength(cm) {
  const inches = cm / 2.54;
  return { imperial: `${inches.toFixed(1)} in`, metric: `${cm} cm` };
}

export function formatWeight(g) {
  const totalOz = g / 28.3495;
  let imperial;
  if (totalOz < 1) {
    imperial = '<1 oz';
  } else if (totalOz < 16) {
    imperial = `${totalOz.toFixed(1)} oz`;
  } else {
    const lb = Math.floor(totalOz / 16);
    const oz = Math.round(totalOz - lb * 16);
    imperial = oz ? `${lb} lb ${oz} oz` : `${lb} lb`;
  }
  const metric = g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g} g`;
  return { imperial, metric };
}
