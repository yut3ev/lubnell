/* BRAND-ASSETS: build logo + icon set from the owner's uploaded artwork.
 * Inputs : upload/brave_Ll02sUcGDf.png (light bg variant)
 *          upload/brave_5aiSulxTaS.png (dark navy variant)
 * Outputs: public/brand/logo-light.png  (transparent bg, for header/footer)
 *          public/brand/logo-dark.png   (transparent bg, for dark surfaces)
 *          public/icons/icon-192.png | icon-512.png | icon-maskable-512.png | apple-touch-icon.png
 *          src/app/icon.png | src/app/apple-icon.png
 */
const sharp = require('/home/z/my-project/node_modules/sharp')
const fs = require('fs')
const path = require('path')

const ROOT = '/home/z/my-project'
const LIGHT = path.join(ROOT, 'upload/brave_Ll02sUcGDf.png')
const DARK = path.join(ROOT, 'upload/brave_5aiSulxTaS.png')

async function rawPixels(input) {
  const img = sharp(input)
  const meta = await img.metadata()
  const buf = await img.ensureAlpha().raw().toBuffer()
  return { buf, width: meta.width, height: meta.height }
}

function hexify(buf) {
  return `#${[buf[0], buf[1], buf[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/* light variant: white -> transparent (dark text kept) */
async function lightLogoTransparent() {
  const { buf, width, height } = await rawPixels(LIGHT)
  for (let i = 0; i < buf.length; i += 4) {
    const L = 0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2]
    if (L > 243) buf[i + 3] = 0
    else if (L > 205) buf[i + 3] = Math.round(((243 - L) * 255) / 38)
  }
  return { buf, width, height }
}

/* dark variant: uniform navy bg -> transparent */
async function darkLogoTransparent() {
  const { buf, width, height } = await rawPixels(DARK)
  const bg = [buf[0], buf[1], buf[2]]
  for (let i = 0; i < buf.length; i += 4) {
    const d = Math.abs(buf[i] - bg[0]) + Math.abs(buf[i + 1] - bg[1]) + Math.abs(buf[i + 2] - bg[2])
    if (d < 24) buf[i + 3] = 0
    else if (d < 84) buf[i + 3] = Math.round(((d - 24) * 255) / 60)
  }
  return { buf, width, height, bg }
}

async function saveTrimmed({ buf, width, height }, out) {
  await sharp(buf, { raw: { width, height, channels: 4 } })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
    .png()
    .toFile(out)
  const meta = await sharp(out).metadata()
  return meta
}

async function main() {
  fs.mkdirSync(path.join(ROOT, 'public/brand'), { recursive: true })

  /* ---- 1. light + dark transparent logos ---- */
  const lightMeta = await saveTrimmed(await lightLogoTransparent(), path.join(ROOT, 'public/brand/logo-light.png'))
  console.log('logo-light:', lightMeta.width + 'x' + lightMeta.height)

  const dark = await darkLogoTransparent()
  const darkMeta = await saveTrimmed(dark, path.join(ROOT, 'public/brand/logo-dark.png'))
  console.log('logo-dark:', darkMeta.width + 'x' + darkMeta.height, 'bg=' + hexify(dark.bg))

  /* ---- 2. monogram: right-most ~26% of the dark logo = circled L ---- */
  const monoW = Math.round(darkMeta.width * 0.27)
  const monoTmp = path.join(ROOT, 'public/brand/.monogram-raw.png')
  await sharp(path.join(ROOT, 'public/brand/logo-dark.png'))
    .extract({ left: darkMeta.width - monoW, top: 0, width: monoW, height: darkMeta.height })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
    .png()
    .toFile(monoTmp)
  const mono = await sharp(monoTmp).metadata()
  console.log('monogram:', mono.width + 'x' + mono.height)
  const side = Math.max(mono.width, mono.height)
  const navy = hexify(dark.bg)

  /* ---- 3. full-bleed navy icon canvas + centered monogram ---- */
  async function iconCanvas(size, contentRatio) {
    const content = Math.round(size * contentRatio)
    const mark = await sharp(monoTmp)
      .resize(content, content, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    const rgb = { r: dark.bg[0], g: dark.bg[1], b: dark.bg[2] }
    return sharp({
      create: { width: size, height: size, channels: 4, background: { ...rgb, alpha: 1 } },
    })
      .composite([{ input: mark, gravity: 'center' }])
      .png()
      .toBuffer()
  }

  const icon512 = await iconCanvas(512, 0.8)
  const icon192 = await iconCanvas(192, 0.8)
  const maskable512 = await iconCanvas(512, 0.62)
  const apple180 = await iconCanvas(180, 0.86)
  const appIcon = await iconCanvas(256, 0.8)

  fs.writeFileSync(path.join(ROOT, 'public/icons/icon-512.png'), icon512)
  fs.writeFileSync(path.join(ROOT, 'public/icons/icon-192.png'), icon192)
  fs.writeFileSync(path.join(ROOT, 'public/icons/icon-maskable-512.png'), maskable512)
  fs.writeFileSync(path.join(ROOT, 'public/icons/apple-touch-icon.png'), apple180)
  fs.writeFileSync(path.join(ROOT, 'src/app/icon.png'), appIcon)
  fs.writeFileSync(path.join(ROOT, 'src/app/apple-icon.png'), apple180)
  fs.unlinkSync(monoTmp)

  /* ---- 4. small preview sheet for visual verification ---- */
  const preview = await sharp({
    create: { width: 640, height: 240, channels: 4, background: { r: 248, g: 246, b: 242, alpha: 1 } },
  })
    .composite([
      { input: path.join(ROOT, 'public/brand/logo-light.png'), left: 20, top: 90 },
      { input: icon192, left: 320, top: 24 },
      { input: icon192, left: 530, top: 24 },
    ])
    .png()
    .toFile(path.join(ROOT, 'public/brand/.preview.png'))

  console.log('navy icon color:', navy)
  console.log('DONE')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
