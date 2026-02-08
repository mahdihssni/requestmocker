import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public", "icons");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="48" y1="36" x2="212" y2="220" gradientUnits="userSpaceOnUse">
      <stop stop-color="#8B5CF6"/>
      <stop offset="1" stop-color="#4F46E5"/>
    </linearGradient>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect x="24" y="24" width="208" height="208" rx="56" fill="url(#g)" filter="url(#s)"/>
  <path d="M78 116C78 92.2518 97.2518 73 121 73H135C158.748 73 178 92.2518 178 116V140C178 163.748 158.748 183 135 183H121C97.2518 183 78 163.748 78 140V116Z" fill="rgba(0,0,0,0.18)"/>
  <path d="M98 118C98 104.745 108.745 94 122 94H134C147.255 94 158 104.745 158 118V138C158 151.255 147.255 162 134 162H122C108.745 162 98 151.255 98 138V118Z" fill="rgba(255,255,255,0.16)"/>
  <text x="128" y="148" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" font-size="74" font-weight="900" fill="white" letter-spacing="1">RM</text>
</svg>`;

const sizes = [16, 32, 48, 128];

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await Promise.all(
    sizes.map(async (size) => {
      const out = path.join(OUT_DIR, `icon${size}.png`);
      const buf = await sharp(Buffer.from(svg))
        .resize(size, size, { fit: "cover" })
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer();
      await fs.writeFile(out, buf);
    })
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

