const ISO2_BY_SHORT: Record<string, string> = {
  ALG: "DZ",
  ARG: "AR",
  AUS: "AU",
  AUT: "AT",
  BEL: "BE",
  BIH: "BA",
  BRA: "BR",
  CAN: "CA",
  CPV: "CV",
  COL: "CO",
  CRO: "HR",
  CUR: "CW",
  CZE: "CZ",
  COD: "CD",
  ECU: "EC",
  EGY: "EG",
  FRA: "FR",
  GER: "DE",
  GHA: "GH",
  HAI: "HT",
  IRN: "IR",
  IRQ: "IQ",
  CIV: "CI",
  JPN: "JP",
  JOR: "JO",
  MEX: "MX",
  MAR: "MA",
  NED: "NL",
  NZL: "NZ",
  NOR: "NO",
  PAN: "PA",
  PAR: "PY",
  POR: "PT",
  QAT: "QA",
  KSA: "SA",
  SEN: "SN",
  RSA: "ZA",
  KOR: "KR",
  ESP: "ES",
  SWE: "SE",
  SUI: "CH",
  TUN: "TN",
  TUR: "TR",
  USA: "US",
  URU: "UY",
  UZB: "UZ",
};

const SUBDIVISION_FLAGS_BY_SHORT: Record<string, string> = {
  ENG: subdivisionFlag("gbeng"),
  SCO: subdivisionFlag("gbsct"),
};

export function flagForShort(short: string): string | null {
  const normalized = short.toUpperCase();
  if (SUBDIVISION_FLAGS_BY_SHORT[normalized]) {
    return SUBDIVISION_FLAGS_BY_SHORT[normalized];
  }
  const iso2 = ISO2_BY_SHORT[normalized];
  return iso2 ? regionalIndicatorFlag(iso2) : null;
}

function regionalIndicatorFlag(iso2: string): string {
  const regionalIndicatorA = 0x1f1e6;
  return Array.from(iso2.toUpperCase(), (letter) =>
    String.fromCodePoint(regionalIndicatorA + letter.charCodeAt(0) - 65),
  ).join("");
}

function subdivisionFlag(tag: string): string {
  const blackFlag = 0x1f3f4;
  const cancelTag = 0xe007f;
  const tagBase = 0xe0000;
  return String.fromCodePoint(
    blackFlag,
    ...Array.from(tag, (letter) => tagBase + letter.charCodeAt(0)),
    cancelTag,
  );
}
