/**
 * Instala assets de marca SIN recortar paths (evita logos cortados).
 * Run: node scripts/install-brand-assets.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const INBOX = path.join(process.cwd(), 'brand-inbox');
const BRAND = path.join(process.cwd(), 'public', 'brand');
const ICONS = path.join(process.cwd(), 'public', 'icons');

function cleanSvg(src, dest, { darkIcon = false } = {}) {
  let svg = fs.readFileSync(src, 'utf8');
  if (darkIcon) {
    svg = svg.replace(/fill:#000000/g, 'fill:#e2e3db');
  }
  svg = svg.replace(/<svg[^>]*>/, (tag) => {
    const vb = tag.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 48 48';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" fill="none">`;
  });
  fs.writeFileSync(dest, svg);
}

fs.mkdirSync(BRAND, { recursive: true });
fs.mkdirSync(ICONS, { recursive: true });

const pairs = [
  ['mineos-logotipo-light.svg', false],
  ['mineos-logotipo-dark.svg', false],
  ['mineos-icon-light.svg', false],
  ['mineos-icon-dark.svg', true],
  ['mineos-light.svg', false],
  ['mineos-dark.svg', false],
];

for (const [name, darkIcon] of pairs) {
  cleanSvg(path.join(INBOX, name), path.join(BRAND, name), { darkIcon });
  console.log('brand', name);
}

/** Isotipo para favicon: viewBox cuadrado (evita estirar en pestaña del navegador). */
function writeFaviconSvg(dest) {
  const raw = fs.readFileSync(path.join(INBOX, 'mineos-icon-light.svg'), 'utf8');
  const pathD = [...raw.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1])[0];
  // Bounds del path en el arte 48×48 (Inkscape); cuadrado centrado con ~8% padding.
  const minX = 11;
  const minY = 8;
  const maxX = 39;
  const maxY = 34;
  const pad = 0.08;
  const w = maxX - minX;
  const h = maxY - minY;
  const size = Math.max(w, h) * (1 + pad * 2);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const x = cx - size / 2;
  const y = cy - size / 2;
  const vb = `${x.toFixed(2)} ${y.toFixed(2)} ${size.toFixed(2)} ${size.toFixed(2)}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" fill="none">
  <path fill="#141414" d="${pathD}"/>
</svg>
`;
  fs.writeFileSync(dest, svg);
}

function renderPng(svgPath, outPath, width) {
  execSync(
    `npx --yes @resvg/resvg-js-cli --fit-width ${width} "${svgPath}" "${outPath}"`,
    { stdio: 'inherit' },
  );
}

const faviconSvg = path.join(BRAND, 'mineos-icon-favicon.svg');
writeFaviconSvg(faviconSvg);
writeFaviconSvg(path.join(process.cwd(), 'src', 'app', 'icon.svg'));

const pngTargets = [
  [32, path.join(ICONS, 'favicon-32.png')],
  [128, path.join(ICONS, 'icon-128.png')],
  [180, path.join(ICONS, 'apple-touch-icon.png')],
  [192, path.join(ICONS, 'icon-192.png')],
  [256, path.join(ICONS, 'icon-256.png')],
  [512, path.join(ICONS, 'icon-512.png')],
];

for (const [width, dest] of pngTargets) {
  renderPng(faviconSvg, dest, width);
  console.log('favicon png', width);
}

const appDir = path.join(process.cwd(), 'src', 'app');
const favicon32 = path.join(ICONS, 'favicon-32.png');
execSync(
  `npx --yes png-to-ico "${favicon32}" > "${path.join(appDir, 'favicon.ico')}"`,
  { stdio: 'inherit', shell: true },
);
fs.copyFileSync(path.join(ICONS, 'apple-touch-icon.png'), path.join(appDir, 'apple-icon.png'));
