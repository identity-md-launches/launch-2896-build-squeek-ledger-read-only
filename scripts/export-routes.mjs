import { mkdir, readFile, writeFile } from "node:fs/promises";

// Every valid token has a real entry on a plain directory-index static server.
// Share the built bundle and theme bootstrap rather than duplicating the full home HTML.
const index = await readFile("dist/index.html", "utf8");
const moduleSrc = index.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/)?.[1];
const cssHref = index.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/)?.[1];
const theme = index.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
if (!moduleSrc || !cssHref || !theme) throw new Error("Could not find the built entry assets or theme bootstrap.");
await writeFile("dist/route-theme.js", theme.trim());
const shell = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="../../"><title>Squeek Ledger</title><link rel="icon" href="./favicon.svg"><script src="./route-theme.js"></script><link rel="stylesheet" href="${cssHref}"></head><body><div id="root"></div><noscript>JavaScript is needed to read the public API.</noscript><script type="module" src="${moduleSrc}"></script></body></html>`;
for (let first = 1; first <= 9999; first += 100) {
  await Promise.all(Array.from({ length: Math.min(100, 10000 - first) }, async (_, offset) => {
    const dir = `dist/squeek/${first + offset}`;
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/index.html`, shell);
  }));
}
console.log(`Exported 9,999 token entry pages (${Buffer.byteLength(shell) * 9999} bytes), sharing the root assets.`);
