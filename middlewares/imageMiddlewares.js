const path = require('path');
const axios = require('axios');
const { Resvg } = require('@resvg/resvg-js');
const sharp = require('sharp');
const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);

async function imageBrightness(image) {
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const pixelBrightness = (r + g + b) / (3 * 255);
    totalBrightness += pixelBrightness;
  }
  
  return totalBrightness / (info.width * info.height);
}

async function generatePreview({ image = null, themeid, colorlist, opacity, title }) {
  const svgPath = path.join(__dirname, './assets/svg/testPage.svg');
  let svgString = await readFile(svgPath, 'utf-8');
  
  for(let i=0; i<colorlist.length; i++) {
    let regex = new RegExp(`colorlist\\[${i}\\]`, "g");
    svgString = svgString.replace(regex, colorlist[i]);
  }
  
  svgString = svgString.replace(/{title}/g, title);
  
  const svg = Buffer.from(svgString);

  const opts = {
    background: 'transparent',
    fitTo: {
      mode: 'width',
      value: 798,
    },
    font: {
      fontFiles: [
        path.join(__dirname, './assets/fonts/lexenddecamedium.ttf'),
      ],
      loadSystemFonts: false,
      defaultFontFamily: 'Lexend Deca',
    },
  };
  const resvg = new Resvg(svg, opts);
  const svgData = resvg.render();
  const svgBuffer = svgData.asPng();

  const bgcolorRGB = hexToRgb(colorlist[0]);
  const background = await sharp({
    create: {
      width: 800,
      height: 450,
      channels: 4,
      background: { r: bgcolorRGB.r, g: bgcolorRGB.g, b: bgcolorRGB.b, alpha: 1 },
    },
  }).png().toBuffer();

  const alphaImage = await sharp({
    create: {
      width: 800,
      height: 450,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: opacity },
    },
  }).png().toBuffer();

  let imageWithOpacity;

  if (image) {
    const imageBuffer = await image.toBuffer();
    imageWithOpacity = await sharp(imageBuffer)
      .composite([{ input: alphaImage, blend: 'dest-in' }])
      .png()
      .toBuffer();

    await sharp(background)
      .composite([
          { input: imageWithOpacity, blend: 'over' },
          { input: svgBuffer, blend: 'over' }
      ])
      .toFile(path.join(__dirname, `../static/thumb/${themeid}.png`));      
  } else {
    await sharp(background)
      .composite([
          { input: svgBuffer, blend: 'over' }
      ])
      .toFile(path.join(__dirname, `../static/thumb/${themeid}.png`));
  }
}

function hexToRgb(hex) {
  let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
  } : null;
}

async function downloadAndProcessImage(url, brightness, saturation, blur, fit, colorlist, themeid, opacity, title) {
  const response = await axios({
    url,
    responseType: 'stream',
  });
  const image = sharp();

  response.data.pipe(image);

  let bgcolorRGB = hexToRgb(colorlist[0]);

  if (fit === 'max') {
    fit = 'fill';
  }

  let resizeOptions = {
    fit: fit,
    position: 'center',
    background: { r: bgcolorRGB.r, g: bgcolorRGB.g, b: bgcolorRGB.b, alpha: 1 },
  };

  image.resize(800, 450, resizeOptions);

  image.modulate({saturation: saturation});
  image.linear(brightness, 0);

  const previewImage = image.clone();
  const largeBgi = image.clone();

  let blurConst = blur * 6.25
  let bgiBlur = blurConst * 1;
  if (blur > 0) {
    image.blur(bgiBlur);
  }

  let largeBlur = blurConst * 2;
  if (blur > 0) {
    largeBgi.blur(largeBlur);
  }
  largeBgi.resize(640, 360, resizeOptions).jpeg({ quality: 100 });
  await largeBgi.toFile(path.join(__dirname, `../static/bgi/large/${themeid}.jpg`));

  let previewBlur = blurConst * 2.67;
  if (blur > 0) {
    previewImage.blur(previewBlur);
  }
  generatePreview({ image: previewImage, themeid, colorlist, opacity, title });

  image.resize(384, 216, resizeOptions).jpeg({ quality: 80 });
  const imageClone = image.clone();
  await image.toFile(path.join(__dirname, `../static/bgi/small/${themeid}.jpg`));
  return imageClone;
}

module.exports = { imageBrightness, downloadAndProcessImage, generatePreview };
