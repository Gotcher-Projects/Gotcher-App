const sharp = require('sharp');
const path = require('path');

const input = path.join(__dirname, 'public/images/cradleVector.png');
const output = path.join(__dirname, '../assets/icon.png');

sharp(input)
  .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .flatten({ background: { r: 255, g: 255, b: 255 } })
  .toFile(output, (err, info) => {
    if (err) { console.error(err); process.exit(1); }
    console.log('Done:', info);
  });
