export interface TimelinePeriod {
  id: string;
  label: string;
  years: string;
  startBc: number;
  endBc: number;
  summary: string;
}

// Both timeline layouts use the same chapter breaks. Keeping them here makes
// switching views feel like rotating one timeline instead of opening a
// different feature with a different interpretation of the dates.
export const TIMELINE_PERIODS: TimelinePeriod[] = [
  { id: "judges", label: "Settlement & Judges", years: "c. 1400–1051 BC", startBc: 1500, endBc: 1051, summary: "Israel settles in the land and repeatedly turns from oppression to rescue." },
  { id: "united", label: "The United Kingdom", years: "1050–932 BC", startBc: 1050, endBc: 932, summary: "Saul, David, and Solomon rule one kingdom, and Jerusalem becomes its center." },
  { id: "divided", label: "The Divided Kingdom", years: "931–723 BC", startBc: 931, endBc: 723, summary: "Israel divides north and south while prophets confront both kingdoms." },
  { id: "judah-alone", label: "Judah Stands Alone", years: "722–587 BC", startBc: 722, endBc: 587, summary: "After Israel falls to Assyria, Judah faces reform, warning, and Babylon." },
  { id: "exile-return", label: "Exile & Return", years: "586–350 BC", startBc: 586, endBc: 350, summary: "Jerusalem falls, the people live in exile, and a remnant returns to rebuild." },
  { id: "between", label: "Between the Testaments", years: "349–7 BC", startBc: 349, endBc: 7, summary: "No prophet speaks for four centuries while Greece, then Rome, reshape the world Jesus is born into." },
  { id: "nativity", label: "The Coming of Christ", years: "6 BC – AD 27", startBc: 6, endBc: -27, summary: "Rome rules, Herod builds, and a child is born in Bethlehem to a carpenter's family." },
  { id: "ministry", label: "The Ministry of Jesus", years: "AD 28–33", startBc: -28, endBc: -33, summary: "John prepares the way, Jesus teaches and heals for three years, and the cross and empty tomb follow." },
  { id: "early-church", label: "The Church Begins", years: "AD 33–47", startBc: -34, endBc: -47, summary: "The Spirit comes at Pentecost, the first believers are scattered by persecution, and the gospel reaches beyond the Jews." },
  { id: "missions", label: "Paul and the Nations", years: "AD 48–62", startBc: -48, endBc: -62, summary: "Paul crosses the empire planting churches and writing letters, and the council at Jerusalem opens the door to the Gentiles." },
  { id: "apostolic-end", label: "Persecution & the Apostles' End", years: "AD 63–100", startBc: -63, endBc: -100, summary: "Nero turns on the church, the temple falls, and the last apostle writes from exile." },
];
