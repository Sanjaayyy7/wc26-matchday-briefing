/**
 * Fetch WC26 squad players and write data/players.json.
 *
 * Strategy:
 *   1. Try Wikidata SPARQL for WC2026 squad members (no API key required).
 *   2. If network unavailable or returns too few results, fall back to a
 *      curated seeded set of ≥50 credible WC26 players across groups.
 *
 * Provenance:
 *   - Verified rows: originType="verified", confidence=0.8, source=URL
 *   - Seeded rows:   originType="seeded",   confidence=0.3, source="seed:wc26-known-roster"
 *
 * Every row passes assertProvenance() before writing.
 *
 *   npm run players:fetch
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { appDir } from "./shared.mts";
import { assertProvenance } from "../lib/provenance.js";
import type { Provenanced } from "../lib/provenance.js";

const TODAY = new Date().toISOString().slice(0, 10);

export interface PlayerRow extends Provenanced {
  id: string;
  name: string;
  teamId: string;
  position: "GK" | "DF" | "MF" | "FW";
  nationality?: string;
}

// ---------------------------------------------------------------------------
// Seeded fallback — credible WC26 roster entries, ≥50 across groups
// ---------------------------------------------------------------------------

const SEEDED_PLAYERS: Omit<PlayerRow, "_prov">[] = [
  // Argentina (arg) — Group J
  { id: "arg-messi", name: "Lionel Messi", teamId: "arg", position: "FW" },
  { id: "arg-dybala", name: "Paulo Dybala", teamId: "arg", position: "FW" },
  { id: "arg-lautaro", name: "Lautaro Martínez", teamId: "arg", position: "FW" },
  { id: "arg-de-paul", name: "Rodrigo De Paul", teamId: "arg", position: "MF" },
  { id: "arg-fernandez", name: "Enzo Fernández", teamId: "arg", position: "MF" },
  { id: "arg-molina", name: "Nahuel Molina", teamId: "arg", position: "DF" },
  { id: "arg-romero", name: "Cristian Romero", teamId: "arg", position: "DF" },
  { id: "arg-martinez", name: "Emiliano Martínez", teamId: "arg", position: "GK" },
  // Brazil (bra) — Group F
  { id: "bra-vinicius", name: "Vinícius Jr.", teamId: "bra", position: "FW" },
  { id: "bra-rodrygo", name: "Rodrygo", teamId: "bra", position: "FW" },
  { id: "bra-neymar", name: "Neymar Jr.", teamId: "bra", position: "FW" },
  { id: "bra-casemiro", name: "Casemiro", teamId: "bra", position: "MF" },
  { id: "bra-thiago-silva", name: "Thiago Silva", teamId: "bra", position: "DF" },
  { id: "bra-marquinhos", name: "Marquinhos", teamId: "bra", position: "DF" },
  { id: "bra-alisson", name: "Alisson", teamId: "bra", position: "GK" },
  // France (fra) — Group E
  { id: "fra-mbappe", name: "Kylian Mbappé", teamId: "fra", position: "FW" },
  { id: "fra-dembele", name: "Ousmane Dembélé", teamId: "fra", position: "FW" },
  { id: "fra-griezmann", name: "Antoine Griezmann", teamId: "fra", position: "FW" },
  { id: "fra-tchouameni", name: "Aurélien Tchouaméni", teamId: "fra", position: "MF" },
  { id: "fra-rabiot", name: "Adrien Rabiot", teamId: "fra", position: "MF" },
  { id: "fra-varane", name: "Raphaël Varane", teamId: "fra", position: "DF" },
  { id: "fra-upamecano", name: "Dayot Upamecano", teamId: "fra", position: "DF" },
  // England (eng) — Group C
  { id: "eng-saka", name: "Bukayo Saka", teamId: "eng", position: "FW" },
  { id: "eng-bellingham", name: "Jude Bellingham", teamId: "eng", position: "MF" },
  { id: "eng-kane", name: "Harry Kane", teamId: "eng", position: "FW" },
  { id: "eng-rice", name: "Declan Rice", teamId: "eng", position: "MF" },
  { id: "eng-trippier", name: "Kieran Trippier", teamId: "eng", position: "DF" },
  // Spain (esp) — Group B
  { id: "esp-yamal", name: "Lamine Yamal", teamId: "esp", position: "FW" },
  { id: "esp-morata", name: "Álvaro Morata", teamId: "esp", position: "FW" },
  { id: "esp-pedri", name: "Pedri", teamId: "esp", position: "MF" },
  { id: "esp-gavi", name: "Gavi", teamId: "esp", position: "MF" },
  { id: "esp-rodri", name: "Rodri", teamId: "esp", position: "MF" },
  { id: "esp-carvajal", name: "Dani Carvajal", teamId: "esp", position: "DF" },
  // Mexico (mex) — Group A
  { id: "mex-quinones", name: "Julián Quiñones", teamId: "mex", position: "FW" },
  { id: "mex-jimenez", name: "Raúl Jiménez", teamId: "mex", position: "FW" },
  { id: "mex-lira", name: "Erik Lira", teamId: "mex", position: "MF" },
  { id: "mex-alvarado", name: "Roberto Alvarado", teamId: "mex", position: "MF" },
  { id: "mex-montes", name: "César Montes", teamId: "mex", position: "DF" },
  { id: "mex-ochoa", name: "Guillermo Ochoa", teamId: "mex", position: "GK" },
  // South Korea (kor) — Group D
  { id: "kor-hwang-hee-chan", name: "Hwang Hee-Chan", teamId: "kor", position: "FW" },
  { id: "kor-hwang-in-beom", name: "Hwang In-Beom", teamId: "kor", position: "MF" },
  { id: "kor-lee-kang-in", name: "Lee Kang-In", teamId: "kor", position: "MF" },
  { id: "kor-oh-hyeon-gyu", name: "Oh Hyeon-Gyu", teamId: "kor", position: "FW" },
  { id: "kor-kim-min-jae", name: "Kim Min-Jae", teamId: "kor", position: "DF" },
  // Canada (can) — Group A
  { id: "can-larin", name: "Cyle Larin", teamId: "can", position: "FW" },
  { id: "can-david", name: "Jonathan David", teamId: "can", position: "FW" },
  { id: "can-david-promise", name: "Promise David", teamId: "can", position: "MF" },
  { id: "can-buchanan", name: "Tajon Buchanan", teamId: "can", position: "FW" },
  { id: "can-johnston", name: "Alistair Johnston", teamId: "can", position: "DF" },
  // Bosnia & Herzegovina (bih) — Group A
  { id: "bih-dzeko", name: "Edin Džeko", teamId: "bih", position: "FW" },
  { id: "bih-demirovic", name: "Ermedin Demirović", teamId: "bih", position: "FW" },
  { id: "bih-lukic", name: "Jovo Lukić", teamId: "bih", position: "MF" },
  { id: "bih-kolasinac", name: "Sead Kolašinac", teamId: "bih", position: "DF" },
  // Czech Republic (cze) — Group D
  { id: "cze-schick", name: "Patrik Schick", teamId: "cze", position: "FW" },
  { id: "cze-krejci", name: "Ladislav Krejcí", teamId: "cze", position: "DF" },
  { id: "cze-coufal", name: "Vladimír Coufal", teamId: "cze", position: "DF" },
  // South Africa (rsa) — Group A
  { id: "rsa-mokoena", name: "Teboho Mokoena", teamId: "rsa", position: "MF" },
  { id: "rsa-zwane", name: "Themba Zwane", teamId: "rsa", position: "MF" },
  { id: "rsa-sithole", name: "Sphephelo Sithole", teamId: "rsa", position: "DF" },
  // Germany (ger)
  { id: "ger-musiala", name: "Jamal Musiala", teamId: "ger", position: "MF" },
  { id: "ger-havertz", name: "Kai Havertz", teamId: "ger", position: "MF" },
  { id: "ger-wirtz", name: "Florian Wirtz", teamId: "ger", position: "MF" },
  { id: "ger-ter-stegen", name: "Marc-André ter Stegen", teamId: "ger", position: "GK" },
  // Portugal (por)
  { id: "por-ronaldo", name: "Cristiano Ronaldo", teamId: "por", position: "FW" },
  { id: "por-felix", name: "João Félix", teamId: "por", position: "FW" },
  { id: "por-vitinha", name: "Vitinha", teamId: "por", position: "MF" },
];

function makeSeedProv() {
  return {
    source: "seed:wc26-known-roster",
    confidence: 0.3,
    verificationDate: TODAY,
    originType: "seeded" as const,
  };
}

// ---------------------------------------------------------------------------
// Wikidata SPARQL fetch (best-effort, no key required)
// ---------------------------------------------------------------------------

const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
const WIKIDATA_QUERY = `
SELECT ?player ?playerLabel ?teamId ?positionLabel WHERE {
  ?player wdt:P1344 wd:Q20897090 .
  OPTIONAL { ?player wdt:P54 ?team . ?team wdt:P1585 ?teamId . }
  OPTIONAL { ?player wdt:P413 ?position . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 300
`.trim();

interface WikidataBinding {
  playerLabel?: { value: string };
  teamId?: { value: string };
  positionLabel?: { value: string };
  player?: { value: string };
}

async function fetchFromWikidata(): Promise<PlayerRow[] | null> {
  try {
    const url = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(WIKIDATA_QUERY)}&format=json`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const resp = await fetch(url, {
      headers: { Accept: "application/sparql-results+json", "User-Agent": "wc26-players-agent/1.0" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const json = await resp.json() as { results: { bindings: WikidataBinding[] } };
    const bindings = json.results?.bindings ?? [];
    if (bindings.length < 10) return null;

    // Load clubs to validate teamId
    const clubs: Array<{ id: string }> = JSON.parse(readFileSync(path.join(appDir, "data", "clubs.json"), "utf8"));
    const validTeamIds = new Set(clubs.map((c) => c.id));

    const seen = new Set<string>();
    const rows: PlayerRow[] = [];
    for (const b of bindings) {
      const name = b.playerLabel?.value ?? "";
      const teamId = (b.teamId?.value ?? "").toLowerCase();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const resolvedTeamId = validTeamIds.has(teamId) ? teamId : null;
      if (!resolvedTeamId) continue;
      const posLabel = (b.positionLabel?.value ?? "").toLowerCase();
      const position = posLabel.includes("goalkeeper")
        ? "GK"
        : posLabel.includes("defender")
          ? "DF"
          : posLabel.includes("midfielder")
            ? "MF"
            : posLabel.includes("forward") || posLabel.includes("striker")
              ? "FW"
              : "MF";
      const id = `${resolvedTeamId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
      const entityUrl = b.player?.value ?? WIKIDATA_ENDPOINT;
      rows.push({
        id,
        name,
        teamId: resolvedTeamId,
        position,
        _prov: {
          source: entityUrl,
          confidence: 0.8,
          verificationDate: TODAY,
          originType: "verified",
        },
      });
    }
    return rows.length >= 10 ? rows : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("[fetch-players] Attempting Wikidata fetch...");
  let players: PlayerRow[] | null = await fetchFromWikidata();
  let source: "verified" | "seeded";

  if (players && players.length >= 10) {
    source = "verified";
    console.log(`[fetch-players] Wikidata returned ${players.length} verified players.`);
  } else {
    source = "seeded";
    console.log("[fetch-players] Network unavailable or insufficient data — using seeded fallback.");
    const prov = makeSeedProv();
    players = SEEDED_PLAYERS.map((p) => ({ ...p, _prov: prov }));
  }

  // Validate every row before writing
  for (const row of players) {
    assertProvenance(row);
  }

  const outPath = path.join(appDir, "data", "players.json");
  writeFileSync(outPath, JSON.stringify(players, null, 2) + "\n");
  const seededCount = players.filter((p) => p._prov?.originType === "seeded").length;
  const verifiedCount = players.filter((p) => p._prov?.originType === "verified").length;
  console.log(`[fetch-players] Wrote ${players.length} players (verified=${verifiedCount}, seeded=${seededCount}) → ${outPath}`);
  console.log(`[fetch-players] Source: ${source}`);
}

const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error("[fetch-players] Fatal:", err);
    process.exit(1);
  });
}
