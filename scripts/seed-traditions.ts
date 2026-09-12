// Traditions dataset: denominations, communions and movements from the
// Apostolic Church to today, and the edges that connect them. This is the
// data behind the Family Tree's "Traditions" picker group.
//
// See docs/superpowers/specs/2026-09-11-church-history-design.md for the
// editorial rule this whole file follows, and
// docs/superpowers/specs/2026-09-11-church-history-findings.md section 4 for
// the researched dataset this transcribes.
//
// THE RULE, restated because it is the one thing that must not drift while
// transcribing: at every MAJOR communion-level split (431, 451, 1054, 1517),
// the parent node ends and every resulting body is a same-generation child of
// it -- none of them inherits the parent's identity as though it alone
// continued. Ordinary denominational formation (Methodists leaving Anglican,
// etc.) uses plain split_from, since no "who's the real one" dispute exists
// there.
//
// Per Hanzen's explicit instruction: kind='cult' traditions (Mormonism,
// Jehovah's Witnesses, Christian Science) get ZERO tradition_edges rows of
// any kind -- not split_from, not influenced_by. They are seeded as islands.
//
// YEARS: same negative-for-AD convention as the rest of the timeline. AD 1517
// is stored as -1517.
//
// Idempotent -- safe to re-run; a second run with unchanged data arrays
// produces neither inserts nor updates.
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import { resolve } from "path";
import type { TraditionKind, TraditionTier, TraditionEdgeType, DateConfidence } from "../lib/types";
import { formatOpenYearSpan } from "../lib/timeline-layout";
import { getDb } from "../lib/db";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN,
});

const DRY_RUN = process.argv.includes("--dry-run");

// ── Traditions ───────────────────────────────────────────────────────────
// `key` is a script-local wiring id for the edges below, not stored in the
// DB. Traditions are matched for upsert by `name` alone, which is unique
// across this whole dataset (unlike people, no two traditions share a name).
interface TRow {
  key: string;
  name: string;
  aka?: string;
  kind: TraditionKind;
  tier: TraditionTier;
  start: number;             // AD year (positive here; negated on write)
  end?: number;              // AD year, or omitted for "still exists"
  region?: string;
  description: string;
  distinctives: string;
  adherents?: string;
  confidence?: DateConfidence;
  note?: string;
}

const TRADITIONS: TRow[] = [
  // ── Trunk ──────────────────────────────────────────────────────────────
  { key: "apostolic-church", name: "The Apostolic Church", kind: "communion", tier: 1, start: 30, end: 100,
    description: "The church of the apostles themselves, spreading from Jerusalem across the Roman world within a single generation.",
    distinctives: "No denominations yet to name -- one church, planted city by city by the apostles and their immediate co-workers." },
  { key: "early-church", name: "The Early Church", kind: "communion", tier: 1, start: 100, end: 431,
    description: "The church of the second through fourth centuries: bishops, a settled canon of scripture, and the Nicene Creed take shape, first under persecution and then under a Christian emperor.",
    distinctives: "One communion, East and West, defining itself against heresy through the great early councils (Nicaea 325, Constantinople 381) rather than dividing over them." },
  { key: "church-of-the-east", name: "Church of the East", aka: "Nestorian Church (a name it rejects), Assyrian Church of the East",
    kind: "communion", tier: 1, start: 431,
    description: "The ancient church of Persia and, later, the Silk Road -- reaching India and China (by 635) centuries before Western missionaries. Declined to accept the Council of Ephesus's condemnation of Nestorius.",
    distinctives: "Rejects the label 'Nestorian' as an opponent's caricature of its actual Christology. A genuinely separate, ancient church, not a Chalcedonian offshoot -- it predates the Chalcedon/Oriental Orthodox split by twenty years.",
    adherents: "~400,000 today, a remnant of a once-vast medieval church",
    confidence: "uncertain",
    note: "The separation from the wider imperial church was gradual, not a single event: administrative independence in 424, Ephesus in 431, and doctrinal divergence hardening over decades after." },
  { key: "imperial-church", name: "The Imperial Church", kind: "communion", tier: 1, start: 431, end: 451,
    description: "The church of the Roman Empire after the Church of the East went its own way -- still one body spanning both the Greek East and Latin West.",
    distinctives: "The last twenty years before Chalcedon's Christological definition split it again." },
  { key: "oriental-orthodox", name: "Oriental Orthodox", kind: "communion", tier: 1, start: 451,
    description: "The communion of churches that rejected the Council of Chalcedon's formula for how Christ's two natures relate, while affirming his full divinity and full humanity.",
    distinctives: "Miaphysite: Christ's divinity and humanity united in one nature without confusion, change, division or separation -- not the 'monophysitism' (a single, blended nature) that Chalcedon actually condemned. Modern Catholic-Oriental Orthodox dialogue has largely concluded the historic dispute was substantially verbal.",
    adherents: "~60 million" },
  { key: "chalcedonian-church", name: "The Chalcedonian Church", kind: "communion", tier: 1, start: 451, end: 1054,
    description: "The imperial church East and West after Chalcedon, holding Christ in two natures, one person -- the body that would itself split at the Great Schism.",
    distinctives: "Confesses all seven ecumenical councils; the last six centuries East and West shared communion before their own split." },
  { key: "eastern-orthodox", name: "Eastern Orthodox Church", kind: "communion", tier: 1, start: 1054,
    description: "The communion of self-governing churches (Greek, Russian, Serbian, Romanian, Antiochian and others) that trace unbroken continuity with the ancient patriarchates of the East, especially Constantinople.",
    distinctives: "Conciliar rather than papal governance; holds to the seven ecumenical councils; theology expressed as much through worship and icon as through doctrinal statement.",
    adherents: "~220 million" },
  { key: "western-church", name: "Western Church", kind: "communion", tier: 1, start: 1054, end: 1517,
    description: "Latin-rite Christendom under the bishop of Rome, from the Great Schism to the Reformation -- the last four and a half centuries before it divided again.",
    distinctives: "The medieval Catholic West: scholastic theology, the rise of the papacy's temporal power, and the monastic and mendicant movements, before Luther's protest opened a new division." },
  { key: "roman-catholic", name: "Roman Catholic Church", kind: "communion", tier: 1, start: 1517,
    description: "The communion under the bishop of Rome that continued through the Reformation rather than joining it, defining itself doctrinally against Protestant teaching at the Council of Trent (1545-1563).",
    distinctives: "Universal jurisdiction of the pope; seven sacraments; scripture and sacred tradition together as the rule of faith; papal infallibility on formal statements of faith and morals (defined 1870).",
    adherents: "~1.4 billion, the largest single Christian body" },

  // ── Reformation, tier 1 ──────────────────────────────────────────────────
  // Own `start` matches how each is conventionally dated in popular usage;
  // the more precise "when this became a distinct body" year lives on the
  // tradition_edges row instead (see EDGES below and the findings doc).
  { key: "lutheran", name: "Lutheran", kind: "tradition", tier: 1, start: 1517,
    description: "The tradition descending from Martin Luther's protest against the sale of indulgences, formalized as a confessional body at the Diet of Augsburg.",
    distinctives: "Justification by faith alone (sola fide); scripture alone as final authority (sola scriptura); Christ truly, bodily present in the Lord's Supper (against both the Catholic and the Reformed positions).",
    adherents: "~75 million",
    note: "Conventionally dated to 1517 (the Ninety-five Theses), but a distinct confessional body only from the Augsburg Confession in 1530." },
  { key: "reformed", name: "Reformed", aka: "Calvinist", kind: "tradition", tier: 1, start: 1536,
    description: "The tradition descending from Zwingli's Zurich and, above all, Calvin's Geneva.",
    distinctives: "God's sovereignty in salvation, classically summarized (after Calvin) in the five points of Dort; a covenantal reading of scripture; church government by elders (presbyterian or congregational) rather than bishops.",
    adherents: "~75 million across its Presbyterian, Congregational and Reformed-national-church descendants" },
  { key: "anglican", name: "Anglican", kind: "tradition", tier: 1, start: 1534,
    description: "The tradition descending from the Church of England's break with Rome under Henry VIII, later given its lasting doctrinal shape under Elizabeth I and Cranmer.",
    distinctives: "Catholic order (bishops, liturgy, sacraments) combined with Reformed doctrine, held together above all by the Book of Common Prayer rather than one confessional statement.",
    adherents: "~85 million (the Anglican Communion)" },
  { key: "anabaptist", name: "Anabaptist", kind: "tradition", tier: 1, start: 1525,
    description: "The tradition descending from the Radical Reformation's insistence that baptism belongs to believers, not infants -- the 'rebaptizers' the name refers to, from the movement's own view that infant baptism was no baptism at all.",
    distinctives: "Believer's (adult) baptism; the church as a voluntary community separate from state power; discipleship and, in most branches, nonresistance. Persecuted by Catholics and mainline Protestants alike in the 16th century.",
    adherents: "~2-3 million across Mennonite, Amish, Hutterite and Brethren descendants" },

  // ── Oriental Orthodox members ────────────────────────────────────────────
  // Not five churches born from one that later fragmented -- five separate
  // national churches sharing a Christology, later recognizing each other as
  // being in communion. See the findings doc's honesty note on this.
  { key: "coptic-orthodox", name: "Coptic Orthodox Church", kind: "communion", tier: 2, start: 451, region: "Egypt",
    description: "The historic church of Egypt, tracing its founding to the apostle Mark.",
    distinctives: "Alexandria's own liturgical and monastic tradition -- Egyptian Christian monasticism (Antony, Pachomius) predates the Oriental Orthodox split itself.", adherents: "~10-15 million" },
  { key: "armenian-apostolic", name: "Armenian Apostolic Church", kind: "communion", tier: 2, start: 301, region: "Armenia",
    description: "Armenia's national church, and by tradition the first kingdom to adopt Christianity as its state religion.",
    distinctives: "A distinct national identity fused with the faith since Gregory the Illuminator's mission; joined the Oriental Orthodox communion's rejection of Chalcedon from 451.", adherents: "~9 million",
    note: "Founded as Armenia's national church in 301, well before the Oriental Orthodox split itself; its alignment against Chalcedon dates from 451." },
  { key: "ethiopian-orthodox", name: "Ethiopian Orthodox Tewahedo Church", kind: "communion", tier: 2, start: 330, region: "Ethiopia",
    description: "Ethiopia's ancient national church, tracing its founding to Frumentius's mission to the Aksumite kingdom.",
    distinctives: "Preserves an Old Testament-influenced liturgical calendar and practice (Sabbath observance alongside Sunday, dietary rules) unlike any other Christian communion.", adherents: "~40-50 million",
    confidence: "uncertain", note: "Traditionally dated to the fourth century under King Ezana; the exact year is not firmly fixed." },
  { key: "syriac-orthodox", name: "Syriac Orthodox Church", kind: "communion", tier: 2, start: 451, region: "Syria/Middle East",
    description: "The historic church of Antioch and the Syriac-speaking Middle East.",
    distinctives: "Liturgy in Syriac, a dialect of Aramaic close to the language Jesus himself spoke.", adherents: "~2-4 million" },
  { key: "malankara", name: "Malankara (Saint Thomas Christians)", kind: "communion", tier: 2, start: 1653, region: "India",
    description: "The ancient Christian community of Kerala, India, tracing its founding to the apostle Thomas but reasserting an independent, Oriental-aligned identity in the Coonan Cross Oath of 1653 after a century of Portuguese Catholic pressure.",
    distinctives: "Combines an apostolic founding tradition older than most of Christendom with a distinctly modern (17th-century) act of independence from imposed Roman authority.",
    note: "Start year (1653) marks the Coonan Cross Oath and the community's turn toward Oriental Orthodox affiliation, not the much older Thomas tradition itself, which this dataset does not attempt to date." },

  // ── From Reformed ────────────────────────────────────────────────────────
  { key: "presbyterian", name: "Presbyterian", kind: "tradition", tier: 2, start: 1560, region: "Scotland, originally",
    description: "Reformed Christianity as John Knox organized it in Scotland, taking Calvin's Geneva as its model.",
    distinctives: "Government by elected elders (presbyters) organized in ascending courts (session, presbytery, synod, general assembly) rather than by bishops." },
  { key: "pcusa", name: "Presbyterian Church (U.S.A.)", kind: "denomination", tier: 3, start: 1983,
    description: "The largest American Presbyterian body, formed by the reunion of northern and southern branches split since the Civil War.",
    distinctives: "The mainline, more theologically liberal of the two major American Presbyterian bodies.",
    note: "Simplified here as a direct branch of Presbyterian; it is technically the 1983 merger of two 19th-century-split predecessor bodies, not modeled separately." },
  { key: "pca", name: "Presbyterian Church in America", kind: "denomination", tier: 3, start: 1973,
    description: "A theologically conservative body that left the then-Presbyterian Church US (the southern branch) over liberalizing trends.",
    distinctives: "Holds to traditional Reformed confessional standards (the Westminster Confession) more strictly than the PCUSA." },
  { key: "congregational", name: "Congregational", kind: "tradition", tier: 2, start: 1582, region: "England, originally",
    description: "Reformed Christianity organized so that each local congregation governs itself, with no bishop or presbytery above it.",
    distinctives: "Local church autonomy as a matter of principle, not convenience -- the polity, more than any single doctrine, is the distinctive." },
  { key: "ucc", name: "United Church of Christ", kind: "denomination", tier: 3, start: 1957,
    description: "Formed by the merger of the Congregational Christian Churches with the Evangelical and Reformed Church.",
    distinctives: "One of the most theologically and socially liberal mainline American denominations, retaining strong congregational polity.",
    note: "A genuine merger of two predecessor bodies, simplified here as a branch of Congregational." },
  { key: "dutch-reformed", name: "Dutch Reformed (Reformed Church in America / Christian Reformed Church)", kind: "tradition", tier: 2, start: 1628,
    description: "Reformed Christianity as Dutch settlers brought it to New Amsterdam, later splitting into more and less assimilated American branches.",
    distinctives: "Retains a distinctly Dutch confessional heritage (the Three Forms of Unity) shared with the Reformed churches of the Netherlands." },

  // ── From Anglican ────────────────────────────────────────────────────────
  { key: "episcopal-church", name: "Episcopal Church (USA)", kind: "denomination", tier: 2, start: 1789,
    description: "The American branch of the Anglican Communion, organized as its own independent province after the Revolution severed ties to the Church of England's monarch-linked structure.",
    distinctives: "Full Anglican identity and liturgy without any legal tie to the British crown." },
  { key: "methodist", name: "Methodist", kind: "tradition", tier: 1, start: 1784,
    description: "The tradition descending from John Wesley's renewal societies within the Church of England, organized as an independent church in America at the Christmas Conference of 1784.",
    distinctives: "Entire sanctification as an obtainable Christian goal, not just justification; a 'connexional' structure of itinerant preachers and class meetings; hymnody (Charles Wesley) as central to worship as preaching." },
  { key: "united-methodist", name: "United Methodist Church", kind: "denomination", tier: 3, start: 1968,
    description: "Formed by the merger of the Methodist Church with the Evangelical United Brethren Church.",
    distinctives: "The largest American Methodist body, and, until a wave of 21st-century departures over sexuality, one of the largest Protestant denominations in the US.",
    note: "A genuine merger, simplified here as a branch of Methodist." },
  { key: "ame", name: "African Methodist Episcopal Church", kind: "denomination", tier: 3, start: 1816,
    description: "Founded by Richard Allen, a formerly enslaved man, after Black worshippers faced discrimination in a white Methodist congregation in Philadelphia.",
    distinctives: "The first fully independent Black denomination in America, and a central institution of Black religious and civic life ever since." },
  { key: "free-methodist", name: "Free Methodist Church", kind: "denomination", tier: 3, start: 1860,
    description: "Broke away over slavery, pew rental (which excluded the poor), and a call to return to Wesley's original emphasis on holiness.",
    distinctives: "'Free' in its founders' sense: free pews, free from slavery, and freedom in worship style." },

  // ── From Anabaptist ──────────────────────────────────────────────────────
  { key: "mennonite", name: "Mennonite", kind: "denomination", tier: 2, start: 1536,
    description: "Named for Menno Simons, a former Catholic priest who became a leading Anabaptist teacher after the movement's chaotic early years.",
    distinctives: "Believer's baptism, nonresistance and separation from worldly power, organized around stable, disciplined congregational communities." },
  { key: "hutterite", name: "Hutterite", kind: "denomination", tier: 2, start: 1528,
    description: "Named for Jakob Hutter, an early Anabaptist leader martyred in 1536.",
    distinctives: "Communal ownership of property, practiced continuously since the movement's founding -- the most consistently communal of the historic Anabaptist branches." },
  { key: "amish", name: "Amish", kind: "denomination", tier: 3, start: 1693,
    description: "Jakob Ammann led a group of Swiss and Alsatian Mennonites to split off over stricter church discipline and separation from society.",
    distinctives: "Deliberate technological and social separation from the wider world (varying by community), retained as a matter of principle." },

  // ── Baptist (English Separatism, with Anabaptist influence) ─────────────
  { key: "baptist", name: "Baptist", kind: "tradition", tier: 1, start: 1609, region: "England/Netherlands, originally",
    description: "Emerging from English Separatists dissenting against the Church of England, adopting believer's baptism under the influence of the continental Anabaptists they encountered in exile in Amsterdam.",
    distinctives: "Believer's baptism by immersion; strict local church autonomy; historically strong advocacy for religious liberty and separation of church and state.",
    adherents: "~75-100 million worldwide" },
  { key: "southern-baptist", name: "Southern Baptist Convention", kind: "denomination", tier: 3, start: 1845,
    description: "Formed when Southern Baptists split from the national Baptist body over whether slaveholders could serve as missionaries.",
    distinctives: "The largest Protestant denomination in the United States today; congregational polity with a strong shared missionary and seminary infrastructure." },
  { key: "american-baptist", name: "American Baptist Churches USA", kind: "denomination", tier: 3, start: 1907,
    description: "The northern (non-slaveholding) continuation of the national Baptist body, formally organized as a national convention in 1907.",
    distinctives: "More theologically and socially diverse than the Southern Baptist Convention, without a single mandatory confession." },
  { key: "baptist-union-gb", name: "Baptist Union of Great Britain", kind: "denomination", tier: 3, start: 1813,
    description: "The main organized body of Baptist churches in England, Scotland and Wales.",
    distinctives: "Home tradition of figures like Charles Spurgeon and William Carey." },

  // ── From Methodist/Wesleyan: Holiness ────────────────────────────────────
  { key: "holiness-movement", name: "Holiness movement", kind: "movement", tier: 2, start: 1867,
    description: "American Methodists committed to John Wesley's teaching on entire sanctification organized to promote it as a distinct, obtainable experience, amid a Methodism they felt had cooled toward it.",
    distinctives: "A crisis experience of sanctification subsequent to conversion, alongside (in most Holiness bodies) high standards of personal conduct." },
  { key: "nazarene", name: "Church of the Nazarene", kind: "denomination", tier: 3, start: 1908,
    description: "Formed by the merger of several regional Holiness bodies into one national denomination.",
    distinctives: "The largest denomination to emerge directly from the Wesleyan Holiness movement, not Pentecostal." },
  { key: "salvation-army", name: "The Salvation Army", kind: "denomination", tier: 3, start: 1865,
    description: "William and Catherine Booth, both with Methodist roots, founded a mission to London's poor that grew into a worldwide, quasi-military organization.",
    distinctives: "Combines evangelism with large-scale social service (shelters, disaster relief, thrift stores) under a uniformed, ranked structure modeled on the military." },
  { key: "wesleyan-church", name: "The Wesleyan Church", kind: "denomination", tier: 3, start: 1968,
    description: "Formed by the merger of the Wesleyan Methodist Church and the Pilgrim Holiness Church, two older Holiness bodies.",
    distinctives: "Historic roots in 19th-century abolitionism (the Wesleyan Methodist Connection split from Methodism partly over slavery)." },
  { key: "cog-anderson", name: "Church of God (Anderson, Indiana)", kind: "denomination", tier: 3, start: 1881,
    description: "D. S. Warner left the General Eldership of the Churches of God, holding that organized denominations were themselves a barrier to Christian unity, and began a reformation movement based in Anderson, Indiana.",
    distinctives: "Explicitly anti-denominational in self-understanding -- it does not consider itself one denomination among many, but a call back to simple New Testament Christianity. Holiness, not Pentecostal. Entirely unrelated to the similarly named Church of God in Cleveland, Tennessee." },

  // ── From Holiness: Pentecostalism ────────────────────────────────────────
  { key: "pentecostalism", name: "Pentecostalism", kind: "movement", tier: 2, start: 1906,
    description: "William J. Seymour's Azusa Street revival in Los Angeles sent a Holiness-movement teaching about the baptism of the Holy Spirit -- evidenced by speaking in tongues -- out to become a worldwide movement.",
    distinctives: "Baptism in the Holy Spirit as a distinct experience after conversion, evidenced by speaking in tongues; the ongoing operation of spiritual gifts (healing, prophecy, tongues) as normal Christian experience, not confined to the apostolic age.",
    adherents: "~280 million in classical Pentecostal denominations, over 600 million including the charismatic movement",
    note: "Its doctrinal roots trace to Charles Parham's Bible school in Topeka, Kansas (1901); Azusa Street (1906) is what made it a global movement." },
  { key: "assemblies-of-god", name: "Assemblies of God", kind: "denomination", tier: 3, start: 1914,
    description: "Pentecostal ministers meeting in Hot Springs, Arkansas, organized what became the largest Pentecostal denomination in the world.",
    distinctives: "Classical Pentecostal doctrine (initial evidence of tongues) with a comparatively centralized, credentialing denominational structure for a Pentecostal body." },
  { key: "cog-cleveland", name: "Church of God (Cleveland, Tennessee)", kind: "denomination", tier: 3, start: 1886,
    description: "Founded as the Christian Union in the mountains of Tennessee and North Carolina, two decades before Azusa Street, and adopted Pentecostal doctrine after 1906.",
    distinctives: "The oldest Pentecostal denomination in America by founding date, even though it was not Pentecostal at its founding. Entirely unrelated to the similarly named Church of God in Anderson, Indiana." },
  { key: "cogic", name: "Church of God in Christ", kind: "denomination", tier: 3, start: 1897,
    description: "Founded by Charles Harrison Mason as a Holiness body, and became Pentecostal after Mason's own experience at Azusa Street in 1907.",
    distinctives: "The largest historically Black Pentecostal denomination in the United States." },
  { key: "foursquare", name: "Foursquare Church", kind: "denomination", tier: 3, start: 1923,
    description: "Founded by Aimee Semple McPherson, a pioneering Pentecostal evangelist and one of the first women to found and lead a major American denomination.",
    distinctives: "Named for a four-part description of Christ (Savior, Baptizer in the Holy Spirit, Healer, and Coming King)." },

  // ── From Pentecostalism: charismatic renewal ─────────────────────────────
  { key: "charismatic-renewal", name: "Charismatic renewal", kind: "movement", tier: 2, start: 1960,
    description: "Pentecostal-style spiritual experience (tongues, healing, prophecy) spread into existing mainline Protestant and Catholic churches, rather than forming new denominations of its own.",
    distinctives: "Unlike classical Pentecostalism, mostly stayed and renewed existing traditions rather than splitting from them -- an Episcopal priest (Dennis Bennett, 1960) and a Catholic student prayer weekend (Duquesne University, 1967) are its two best-known starting points." },
  { key: "vineyard", name: "Vineyard", kind: "denomination", tier: 3, start: 1982,
    description: "Founded by John Wimber, blending charismatic spiritual gifts with a low-key, contemporary worship style that influenced evangelical worship far beyond its own churches.",
    distinctives: "'Empowered evangelicalism' -- the theology of an ordinary evangelical church combined with an expectation of the miraculous." },
  { key: "calvary-chapel", name: "Calvary Chapel", kind: "denomination", tier: 3, start: 1965,
    description: "Chuck Smith, a pastor with Foursquare Pentecostal roots, opened his small congregation to the counter-cultural 'Jesus People' of the late 1960s, sparking a movement of informal, Bible-teaching-centered churches.",
    distinctives: "Verse-by-verse expository Bible teaching as the centerpiece of the service, deliberately informal in style and dress." },

  // ── Pre-Reformation dissent ──────────────────────────────────────────────
  { key: "waldensian", name: "Waldensian", kind: "denomination", tier: 2, start: 1173,
    description: "Peter Waldo, a wealthy merchant of Lyon, gave away his possessions to preach poverty and scripture in the common tongue -- and was excommunicated for it. Survived underground for three centuries before formally joining the Reformation.",
    distinctives: "The oldest Protestant-adjacent movement still in existence, predating Luther by over three centuries." },
  { key: "hussite", name: "Hussite", aka: "Bohemian Brethren", kind: "denomination", tier: 2, start: 1415,
    description: "Followers of Jan Hus, burned at Constance in 1415 despite a promised safe conduct, fought a series of wars in Bohemia in his name and preserved a distinct reform tradition for a century before Luther.",
    distinctives: "Communion in both bread and wine for the laity (against Catholic practice of the time) was their defining early demand." },
  { key: "moravian", name: "Moravian Church", aka: "Unitas Fratrum", kind: "denomination", tier: 3, start: 1457,
    description: "Organized directly out of the Hussite movement, and renewed two and a half centuries later by refugees gathered at Count Zinzendorf's estate at Herrnhut (1727), where a spiritual revival launched a hundred-year continuous prayer meeting and the first sustained Protestant missionary movement.",
    distinctives: "A missionary intensity, per capita, unmatched by any other Protestant body historically; its 1727 Herrnhut community directly shaped John Wesley's own conversion eleven years later." },

  // ── Other ────────────────────────────────────────────────────────────────
  { key: "quaker", name: "Quaker", aka: "Religious Society of Friends", kind: "denomination", tier: 2, start: 1652,
    description: "George Fox taught that the Spirit of Christ speaks directly and immediately to every believer ('that of God in everyone'), without need of clergy, creed, or the outward sacraments.",
    distinctives: "Traditionally silent, unprogrammed worship awaiting the Spirit's leading; rejection of oaths, violence and (originally) all outward ceremony; a leading historic voice against slavery." },
  { key: "restoration-movement", name: "Restoration Movement", kind: "movement", tier: 2, start: 1832,
    description: "Barton Stone (from a Presbyterian background) and Alexander Campbell (from a Baptist/Presbyterian background) each led independent efforts to restore New Testament Christianity beyond denominational labels, then merged their movements.",
    distinctives: "'No creed but Christ, no book but the Bible' -- a rejection of denominational identity itself as a hindrance to Christian unity, similar in spirit to (but historically unconnected with) the Church of God (Anderson) reformation." },
  { key: "churches-of-christ", name: "Churches of Christ", kind: "denomination", tier: 3, start: 1906,
    description: "Split from the Disciples of Christ largely over the use of instrumental music in worship, first counted as a separate body in the 1906 religious census.",
    distinctives: "A cappella congregational singing only, on the conviction that scripture nowhere commands instruments in New Testament worship; strict congregational autonomy." },
  { key: "disciples-of-christ", name: "Disciples of Christ", aka: "Christian Church (Disciples of Christ)", kind: "denomination", tier: 3, start: 1968,
    description: "The more ecumenically minded, mainline continuation of the Restoration Movement, formally restructured as its own denomination in 1968.",
    distinctives: "Retains the Restoration Movement's emphasis on weekly communion and believer's baptism while embracing broader ecumenical cooperation than Churches of Christ." },
  { key: "adventist", name: "Adventist", kind: "movement", tier: 2, start: 1844,
    description: "William Miller, a Baptist preacher, led thousands to expect Christ's return on a specific date in 1844. When it did not occur -- the Great Disappointment -- the movement's remnant, led in part by Ellen G. White, reorganized around a reinterpreted, still-imminent expectation of Christ's return.",
    distinctives: "A strong emphasis on the nearness of Christ's second coming shapes the whole movement's identity, however individual bodies within it differ otherwise." },
  { key: "seventh-day-adventist", name: "Seventh-day Adventist Church", kind: "denomination", tier: 3, start: 1863,
    description: "The largest and most enduring body to emerge from the Adventist movement's aftermath, formally organized in 1863.",
    distinctives: "Worship on the seventh-day Sabbath (Saturday) rather than Sunday, alongside its Adventist expectation of Christ's soon return." },
  { key: "evangelicalism", name: "Evangelicalism", kind: "movement", tier: 2, start: 1738,
    description: "A trans-denominational movement, not a denomination itself, uniting believers across Reformed, Methodist, Baptist and other traditions around a shared core.",
    distinctives: "Historian David Bebbington's four marks are the standard summary: conversionism (a decisive personal conversion), biblicism (the Bible as the ultimate authority), crucicentrism (the cross as the heart of the gospel), and activism (the gospel expressed in effort, evangelistic and social)." },

  // ── Non-denominational ───────────────────────────────────────────────────
  { key: "non-denominational", name: "Non-denominational", kind: "movement", tier: 2, start: 1970,
    description: "Congregations with no denominational affiliation or hierarchy above the local church -- often calling themselves a 'community church' or 'Bible church' rather than naming a tradition at all.",
    distinctives: "By congregation count, the largest single category of American Protestant churches today. Its roots are genuinely too diffuse to trace to one parent: Evangelicalism's trans-denominational instinct, the Restoration Movement's rejection of denominational labels, and post-Pentecostal independency all feed into it at once." },

  // ── Cult category -- kind='cult', zero tradition_edges rows, per Hanzen ──
  { key: "lds", name: "The Church of Jesus Christ of Latter-day Saints", aka: "Mormonism, LDS Church", kind: "cult", tier: 2, start: 1830,
    description: "Founded by Joseph Smith at Fayette, New York, on the claim of new scripture -- the Book of Mormon -- and continuing revelation through living prophets.",
    distinctives: "Rejects the Trinity as historic Christianity defines it, teaching instead that the Father, Son and Holy Spirit are three distinct, embodied beings united in purpose.",
    adherents: "~17 million" },
  { key: "jehovahs-witnesses", name: "Jehovah's Witnesses", kind: "cult", tier: 2, start: 1931,
    description: "Grew from Charles Taze Russell's Bible Student movement (Zion's Watch Tower, from 1879); took the name 'Jehovah's Witnesses' in July 1931 under his successor, J. F. Rutherford.",
    distinctives: "Rejects the Trinity, the soul's conscious survival of death, and Christ's bodily resurrection; known for door-to-door evangelism and refusal of blood transfusions and military service.",
    adherents: "~8.7 million active publishers worldwide" },
  { key: "christian-science", name: "Christian Science", aka: "Church of Christ, Scientist", kind: "cult", tier: 2, start: 1879,
    description: "Founded by Mary Baker Eddy, who chartered the Church of Christ, Scientist in Boston in 1879 after publishing Science and Health with Key to the Scriptures (1875).",
    distinctives: "Teaches that sickness, sin and matter itself are ultimately unreal, and that healing comes through correct spiritual understanding rather than medicine." },
];

// ── Edges ────────────────────────────────────────────────────────────────
interface ERow {
  parent: string;
  child: string;
  type: TraditionEdgeType;
  year: number;
  eventTitle?: string;       // resolved to historical_events.id by exact title
  notes?: string;
}

const EDGES: ERow[] = [
  // Trunk -- the four major, symmetric splits. All children of one split
  // share the same year and event, per the design doc's editorial rule.
  { parent: "apostolic-church", child: "early-church", type: "split_from", year: 100,
    notes: "Not a split at all, just the conventional end of the apostolic generation -- kept as an edge so the trunk forms one continuous tree." },
  { parent: "early-church", child: "church-of-the-east", type: "split_from", year: 431, eventTitle: "The Council of Ephesus" },
  { parent: "early-church", child: "imperial-church", type: "split_from", year: 431, eventTitle: "The Council of Ephesus" },
  { parent: "imperial-church", child: "oriental-orthodox", type: "split_from", year: 451, eventTitle: "The Council of Chalcedon" },
  { parent: "imperial-church", child: "chalcedonian-church", type: "split_from", year: 451, eventTitle: "The Council of Chalcedon" },
  { parent: "chalcedonian-church", child: "eastern-orthodox", type: "split_from", year: 1054, eventTitle: "The Great Schism" },
  { parent: "chalcedonian-church", child: "western-church", type: "split_from", year: 1054, eventTitle: "The Great Schism" },
  { parent: "western-church", child: "roman-catholic", type: "split_from", year: 1517, eventTitle: "Luther posts the Ninety-five Theses" },
  { parent: "western-church", child: "lutheran", type: "split_from", year: 1530, eventTitle: "The Augsburg Confession" },
  { parent: "western-church", child: "anglican", type: "split_from", year: 1534, eventTitle: "The Act of Supremacy" },
  { parent: "western-church", child: "anabaptist", type: "split_from", year: 1525, eventTitle: "The first Anabaptist baptism" },
  { parent: "western-church", child: "reformed", type: "split_from", year: 1536, eventTitle: "Calvin publishes the Institutes and reaches Geneva" },

  // Oriental Orthodox members
  { parent: "oriental-orthodox", child: "coptic-orthodox", type: "split_from", year: 451,
    notes: "A simplification for the tree -- see the findings doc: these were separate national churches before 451, not one church that later fragmented five ways." },
  { parent: "oriental-orthodox", child: "armenian-apostolic", type: "split_from", year: 451,
    notes: "Armenia's national church since 301; its alignment against Chalcedon dates from 451." },
  { parent: "oriental-orthodox", child: "ethiopian-orthodox", type: "split_from", year: 451 },
  { parent: "oriental-orthodox", child: "syriac-orthodox", type: "split_from", year: 451 },
  { parent: "oriental-orthodox", child: "malankara", type: "split_from", year: 1653,
    notes: "The Coonan Cross Oath, when this ancient community turned toward Oriental Orthodox affiliation after a century of Portuguese Catholic pressure." },

  // From Reformed
  { parent: "reformed", child: "presbyterian", type: "split_from", year: 1560 },
  { parent: "presbyterian", child: "pcusa", type: "split_from", year: 1983 },
  { parent: "presbyterian", child: "pca", type: "split_from", year: 1973 },
  { parent: "reformed", child: "congregational", type: "split_from", year: 1582 },
  { parent: "congregational", child: "ucc", type: "split_from", year: 1957 },
  { parent: "reformed", child: "dutch-reformed", type: "split_from", year: 1628 },

  // From Anglican
  { parent: "anglican", child: "episcopal-church", type: "split_from", year: 1789 },
  { parent: "anglican", child: "methodist", type: "split_from", year: 1784, eventTitle: "The Christmas Conference" },
  { parent: "moravian", child: "methodist", type: "influenced_by", year: 1738, eventTitle: "Wesley's heart is 'strangely warmed'",
    notes: "Wesley's own account of Aldersgate names hearing Luther's preface to Romans read at a Moravian meeting as the turning point -- Anglican by descent, Moravian by influence." },
  { parent: "methodist", child: "united-methodist", type: "merged_into", year: 1968 },
  { parent: "methodist", child: "ame", type: "split_from", year: 1816 },
  { parent: "methodist", child: "free-methodist", type: "split_from", year: 1860 },
  { parent: "anglican", child: "quaker", type: "split_from", year: 1652 },

  // From Anabaptist
  { parent: "anabaptist", child: "mennonite", type: "split_from", year: 1536 },
  { parent: "anabaptist", child: "hutterite", type: "split_from", year: 1528 },
  { parent: "mennonite", child: "amish", type: "split_from", year: 1693 },

  // Baptist
  { parent: "anglican", child: "baptist", type: "split_from", year: 1609,
    notes: "English Separatists dissenting from the established church, adopting believer's baptism from Anabaptists they met in Amsterdam exile." },
  { parent: "anabaptist", child: "baptist", type: "influenced_by", year: 1609 },
  { parent: "baptist", child: "southern-baptist", type: "split_from", year: 1845 },
  { parent: "baptist", child: "american-baptist", type: "split_from", year: 1907 },
  { parent: "baptist", child: "baptist-union-gb", type: "split_from", year: 1813 },

  // Holiness, from Methodist
  { parent: "methodist", child: "holiness-movement", type: "split_from", year: 1867 },
  { parent: "holiness-movement", child: "nazarene", type: "split_from", year: 1908 },
  { parent: "methodist", child: "salvation-army", type: "split_from", year: 1865,
    notes: "Dated to Methodist directly, not the Holiness movement's own 1867 organizing date, since the Booths' work began two years earlier." },
  { parent: "holiness-movement", child: "wesleyan-church", type: "merged_into", year: 1968 },
  { parent: "holiness-movement", child: "cog-anderson", type: "split_from", year: 1881, eventTitle: "The Church of God (Anderson, Indiana) is founded" },

  // Pentecostalism, from Holiness
  { parent: "holiness-movement", child: "pentecostalism", type: "split_from", year: 1906, eventTitle: "The Azusa Street revival" },
  { parent: "pentecostalism", child: "assemblies-of-god", type: "split_from", year: 1914 },
  { parent: "holiness-movement", child: "cog-cleveland", type: "split_from", year: 1886, eventTitle: "The Church of God (Cleveland, Tennessee) is founded" },
  { parent: "pentecostalism", child: "cog-cleveland", type: "influenced_by", year: 1906,
    notes: "Predates Azusa Street by two decades and became Pentecostal only afterward -- split_from Holiness (1886) is its real descent; this is its later doctrinal turn." },
  { parent: "holiness-movement", child: "cogic", type: "split_from", year: 1897 },
  { parent: "pentecostalism", child: "cogic", type: "influenced_by", year: 1907 },
  { parent: "pentecostalism", child: "foursquare", type: "split_from", year: 1923 },

  // Charismatic renewal, from Pentecostalism -- a movement that swept INTO
  // existing traditions rather than starting new ones, so its links back to
  // Anglican and Roman Catholic are decorative (renewal_within), not descent.
  { parent: "pentecostalism", child: "charismatic-renewal", type: "influenced_by", year: 1960 },
  { parent: "anglican", child: "charismatic-renewal", type: "renewal_within", year: 1960,
    notes: "Dennis Bennett, an Episcopal priest, is one of the movement's best-known early figures." },
  { parent: "roman-catholic", child: "charismatic-renewal", type: "renewal_within", year: 1967, eventTitle: "Catholic charismatic renewal begins" },
  { parent: "charismatic-renewal", child: "vineyard", type: "split_from", year: 1982 },
  { parent: "pentecostalism", child: "calvary-chapel", type: "split_from", year: 1965,
    notes: "Chuck Smith came from a Foursquare pastoral background before opening Calvary Chapel to the Jesus Movement." },

  // Pre-Reformation dissent
  { parent: "western-church", child: "waldensian", type: "split_from", year: 1173 },
  { parent: "waldensian", child: "reformed", type: "merged_into", year: 1532,
    notes: "The Synod of Chanforan, where the centuries-old Waldensian movement formally joined the Reformation -- Reformed has two lines into it: Calvin's Geneva (split_from) and this older, pre-existing dissenting body (merged_into)." },
  { parent: "western-church", child: "hussite", type: "split_from", year: 1415, eventTitle: "Jan Hus is burned at Constance" },
  { parent: "hussite", child: "moravian", type: "split_from", year: 1457 },

  // Other
  { parent: "presbyterian", child: "restoration-movement", type: "split_from", year: 1832, eventTitle: "The Stone and Campbell movements merge" },
  { parent: "baptist", child: "restoration-movement", type: "influenced_by", year: 1832 },
  { parent: "restoration-movement", child: "churches-of-christ", type: "split_from", year: 1906 },
  { parent: "restoration-movement", child: "disciples-of-christ", type: "split_from", year: 1968 },
  { parent: "baptist", child: "adventist", type: "split_from", year: 1844, eventTitle: "The Great Disappointment" },
  { parent: "adventist", child: "seventh-day-adventist", type: "split_from", year: 1863 },

  // Non-denominational, deliberately without a structural parent -- see its
  // own description above for why a single split_from would misrepresent it.
  { parent: "evangelicalism", child: "non-denominational", type: "influenced_by", year: 1970 },

  // Cult category: LDS, Jehovah's Witnesses, Christian Science get NO rows
  // here at all, per Hanzen's explicit instruction. Do not add any.
];

async function resolveTraditionByName(name: string): Promise<{ id: string; description: string; distinctives: string; adherents: string; endYear: number | null } | null> {
  const r = await db.execute({ sql: "SELECT id, description, distinctives, adherents, end_year FROM traditions WHERE name = ? LIMIT 1", args: [name] });
  const row = r.rows[0] as unknown as { id: string; description: string; distinctives: string; adherents: string; end_year: number | null } | undefined;
  return row ? { id: row.id, description: row.description, distinctives: row.distinctives, adherents: row.adherents, endYear: row.end_year } : null;
}

const traditionIds: Record<string, string> = {};

async function seedTraditions() {
  console.log("Seeding traditions...");
  for (const t of TRADITIONS) {
    const startYear = -t.start;
    const endYear = t.end !== undefined ? -t.end : null;
    const confidence = t.confidence ?? "firm";
    const note = t.note ?? "";
    const adherents = t.adherents ?? "";
    const existing = await resolveTraditionByName(t.name);

    if (existing) {
      traditionIds[t.key] = existing.id;
      const changed = existing.description !== t.description || existing.distinctives !== t.distinctives
        || existing.adherents !== adherents || existing.endYear !== endYear;
      if (changed) {
        console.log(`  ${DRY_RUN ? "would update" : "updating"}: ${t.name}`);
        if (!DRY_RUN) {
          await db.execute({
            sql: `UPDATE traditions SET description = ?, distinctives = ?, adherents = ?, end_year = ?,
                  date_uncertainty_note = ?, date_confidence = ? WHERE id = ?`,
            args: [t.description, t.distinctives, adherents, endYear, note, confidence, existing.id],
          });
        }
      }
      continue;
    }

    const id = crypto.randomUUID();
    traditionIds[t.key] = id;
    console.log(`  ${DRY_RUN ? "would insert" : "inserting"}: ${t.name} (${formatOpenYearSpan(startYear, endYear)}) [${t.kind}/tier${t.tier}]`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT INTO traditions
              (id,name,also_known_as,kind,tier,start_year,end_year,region,description,distinctives,adherents,date_uncertainty_note,date_confidence,created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
        args: [id, t.name, t.aka ?? "", t.kind, t.tier, startYear, endYear, t.region ?? "", t.description, t.distinctives, adherents, note, confidence],
      });
    }
  }
}

async function resolveEventIdByTitle(title: string): Promise<string | null> {
  const r = await db.execute({ sql: "SELECT id FROM historical_events WHERE title = ? LIMIT 1", args: [title] });
  const row = r.rows[0] as unknown as { id: string } | undefined;
  return row ? row.id : null;
}

async function seedEdges() {
  console.log("Seeding tradition edges...");
  for (const e of EDGES) {
    // seedTraditions() above always populates traditionIds -- with a real id
    // on a live run, or a throwaway freshly-generated one on a dry run (never
    // written, but still usable to resolve THIS run's own edges) -- so both
    // modes reach here with every key already resolved.
    const parentId = traditionIds[e.parent];
    const childId = traditionIds[e.child];
    if (!parentId || !childId) { console.warn(`  MISSING tradition key for edge ${e.parent} -> ${e.child} -- typo in EDGES?`); continue; }
    const eventId = e.eventTitle ? await resolveEventIdByTitle(e.eventTitle) : null;
    if (e.eventTitle && !eventId) console.warn(`  MISSING event: "${e.eventTitle}" for edge ${e.parent} -> ${e.child}`);
    const notes = e.notes ?? "";
    const yearNeg = -e.year;

    const existing = await db.execute({
      sql: "SELECT id, year, event_id, notes FROM tradition_edges WHERE parent_id = ? AND type = ? AND child_id = ? LIMIT 1",
      args: [parentId, e.type, childId],
    });
    const row = existing.rows[0] as unknown as { id: string; year: number; event_id: string | null; notes: string } | undefined;

    if (row) {
      const changed = row.year !== yearNeg || row.event_id !== eventId || row.notes !== notes;
      if (changed) {
        console.log(`  ${DRY_RUN ? "would update" : "updating"} edge: ${e.parent} -${e.type}-> ${e.child}`);
        if (!DRY_RUN) {
          await db.execute({
            sql: "UPDATE tradition_edges SET year = ?, event_id = ?, notes = ? WHERE id = ?",
            args: [yearNeg, eventId, notes, row.id],
          });
        }
      }
      continue;
    }

    console.log(`  ${DRY_RUN ? "would link" : "linking"}: ${e.parent} -${e.type}-> ${e.child} (${e.year})`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT INTO tradition_edges (id,parent_id,child_id,type,year,event_id,notes,created_at)
              VALUES (?,?,?,?,?,?,?,datetime('now'))`,
        args: [crypto.randomUUID(), parentId, childId, e.type, yearNeg, eventId, notes],
      });
    }
  }
}

// ── tradition_people ─────────────────────────────────────────────────────
// Links a tradition to the person who founded it -- already-seeded church-
// history figures, resolved by the exact (name, also_known_as) pair
// scripts/seed-church-history.ts gave them. This is what lets a tradition's
// card list its founder, and (Phase 5) a person's own profile say which
// tradition they founded.
interface PRow { traditionKey: string; name: string; aka: string; role: "founder" | "key_figure" }

const TRADITION_PEOPLE: PRow[] = [
  { traditionKey: "lutheran", name: "Martin Luther", aka: "Martin Luther, author of the Ninety-five Theses", role: "founder" },
  { traditionKey: "reformed", name: "John Calvin", aka: "John Calvin, reformer of Geneva", role: "founder" },
  { traditionKey: "anglican", name: "Thomas Cranmer", aka: "Thomas Cranmer, Archbishop of Canterbury", role: "key_figure" },
  { traditionKey: "presbyterian", name: "John Knox", aka: "John Knox, reformer of Scotland", role: "founder" },
  { traditionKey: "mennonite", name: "Menno Simons", aka: "Menno Simons, namesake of the Mennonites", role: "founder" },
  { traditionKey: "quaker", name: "George Fox", aka: "George Fox, founder of the Quakers", role: "founder" },
  { traditionKey: "methodist", name: "John Wesley", aka: "John Wesley, founder of Methodism", role: "founder" },
  { traditionKey: "methodist", name: "Charles Wesley", aka: "Charles Wesley, hymn writer, co-founder of Methodism", role: "key_figure" },
  { traditionKey: "salvation-army", name: "William Booth", aka: "William Booth, founder of the Salvation Army", role: "founder" },
  { traditionKey: "cog-anderson", name: "D. S. Warner", aka: "Daniel Sidney Warner, founder of the Church of God (Anderson)", role: "founder" },
  { traditionKey: "pentecostalism", name: "William J. Seymour", aka: "William Joseph Seymour, leader of the Azusa Street revival", role: "key_figure" },
];

async function seedTraditionPeople() {
  console.log("Linking traditions to their founders...");
  for (const p of TRADITION_PEOPLE) {
    const traditionId = traditionIds[p.traditionKey];
    if (!traditionId) { console.warn(`  MISSING tradition key: ${p.traditionKey}`); continue; }
    const personRow = await db.execute({ sql: "SELECT id FROM people WHERE name = ? AND also_known_as = ? LIMIT 1", args: [p.name, p.aka] });
    const personId = (personRow.rows[0] as unknown as { id: string } | undefined)?.id;
    if (!personId) { console.warn(`  MISSING person: ${p.name} (aka="${p.aka}")`); continue; }

    const existing = await db.execute({
      sql: "SELECT id FROM tradition_people WHERE tradition_id = ? AND person_id = ? AND role = ? LIMIT 1",
      args: [traditionId, personId, p.role],
    });
    if (existing.rows.length > 0) continue;

    console.log(`  ${DRY_RUN ? "would link" : "linking"}: ${p.name} -> ${p.traditionKey} (${p.role})`);
    if (!DRY_RUN) {
      await db.execute({
        sql: `INSERT INTO tradition_people (id,tradition_id,person_id,role,notes,created_at) VALUES (?,?,?,?,'',datetime('now'))`,
        args: [crypto.randomUUID(), traditionId, personId, p.role],
      });
    }
  }
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");
  // This is the first script to touch traditions/tradition_edges/
  // tradition_people, which only ever get created by lib/db.ts's init() --
  // normally triggered the first time the running app calls getDb(), which a
  // standalone script never does. Running it explicitly here (idempotent
  // CREATE TABLE IF NOT EXISTS) replaces the usual "load any page once
  // first" workaround. Runs even on --dry-run: creating the empty tables
  // is not itself a data change worth gating.
  console.log("Ensuring traditions tables exist...");
  await getDb().init();
  await seedTraditions();
  await seedEdges();
  await seedTraditionPeople();
  console.log("Done.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
