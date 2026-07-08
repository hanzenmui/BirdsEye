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
  ]},
  { key: "noah_family", label: "Noah's Family", members: [
    { name: "Noah" }, { name: "Shem" }, { name: "Ham" }, { name: "Japheth" },
  ]},
  { key: "abraham_family", label: "Abraham's Family", members: [
    { name: "Abraham" }, { name: "Sarah" }, { name: "Hagar" }, { name: "Ishmael" },
    { name: "Isaac" }, { name: "Esau" }, { name: "Jacob", akaHint: "Israel" },
  ]},
  { key: "isaac_family", label: "Isaac's Family", members: [
    { name: "Isaac" }, { name: "Rebekah" }, { name: "Esau" }, { name: "Jacob", akaHint: "Israel" },
  ]},
  { key: "jacob_family", label: "Jacob's Family", members: [
    { name: "Jacob", akaHint: "Israel" }, { name: "Leah" }, { name: "Rachel" },
    { name: "Bilhah" }, { name: "Zilpah" }, { name: "Reuben" }, { name: "Simeon" },
    { name: "Levi" }, { name: "Judah" }, { name: "Dan" }, { name: "Naphtali" },
    { name: "Gad" }, { name: "Asher" }, { name: "Issachar" }, { name: "Zebulun" },
    { name: "Dinah" }, { name: "Joseph" }, { name: "Benjamin" },
  ]},
  { key: "joseph_family", label: "Joseph's Family", members: [
    { name: "Joseph" }, { name: "Asenath" }, { name: "Manasseh", akaHint: "son of Joseph" },
    { name: "Ephraim" }, { name: "Jacob", akaHint: "Israel" },
  ]},
  { key: "moses_family", label: "Moses' Family", members: [
    { name: "Amram" }, { name: "Jochebed" }, { name: "Moses" }, { name: "Aaron" },
    { name: "Miriam" }, { name: "Zipporah" }, { name: "Gershom" },
    { name: "Eliezer", akaHint: "son of Moses" },
  ]},
  { key: "david_family", label: "David's Family", members: [
    { name: "Jesse" }, { name: "David" }, { name: "Michal" }, { name: "Abigail" },
    { name: "Bathsheba" }, { name: "Solomon" }, { name: "Absalom" }, { name: "Amnon" },
    { name: "Adonijah" },
  ]},
  { key: "jesus_family", label: "Jesus' Family", members: [
    { name: "Joseph", akaHint: "husband of Mary" }, { name: "Mary", akaHint: "mother of Jesus" },
    { name: "Jesus" },
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
