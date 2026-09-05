export type PageRangeResult = {
  pages: number[];
  error: string;
};

export function parsePageRanges(value: string, pageCount: number): PageRangeResult {
  const trimmedValue = value.trim();
  if (!trimmedValue) return { pages: [], error: "Choose at least one page." };

  const selectedPages = new Set<number>();
  for (const part of trimmedValue.split(",")) {
    const range = part.trim();
    if (!/^\d+(?:-\d+)?$/.test(range)) {
      return { pages: [], error: "Use a format like 1-3, 5, 8-10." };
    }
    const [startText, endText = startText] = range.split("-");
    const start = Number(startText);
    const end = Number(endText);
    if (start < 1 || end > pageCount || start > end) {
      return { pages: [], error: `Page numbers must be between 1 and ${pageCount}.` };
    }
    for (let page = start; page <= end; page += 1) selectedPages.add(page);
  }

  return { pages: [...selectedPages].sort((a, b) => a - b), error: "" };
}