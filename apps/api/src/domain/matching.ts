export type MatchableJob = {
  id: string;
  jobName: string;
  jobNumber?: string | null;
  customerName: string;
  jobDate?: Date | null;
  completionDate?: Date | null;
  quotedValue?: number | null;
};

export type MatchableInvoice = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: Date;
  totalExVat: number;
  reference?: string | null;
  memo?: string | null;
};

export const normalizeMatchText = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const containsMeaningful = (haystack?: string | null, needle?: string | null) => {
  const normalizedNeedle = normalizeMatchText(needle);

  if (normalizedNeedle.length < 4) {
    return false;
  }

  return normalizeMatchText(haystack).includes(normalizedNeedle);
};

const tokenSet = (value?: string | null) =>
  new Set(normalizeMatchText(value).split(" ").filter((token) => token.length > 2));

const jaccardSimilarity = (left?: string | null, right?: string | null) => {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...leftTokens, ...rightTokens]).size;
  return intersection / union;
};

const dayDistanceScore = (invoiceDate: Date, jobDate?: Date | null, completionDate?: Date | null) => {
  const date = completionDate || jobDate;

  if (!date) {
    return 0;
  }

  const days = Math.abs(invoiceDate.getTime() - date.getTime()) / 86_400_000;

  if (days <= 7) {
    return 0.1;
  }

  if (days <= 30) {
    return 0.05;
  }

  return 0;
};

const valueProximityScore = (invoiceValue: number, quotedValue?: number | null) => {
  if (!quotedValue || quotedValue <= 0 || invoiceValue <= 0) {
    return 0;
  }

  const differenceRatio = Math.abs(invoiceValue - quotedValue) / quotedValue;

  if (differenceRatio <= 0.1) {
    return 0.08;
  }

  if (differenceRatio <= 0.25) {
    return 0.04;
  }

  return 0;
};

export const scoreInvoiceJobMatch = (invoice: MatchableInvoice, job: MatchableJob) => {
  const text = `${invoice.reference || ""} ${invoice.memo || ""} ${invoice.invoiceNumber}`;
  const referenceHitsJob =
    containsMeaningful(text, job.jobNumber) || containsMeaningful(text, job.jobName);
  const customerExact =
    normalizeMatchText(invoice.customerName) === normalizeMatchText(job.customerName);
  const fuzzyScore = Math.max(
    jaccardSimilarity(text, job.jobName),
    jaccardSimilarity(text, `${job.jobName} ${job.jobNumber || ""}`)
  );

  let score = 0;
  let matchType: "AUTO_JOB_REFERENCE" | "AUTO_CUSTOMER_NAME" | "FUZZY_MATCH" = "FUZZY_MATCH";
  const reasons: string[] = [];

  if (referenceHitsJob) {
    score += 0.78;
    matchType = "AUTO_JOB_REFERENCE";
    reasons.push("Reference or memo contains the ServiceM8 job name/number");
  }

  if (customerExact) {
    score += referenceHitsJob ? 0.08 : 0.58;
    matchType = referenceHitsJob ? matchType : "AUTO_CUSTOMER_NAME";
    reasons.push("Customer name matches");
  }

  if (!referenceHitsJob && fuzzyScore >= 0.35) {
    score += Math.min(0.5, fuzzyScore);
    matchType = "FUZZY_MATCH";
    reasons.push("Text similarity suggests a possible match");
  }

  score += dayDistanceScore(invoice.invoiceDate, job.jobDate, job.completionDate);
  score += valueProximityScore(invoice.totalExVat, job.quotedValue);

  const confidenceScore = Math.min(0.99, Number(score.toFixed(2)));

  return {
    matchType,
    confidenceScore,
    status:
      confidenceScore >= 0.86
        ? "MATCHED"
        : confidenceScore >= 0.55
          ? "POSSIBLE_MATCH"
          : "UNMATCHED",
    reasons
  };
};
