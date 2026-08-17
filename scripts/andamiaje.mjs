#!/usr/bin/env node
/**
 * Inventario de andamiaje: todo lo que es temporal y espera a una issue.
 *
 * Existe porque el rastro de lo aplazado vivía en comentarios sueltos con
 * redacciones distintas ("provisional", "de momento", "hasta PRO-6") y en la
 * memoria de quien lo escribió. Se acumuló hasta ser difícil de ver de golpe.
 *
 * Convención: una pieza temporal lleva `ANDAMIAJE(PRO-XX):` en su comentario,
 * seguida de qué es. El inventario se genera del código, así que no puede
 * desincronizarse.
 *
 *   npm run andamiaje
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = process.cwd();
const CARPETAS = ["src", "convex", "scripts"];
const EXTENSIONES = /\.(ts|tsx|mjs|css)$/;
const IGNORAR = /(^|[\\/])(_generated|node_modules)([\\/]|$)/;
const MARCADOR = /ANDAMIAJE\((PRO-\d+)\)\s*:?\s*(.*)/;

function* ficheros(dir) {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (IGNORAR.test(ruta)) continue;
    if (statSync(ruta).isDirectory()) yield* ficheros(ruta);
    else if (EXTENSIONES.test(ruta)) yield ruta;
  }
}

const hallazgos = [];
for (const carpeta of CARPETAS) {
  const dir = join(RAIZ, carpeta);
  try {
    statSync(dir);
  } catch {
    continue;
  }
  for (const fichero of ficheros(dir)) {
    const lineas = readFileSync(fichero, "utf8").split(/\r?\n/);
    lineas.forEach((linea, i) => {
      const encontrado = MARCADOR.exec(linea);
      if (!encontrado) return;
      hallazgos.push({
        issue: encontrado[1],
        descripcion: encontrado[2].trim().replace(/\s*\*\/\s*$/, ""),
        ubicacion: `${relative(RAIZ, fichero).replace(/\\/g, "/")}:${i + 1}`,
      });
    });
  }
}

if (hallazgos.length === 0) {
  console.log("Sin andamiaje pendiente.");
  process.exit(0);
}

const porIssue = new Map();
for (const h of hallazgos) {
  if (!porIssue.has(h.issue)) porIssue.set(h.issue, []);
  porIssue.get(h.issue).push(h);
}

console.log(`\n${hallazgos.length} piezas de andamiaje en ${porIssue.size} issues:\n`);
for (const issue of [...porIssue.keys()].sort()) {
  console.log(`  ${issue}`);
  for (const h of porIssue.get(issue)) {
    console.log(`    · ${h.descripcion || "(sin descripción)"}`);
    console.log(`      ${h.ubicacion}`);
  }
  console.log("");
}
console.log(
  "Recuerda: no cerrar una issue sin comprobar qué andamiaje suyo sigue vivo.\n",
);
