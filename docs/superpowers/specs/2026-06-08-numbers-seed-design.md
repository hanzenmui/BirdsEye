# seed-numbers.ts Design

**Date:** 2026-06-08
**Book:** Numbers
**Status:** Approved

## Context

Birdseye is a biblical genealogy app backed by a Turso (libSQL) database. Seed scripts populate the `people`, `relationships`, and `scripture_refs` tables. Genesis wiped and re-seeded from scratch. Exodus was additive. Numbers follows the same additive pattern as Exodus.

The DB already contains ~92 known people (67 Genesis + 25 Exodus) plus an unknown number from a Leviticus seed and other Numbers additions run from another machine (~37 people have Numbers scripture refs, ~11 have Leviticus refs). The script cannot assume it knows exactly who is already present.

## Key Design Decision: `safeInsertPerson`

All `insertPerson` calls are replaced with `safeInsertPerson`, which:
1. Queries `SELECT id FROM people WHERE name = ? LIMIT 1` before inserting
2. If found: maps the existing DB `id` into the local `ids` and `names` registries and skips the insert
3. If not found: inserts normally and maps the new UUID

This makes the script idempotent with respect to name — re-running it or running it when some people already exist will not create duplicates. It follows the same `insertRelByName` pattern already used in `seed-exodus.ts` for cross-book links.

## People (~40 new entries, grouped by narrative)

### Group 1 — Twelve Tribal Princes (Num 1, 2, 7, 10)
One prince appointed per tribe to lead its census count. Each also presented offerings at the tabernacle dedication (Num 7).

| Key | Name | Tribe |
|-----|------|-------|
| `nahshon` | Nahshon son of Amminadab | Judah |
| `nethanel` | Nethanel son of Zuar | Issachar |
| `eliab_helon` | Eliab son of Helon | Zebulun |
| `elizur` | Elizur son of Shedeur | Reuben |
| `shelumiel` | Shelumiel son of Zurishaddai | Simeon |
| `eliasaph` | Eliasaph son of Deuel | Gad |
| `elishama` | Elishama son of Ammihud | Ephraim |
| `gamaliel` | Gamaliel son of Pedahzur | Manasseh |
| `abidan` | Abidan son of Gideoni | Benjamin |
| `ahiezer` | Ahiezer son of Ammishaddai | Dan |
| `pagiel` | Pagiel son of Ocran | Asher |
| `ahira` | Ahira son of Enan | Naphtali |

### Group 2 — Korah's Rebellion (Num 16–17)
| Key | Name | Notes |
|-----|------|-------|
| `izhar` | Izhar | Son of Kohath (already seeded), father of Korah. Completes the Levitical lineage. |
| `korah` | Korah | Son of Izhar. Led a rebellion of 250 leaders against Moses and Aaron. Swallowed by the earth. |
| `dathan` | Dathan | Son of Eliab (Reubenite). Co-conspirator with Korah. |
| `abiram` | Abiram | Son of Eliab (Reubenite). Co-conspirator with Korah and Dathan. |

### Group 3 — Balaam Narrative (Num 22–24)
| Key | Name | Notes |
|-----|------|-------|
| `balak` | Balak | Son of Zippor, king of Moab. Hired Balaam to curse Israel. |
| `balaam` | Balaam | Son of Beor. Pagan prophet summoned to curse Israel; blessed them instead. His donkey spoke. Later credited with advising Midian to seduce Israel at Peor. |

### Group 4 — Peor Incident (Num 25)
Phinehas is already seeded from Exodus. These two are new.

| Key | Name | Notes |
|-----|------|-------|
| `zimri` | Zimri | Son of Salu, a Simeonite leader. Brazenly brought a Midianite woman into the camp during the plague. Killed by Phinehas. |
| `cozbi` | Cozbi | Daughter of Zur, a Midianite chieftain. Killed alongside Zimri by Phinehas. |

### Group 5 — Zelophehad's Daughters (Num 27, 36)
| Key | Name | Notes |
|-----|------|-------|
| `zelophehad` | Zelophehad | Son of Hepher (Manassehite). Died in the wilderness with no male heirs. His case established the legal precedent for daughters to inherit. |
| `mahlah` | Mahlah | Eldest daughter of Zelophehad. |
| `noah_z` | Noah | Daughter of Zelophehad. Key `alsoKnownAs`: "Noah daughter of Zelophehad" to distinguish from the patriarch Noah. |
| `hoglah` | Hoglah | Daughter of Zelophehad. |
| `milcah_z` | Milcah | Daughter of Zelophehad. `alsoKnownAs`: "Milcah daughter of Zelophehad" to distinguish from Milcah wife of Nahor. |
| `tirzah` | Tirzah | Youngest daughter of Zelophehad. Later also a city name in Canaan. |

### Group 6 — Levitical Clan Heads (Num 3–4)
Kohath is already seeded. These two complete the three Levitical clans used throughout Num 3–4 for tabernacle duties.

| Key | Name | Notes |
|-----|------|-------|
| `gershon` | Gershon | Son of Levi. His clan carried the tabernacle coverings and curtains. |
| `merari` | Merari | Son of Levi. His clan carried the tabernacle frames and bases. |

## Relationships

- Each tribal prince linked to their tribe patriarch via `insertRelByName`: `"[Tribe]" ancestor_of "[Prince]"` with a note
- Levitical chain: `insertRelByName("Levi", "parent_of", "Gershon")`, `insertRelByName("Levi", "parent_of", "Merari")`, `insertRelByName("Kohath", "parent_of", "Izhar")`, `insertRel("izhar", "parent_of", "korah")`
- Korah rebellion: `insertRel("korah", "adversary_of", "moses")`, `insertRel("dathan", "adversary_of", "moses")`, `insertRel("abiram", "adversary_of", "moses")`
- Zelophehad → 5 daughters via `insertRel`
- Balak/Balaam: `insertRel("balak", "adversary_of", "moses")`, `insertRel("balaam", "prophet_of", "god")` — Balak hired Balaam so `insertRel("balak", "ally_of", "balaam", "Hired Balaam to curse Israel")`
- Zimri/Cozbi: `insertRel("zimri", "adversary_of", "phinehas_aaron")` via `insertRelByName`

## Scripture References

| Person | Book | Range | Note |
|--------|------|-------|------|
| Princes (all 12) | Numbers | 1:5–16 | Appointed for census |
| Princes (all 12) | Numbers | 7:10–89 | Tabernacle offerings |
| Nahshon | Numbers | 2:3–4 | Leads Judah's regiment |
| Gershon | Numbers | 3:21–26 | Clan duties |
| Merari | Numbers | 3:33–37 | Clan duties |
| Izhar | Numbers | 16:1 | Father of Korah |
| Korah | Numbers | 16:1–35 | Rebellion and judgment |
| Dathan | Numbers | 16:1–35 | Co-rebel |
| Abiram | Numbers | 16:1–35 | Co-rebel |
| Balak | Numbers | 22:2–24:25 | Hires Balaam |
| Balaam | Numbers | 22:2–24:25 | Oracles and donkey |
| Zimri | Numbers | 25:6–15 | Killed by Phinehas |
| Cozbi | Numbers | 25:6–18 | Killed by Phinehas |
| Zelophehad | Numbers | 27:1–11 | No male heir; daughters' case |
| Zelophehad's daughters | Numbers | 27:1–11 | Inheritance ruling |
| Zelophehad's daughters | Numbers | 36:1–12 | Marrying within tribe |

## `package.json`

Add: `"seed:numbers": "npx tsx scripts/seed-numbers.ts"`

## What This Script Does NOT Do

- Does not wipe existing data
- Does not re-insert Genesis or Exodus people (handled by `safeInsertPerson`)
- Does not add census count numbers (not genealogical data)
- Does not add the 70 elders (unnamed in text)
- Does not add Eldad and Medad (minor, unnamed role beyond prophecy)
