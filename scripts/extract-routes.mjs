import fs from "fs";
import path from "path";

const APP_DIR = path.resolve(process.cwd(), "app");
const OUT = path.resolve(process.cwd(), "scripts/routes.smoke.json");

function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let results = [];
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            // ignore next internals
            if (e.name === "api") continue;
            results = results.concat(walk(full));
        } else {
            if (e.name === "page.tsx" || e.name === "page.jsx" || e.name === "page.ts" || e.name === "page.js") {
                results.push(full);
            }
        }
    }
    return results;
}

function toRoute(file) {
    // app/(group)/cadastros/clientes/page.tsx -> /cadastros/clientes
    const rel = path.relative(APP_DIR, path.dirname(file));
    const parts = rel.split(path.sep).filter(Boolean);

    const cleaned = parts
        .filter(p => !(p.startsWith("(") && p.endsWith(")"))) // remove route groups
        .map(p => p);

    const route = "/" + cleaned.join("/");

    // handle root
    return route === "/" ? "/" : route;
}

const pages = walk(APP_DIR);

let routes = pages.map(toRoute);

// remove duplicates
routes = Array.from(new Set(routes));

// drop dynamic segments by default
routes = routes.filter(r => !r.includes("[") && !r.includes("]"));

// keep it sane: prefer shorter, important routes first (basic sort)
routes.sort((a, b) => a.length - b.length);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(routes, null, 2));

console.log(`✅ Routes extracted: ${routes.length}`);
console.log(`➡️  Written to: ${OUT}`);
