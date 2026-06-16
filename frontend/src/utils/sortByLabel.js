/** Locale-aware A–Z sort for display labels (dictionary order). */
export function compareLabels(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

export function sortByLabel(items, getLabel) {
  return [...items].sort((left, right) => compareLabels(getLabel(left), getLabel(right)));
}
