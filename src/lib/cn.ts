/**
 * Une clases condicionales. Deliberadamente mínimo: el design system compone
 * clases por variante, no las sobreescribe, así que no hace falta la resolución
 * de conflictos de tailwind-merge.
 */
export function cn(...clases: Array<string | false | null | undefined>): string {
  return clases.filter(Boolean).join(" ");
}
