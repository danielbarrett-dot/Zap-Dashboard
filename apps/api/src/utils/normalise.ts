export const normalizeMatchText = (value: string | null | undefined) =>
  (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const containsNormalized = (source: string | null | undefined, target: string | null | undefined) => {
  const normalizedSource = normalizeMatchText(source);
  const normalizedTarget = normalizeMatchText(target);

  if (!normalizedSource || !normalizedTarget) {
    return false;
  }

  return normalizedSource.includes(normalizedTarget) || normalizedTarget.includes(normalizedSource);
};

