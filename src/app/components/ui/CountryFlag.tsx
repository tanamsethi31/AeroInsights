/**
 * Renders a small country flag from flagcdn.com, tinted to a monochrome
 * Oxford-blue palette via CSS filter.
 *
 * Accepts either a 2-letter ISO code ("IN") or a country name ("India").
 */

const NAME_TO_ISO: Record<string, string> = {
  "Afghanistan": "af", "Argentina": "ar", "Australia": "au",
  "Austria": "at", "Bangladesh": "bd", "Belgium": "be",
  "Brazil": "br", "Canada": "ca", "Chile": "cl",
  "China": "cn", "Colombia": "co", "Denmark": "dk",
  "Egypt": "eg", "Ethiopia": "et", "Finland": "fi",
  "France": "fr", "Germany": "de", "Ghana": "gh",
  "Greece": "gr", "Hong Kong": "hk", "India": "in",
  "Indonesia": "id", "Iran": "ir", "Ireland": "ie",
  "Italy": "it", "Japan": "jp", "Kazakhstan": "kz",
  "Kenya": "ke", "Kuwait": "kw", "Lebanon": "lb",
  "Malaysia": "my", "Mexico": "mx", "Morocco": "ma",
  "Netherlands": "nl", "New Zealand": "nz", "Nigeria": "ng",
  "Norway": "no", "Pakistan": "pk", "Peru": "pe",
  "Philippines": "ph", "Portugal": "pt", "Qatar": "qa",
  "Russia": "ru", "Saudi Arabia": "sa", "Singapore": "sg",
  "South Africa": "za", "South Korea": "kr", "Spain": "es",
  "Sri Lanka": "lk", "Sweden": "se", "Switzerland": "ch",
  "Taiwan": "tw", "Thailand": "th", "Turkey": "tr",
  "UAE": "ae", "Ukraine": "ua", "United Arab Emirates": "ae",
  "United Kingdom": "gb", "United States": "us",
  "Venezuela": "ve", "Vietnam": "vn",
};

const OXFORD_BLUE_FILTER =
  "grayscale(1) sepia(1) hue-rotate(150deg) saturate(0.55) brightness(0.65)";

export function CountryFlag({
  code,
  country,
  size = 15,
}: {
  /** ISO 3166-1 alpha-2 code, case-insensitive (e.g. "IN", "us") */
  code?: string;
  /** Country name string, looked up in the built-in map */
  country?: string;
  /** Height in px. Width is derived from the 3:2 flag aspect ratio. */
  size?: number;
}) {
  const iso = (code ?? (country ? NAME_TO_ISO[country] : undefined))?.toLowerCase();
  if (!iso) return null;

  const width = Math.round(size * 1.5);
  const retinaWidth = Math.min(width * 2, 160); // nearest sensible CDN size

  return (
    <img
      src={`https://flagcdn.com/w${retinaWidth}/${iso}.png`}
      width={width}
      height={size}
      alt=""
      aria-hidden="true"
      style={{
        width: `${width}px`,
        height: `${size}px`,
        objectFit: "cover",
        borderRadius: "2px",
        filter: OXFORD_BLUE_FILTER,
        flexShrink: 0,
        display: "inline-block",
        verticalAlign: "middle",
      }}
    />
  );
}
