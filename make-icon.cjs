const sharp = require('sharp');
const path = require('path');

const input = path.join(__dirname, 'Frontend/public/images/cradleVector.png');
const output = path.join(__dirname, 'assets/icon.png');

sharp(input)
  .resize(820, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .extend({ top: 0, bottom: 0, left: 102, right: 102, background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .resize(1024, 1024)
  .toFile(output, (err, info) => {
    if (err) { console.error(err); process.exit(1); }
    console.log('Done:', info);
  });
