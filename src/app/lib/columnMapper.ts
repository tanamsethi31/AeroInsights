// src/app/lib/columnMapper.ts

export interface FieldDef {
  id: string;
  label: string;
  required: boolean;
  example: string;
  description: string;
}

export const OUR_FIELDS: FieldDef[] = [
  { id: "registration",    label: "Registration",      required: true,  example: "VT-IYC",         description: "Aircraft tail number" },
  { id: "msn",             label: "MSN",               required: true,  example: "9218",            description: "Manufacturer Serial Number" },
  { id: "aircraft_type",   label: "Aircraft Type",     required: true,  example: "A320neo",         description: "ICAO type designator" },
  { id: "lessee_name",     label: "Lessee Name",       required: true,  example: "IndiGo Airlines", description: "Airline or lessee entity" },
  { id: "start_date",      label: "Lease Start",       required: true,  example: "2019-03-01",      description: "Lease commencement (YYYY-MM-DD)" },
  { id: "end_date",        label: "Lease End",         required: true,  example: "2028-03-01",      description: "Lease expiry (YYYY-MM-DD)" },
  { id: "manufacturer",    label: "Manufacturer",      required: false, example: "Airbus",          description: "OEM (Airbus / Boeing)" },
  { id: "vintage",         label: "Vintage (Year)",    required: false, example: "2019",            description: "Year of manufacture" },
  { id: "current_operator",label: "Current Operator",  required: false, example: "IndiGo",          description: "Current operating airline" },
  { id: "iata_code",       label: "IATA Code",         required: false, example: "6E",              description: "2-letter airline code" },
  { id: "country",         label: "Country",           required: false, example: "India",           description: "Lessee country" },
  { id: "credit_rating",   label: "Credit Rating",     required: false, example: "BB-",             description: "S&P / Moody's rating" },
  { id: "pd_estimate",     label: "PD Estimate",       required: false, example: "0.12",            description: "Probability of default (0–1)" },
  { id: "watchlist_status",label: "Watchlist Status",  required: false, example: "amber",           description: "green | amber | red" },
  { id: "monthly_rental",  label: "Monthly Rental",    required: false, example: "285000",          description: "Monthly rent (number, no commas)" },
  { id: "currency",        label: "Currency",          required: false, example: "USD",             description: "ISO currency code" },
  { id: "stage",           label: "IFRS 9 Stage",      required: false, example: "2",               description: "1 | 2 | 3" },
  { id: "ecl_amount",      label: "ECL Amount",        required: false, example: "4200000",         description: "ECL provision (number)" },
  { id: "pd",              label: "PD",                required: false, example: "0.12",            description: "Probability of default used for ECL" },
  { id: "lgd",             label: "LGD",               required: false, example: "0.45",            description: "Loss given default" },
  { id: "ead",             label: "EAD",               required: false, example: "24200000",        description: "Exposure at default" },
];

// Derives the union of all field ID strings from OUR_FIELDS at compile time
type FieldId = typeof OUR_FIELDS[number]["id"];

export const REQUIRED_FIELDS: FieldId[] = OUR_FIELDS.filter(f => f.required).map(f => f.id);

// Aliases: map of field id → list of header strings that should match (lowercased)
const ALIASES: Record<FieldId, string[]> = {
  registration:     ["registration", "reg", "tail", "tail no", "tail no.", "tail number", "a/c reg", "aircraft reg", "ac reg"],
  msn:              ["msn", "serial", "serial number", "manufacturer serial", "serial no", "s/n", "sn"],
  aircraft_type:    ["aircraft type", "aircraft_type", "type", "a/c type", "aircraft", "model", "aircraft model", "ac type"],
  lessee_name:      ["lessee", "lessee name", "lessee_name", "airline", "operator name", "tenant", "client", "customer"],
  start_date:       ["start", "lease start", "commencement", "start date", "start_date", "lease commencement", "from", "date from"],
  end_date:         ["end", "lease end", "expiry", "end date", "end_date", "lease expiry", "maturity", "to", "date to"],
  manufacturer:     ["manufacturer", "oem", "maker", "built by"],
  vintage:          ["vintage", "year", "year of manufacture", "yom", "build year", "manufacture year", "msn year"],
  current_operator: ["operator", "current operator", "operated by", "operating airline"],
  iata_code:        ["iata", "iata code", "code", "airline code", "iata_code"],
  country:          ["country", "country code", "nation", "jurisdiction", "lessee country"],
  credit_rating:    ["credit rating", "rating", "s&p", "moody's", "credit", "agency rating"],
  pd_estimate:      ["pd estimate", "default probability", "pd %", "pd_estimate"],
  watchlist_status: ["watchlist", "watchlist status", "risk status", "watch"],
  monthly_rental:   ["rental", "rent", "monthly rental", "monthly rent", "rental usd", "lease rate", "rent usd", "monthly payment"],
  currency:         ["currency", "ccy", "currency code", "curr"],
  stage:            ["stage", "ifrs9 stage", "ifrs 9", "credit stage", "ecl stage"],
  ecl_amount:       ["ecl", "provision", "ecl amount", "expected credit loss", "loss provision", "ecl $"],
  pd:               ["pd", "probability of default", "pd_ifrs9"],
  lgd:              ["lgd", "loss given default"],
  ead:              ["ead", "exposure at default"],
};

/**
 * Given the detected column headers from an uploaded file, returns a mapping
 * of our field id → the detected header that best matches, or null if no match.
 * Each user header is claimed by at most one field (first-match wins per OUR_FIELDS order).
 */
export function suggestMapping(detectedHeaders: string[]): Record<FieldId, string | null> {
  const result = {} as Record<FieldId, string | null>;
  const normalised = detectedHeaders.map(h => h.toLowerCase().trim());
  const claimed = new Set<number>();

  for (const field of OUR_FIELDS) {
    const aliases = ALIASES[field.id as FieldId] ?? [];
    const matchIndex = normalised.findIndex((h, i) =>
      !claimed.has(i) && aliases.some(alias => alias === h)
    );
    if (matchIndex >= 0) {
      result[field.id as FieldId] = detectedHeaders[matchIndex];
      claimed.add(matchIndex);
    } else {
      result[field.id as FieldId] = null;
    }
  }

  return result;
}
