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
  { id: "ministry", label: "The Ministry of Jesus", years: "AD 28–30", startBc: -28, endBc: -30, summary: "John prepares the way, Jesus teaches and heals for three years, and the cross, the empty tomb and Pentecost follow within a single year." },
  { id: "early-church", label: "The Church Begins", years: "AD 31–47", startBc: -31, endBc: -47, summary: "The first believers are scattered by persecution, the church's fiercest opponent is converted, and the gospel reaches beyond the Jews." },
  { id: "missions", label: "Paul and the Nations", years: "AD 48–62", startBc: -48, endBc: -62, summary: "Paul crosses the empire planting churches and writing letters, and the council at Jerusalem opens the door to the Gentiles." },
  { id: "apostolic-end", label: "Persecution & the Apostles' End", years: "AD 63–100", startBc: -63, endBc: -100, summary: "Nero turns on the church, the temple falls, and the last apostle writes from exile." },

  // ── After the New Testament — see docs/superpowers/specs/2026-09-11-church-history-findings.md §1.
  // The user-facing act label is "After New Testament", not "Church History"; these
  // period names stay their own specific historical titles.
  { id: "persecuted-church", label: "The Persecuted Church", years: "AD 101–312", startBc: -101, endBc: -312, summary: "Christians are a minority under intermittent, sometimes empire-wide persecution, while bishops, the canon and the creed take shape." },
  { id: "imperial-church", label: "The Church and the Empire", years: "AD 313–450", startBc: -313, endBc: -450, summary: "Constantine legalizes the faith, an emperor calls the first great councils, and Christianity becomes Rome's religion." },
  { id: "councils-and-mission", label: "Councils, Islam & the Mission to Europe", years: "AD 451–1053", startBc: -451, endBc: -1053, summary: "The church divides over Christ's nature, Islam sweeps the old heartlands, and missionaries carry the faith to Britain, Germany and the Slavs." },
  { id: "christendom", label: "Christendom Divided", years: "AD 1054–1516", startBc: -1054, endBc: -1516, summary: "East and West break communion, crusades and a captured Constantinople harden the split, and dissenters like Wycliffe and Hus foreshadow a bigger break to come." },
  { id: "reformation", label: "The Reformation", years: "AD 1517–1648", startBc: -1517, endBc: -1648, summary: "Luther's protest opens a flood of new traditions — Lutheran, Reformed, Anglican, Anabaptist — and a century of religious war ends in an uneasy peace." },
  { id: "awakenings", label: "Pietism & the Awakenings", years: "AD 1649–1799", startBc: -1649, endBc: -1799, summary: "Heart religion revives a cooling Protestantism, and Wesley's movement and the Great Awakening reshape Britain and America." },
  { id: "missions-revivals", label: "Missions & Revivals", years: "AD 1800–1899", startBc: -1800, endBc: -1899, summary: "Modern missions carry the gospel worldwide while, at home, revival and restoration movements multiply new American denominations." },
  { id: "global-church", label: "The Global Church", years: "AD 1900–present", startBc: -1900, endBc: -2030, summary: "Pentecostalism spreads from a Los Angeles revival to the whole world, Rome and the East take steps toward reconciliation, and most Christians now live in the Global South." },
];
