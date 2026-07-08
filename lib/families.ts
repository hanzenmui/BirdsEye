import type { Person } from "./types";

export interface FamilyMember {
  name: string;
  akaHint?: string; // substring that must appear in alsoKnownAs; omit to require an EMPTY alsoKnownAs
}

export interface FamilyCategory {
  key: string;
  label: string;
  members: FamilyMember[];
}

export const FAMILIES: FamilyCategory[] = [
  { key: "adam_family", label: "Adam's Family", members: [
    { name: "Adam" }, { name: "Eve" }, { name: "Cain" }, { name: "Abel" }, { name: "Seth" },
    { name: "Enoch", akaHint: "son of Cain" }, { name: "Enosh", akaHint: "Enos" },
    { name: "Enoch", akaHint: "son of Jared" }, { name: "Lamech", akaHint: "son of Methuselah" },
  ]},
  { key: "noah_family", label: "Noah's Family", members: [
    { name: "Noah" }, { name: "Shem" }, { name: "Ham" }, { name: "Japheth" },
    { name: "Cush" }, { name: "Nimrod" },
  ]},
  { key: "abraham_family", label: "Abraham's Family", members: [
    { name: "Abraham", akaHint: "Abram" }, { name: "Sarah", akaHint: "Sarai" }, { name: "Hagar" }, { name: "Ishmael" },
    { name: "Isaac" }, { name: "Esau", akaHint: "Edom" }, { name: "Jacob", akaHint: "Israel" },
    { name: "Terah" }, { name: "Haran" }, { name: "Nahor", akaHint: "son of Terah" }, { name: "Lot" },
  ]},
  { key: "isaac_family", label: "Isaac's Family", members: [
    { name: "Isaac" }, { name: "Rebekah", akaHint: "Rebecca" }, { name: "Esau", akaHint: "Edom" }, { name: "Jacob", akaHint: "Israel" },
    { name: "Bethuel" }, { name: "Laban" }, { name: "Leah" }, { name: "Rachel" },
  ]},
  { key: "jacob_family", label: "Jacob's Family", members: [
    { name: "Jacob", akaHint: "Israel" }, { name: "Leah" }, { name: "Rachel" },
    { name: "Bilhah" }, { name: "Zilpah", akaHint: "Zilpa" }, { name: "Reuben" }, { name: "Simeon" },
    { name: "Levi" }, { name: "Judah" }, { name: "Dan" }, { name: "Naphtali" },
    { name: "Gad" }, { name: "Asher" }, { name: "Issachar" }, { name: "Zebulun" },
    { name: "Dinah" }, { name: "Joseph" }, { name: "Benjamin" }, { name: "Laban" },
    { name: "Tamar" }, { name: "Er" }, { name: "Onan" }, { name: "Shelah", akaHint: "son of Judah" },
    { name: "Perez" }, { name: "Manasseh", akaHint: "son of Joseph" }, { name: "Ephraim" },
  ]},
  { key: "joseph_family", label: "Joseph's Family", members: [
    { name: "Joseph" }, { name: "Asenath" }, { name: "Manasseh", akaHint: "son of Joseph" },
    { name: "Ephraim" }, { name: "Jacob", akaHint: "Israel" }, { name: "Rachel" },
  ]},
  { key: "moses_family", label: "Moses' Family", members: [
    { name: "Amram" }, { name: "Jochebed" }, { name: "Moses" }, { name: "Aaron" },
    { name: "Miriam" }, { name: "Zipporah" }, { name: "Gershom" },
    { name: "Eliezer", akaHint: "son of Moses" }, { name: "Jethro", akaHint: "Reuel" },
    { name: "Elisheba" }, { name: "Nadab" }, { name: "Abihu" }, { name: "Eleazar" }, { name: "Ithamar" },
  ]},
  { key: "david_family", label: "David's Family", members: [
    { name: "Jesse" }, { name: "David" }, { name: "Michal" }, { name: "Abigail" },
    { name: "Bathsheba", akaHint: "Bath-shua" }, { name: "Solomon", akaHint: "Jedidiah" }, { name: "Absalom" }, { name: "Amnon" },
    { name: "Adonijah" }, { name: "Saul" }, { name: "Nabal" }, { name: "Uriah", akaHint: "the Hittite" },
    { name: "Tamar", akaHint: "daughter of David" },
  ]},
  { key: "jesus_family", label: "Jesus' Family", members: [
    { name: "Joseph", akaHint: "husband of Mary" }, { name: "Mary", akaHint: "mother of Jesus" },
    { name: "Jesus", akaHint: "Nazareth" }, { name: "Elizabeth" }, { name: "Zechariah", akaHint: "father of John the Baptist" },
    { name: "John the Baptist", akaHint: "son of Zechariah" },
  ]},
];

export function resolveFamilyMembers(people: Person[], family: FamilyCategory): Set<string> {
  const ids = new Set<string>();
  for (const m of family.members) {
    const match = people.find(p =>
      p.name === m.name && (m.akaHint ? p.alsoKnownAs.includes(m.akaHint) : p.alsoKnownAs === ""),
    );
    if (match) ids.add(match.id);
  }
  return ids;
}
