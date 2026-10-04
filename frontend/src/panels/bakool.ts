import L from 'leaflet';
import { DATASETS } from '../config';
import { fetchGzJson } from '../data/loader';
import { accessForCell, store } from '../data/store';
import type { CellRow, Facility, PlacesData } from '../data/types';
import { flagFor } from '../finder/flags';
import { fmt } from '../format';
import { BLD_RAMP, FAC_FILL, STL_FAR, STL_NEAR, TT_RAMP, U_RAMP, isDoubtful, setFacilityClick } from '../map/layers/health';
import { map } from '../map/map';
import { setView, state, view, type Lang, type ViewState } from '../state';

/**
 * The Bakool view: the map for the people the project is for rather than for analysts.
 * No password, no AI dialogs, no layer jargon. The map opens on Bakool with the health
 * layers on; one card in plain words, English or Somali, does everything with big buttons:
 * what to show, which district, what a tapped square or facility means, and the way into
 * the phone finder. Every number is read from the data files and says what it is an
 * estimate of.
 *
 * The Somali strings are a draft to be checked by a native speaker; the card says so.
 */

type FillChoice = 'access' | 'travel' | 'buildings' | 'none';
interface Str {
  en: string;
  so: string;
}

const S = {
  title: { en: 'Bakool: reaching health care', so: 'Bakool: gaadhista daryeelka caafimaadka' },
  lead: {
    en: 'Who in Bakool lives far from a health facility, and where is the nearest one?',
    so: 'Yaa Bakool ka fog xarun caafimaad, xaruntee ugu dhowna halkee ku taal?',
  },
  caveat: {
    en: 'Estimates from open data. A listed facility is not confirmed open.',
    so: 'Qiyaaso laga sameeyay xog furan. Xarun liis ku jirta lama xaqiijin inay furan tahay.',
  },
  now: { en: 'On the map', so: 'Khariidadda' },
  nothing: { en: 'the plain map', so: 'khariidad cad' },
  legendAccess: {
    en: 'Brighter pink: more people far from care — people in the square × modelled walking time to a listed facility, capped at two hours (2020 model).',
    so: 'Casaan dhalaalaya: dad badan oo ka fog daryeelka — dadka afargeeska ku nool × waqtiga socodka ee la qiyaasay ilaa xarun liis ku jirta, ugu badnaan laba saacadood (qiyaas 2020).',
  },
  legendTravel: {
    en: 'Modelled walk to care, an average for each 10 km square: teal under 1 hour, amber 1 to 2 hours, red over 2 hours (Malaria Atlas Project 2020, to a mid-2019 facility compilation; a model, not a measurement).',
    so: 'Socodka la qiyaasay ee ilaa daryeelka, celcelis afargees kasta oo 10 km ah: buluug-cagaar saacad ka yar, huruud 1 ilaa 2 saacadood, casaan 2 saacadood ka badan (Malaria Atlas Project 2020; qiyaas, ma aha cabbir).',
  },
  legendBuildings: {
    en: 'Brighter blue: more buildings detected by Google’s Open Buildings model on satellite images (up to 2023). It misses tents and small shelters.',
    so: 'Buluug dhalaalaya: dhismayaal badan oo uu ka helay moodelka Google Open Buildings sawirrada dayaxgacmeedka (ilaa 2023). Ma arko teendhooyinka iyo hoyga yaryar.',
  },
  legendFac: {
    en: 'White dots: health centres and MCH centres, the level above a health post. Cyan dots: health posts. Hollow dashed dots: no building detected within 500 m, so the location is doubtful. Faint dots: OpenStreetMap only. No hospital in Bakool is on either official list.',
    so: 'Dhibco cad: xarumo caafimaad iyo xarumo hooyo iyo ilmo (MCH), heerka ka sarreeya rugta caafimaadka. Dhibco buluug-cad: rugo caafimaad. Dhibco madhan oo go’an: dhisme laguma helin 500 m gudahood, goobta waa shaki. Dhibco khafiif ah: OpenStreetMap oo keliya. Isbitaal Bakool ku yaal liisaska rasmiga ah kuma jiro.',
  },
  legendStl: {
    en: 'Rose dots: villages (20 or more buildings together) with no listed facility within 5 km, in a square averaging over an hour on foot. Grey dots: villages within reach.',
    so: 'Dhibco casaan-khafiif: tuulooyin (20 dhisme ama ka badan oo isku dhow) oo aan xarun liis ku jirta 5 km u jirin, afargees celcelis ahaan saacad ka badan la socdo. Dhibco cawl: tuulooyin xarun gaadhi kara.',
  },
  showFill: { en: 'Colour the squares by', so: 'Midabka afargeesyada' },
  showPoints: { en: 'Also show', so: 'Sidoo kale muuji' },
  fillAccess: { en: 'People far from care', so: 'Dadka ka fog daryeelka' },
  fillTravel: { en: 'Walking time to care', so: 'Waqtiga socodka ilaa daryeelka' },
  fillBuildings: { en: 'Buildings seen from space', so: 'Dhismayaasha dayaxgacmeedka laga arkay' },
  fillNone: { en: 'No colour', so: 'Midab la’aan' },
  pointsFac: { en: 'Listed facilities', so: 'Xarumaha liiska' },
  pointsStl: { en: 'Villages with no care nearby', so: 'Tuulooyinka aan daryeel u dhowayn' },
  district: { en: 'Choose a district', so: 'Dooro degmo' },
  all: { en: 'All of Bakool', so: 'Bakool oo dhan' },
  peopleRegion: {
    en: 'About {n} people live in Bakool’s five districts (WorldPop 2020 estimate; other sources put Bakool between 367,000 and 543,000).',
    so: 'Qiyaastii {n} qof ayaa ku nool shanta degmo ee Bakool (qiyaasta WorldPop 2020; ilo kale waxay Bakool u dhigaan inta u dhaxaysa 367,000 iyo 543,000).',
  },
  people: { en: 'About {n} people live in {d} district (WorldPop 2020 estimate).', so: 'Qiyaastii {n} qof ayaa ku nool degmada {d} (qiyaasta WorldPop 2020).' },
  far1: {
    en: 'About {n} of them ({p}%) are more than an hour’s walk from a listed health facility (2020 model).',
    so: 'Qiyaastii {n} ka mid ah ({p}%) waxay ka fog yihiin saacad socod ka badan xarun caafimaad liis ku jirta (qiyaas 2020).',
  },
  far2: { en: 'About {m} ({q}%) are more than two hours away.', so: 'Qiyaastii {m} ({q}%) waxay ka fog yihiin laba saacadood ka badan.' },
  facs: {
    en: '{n} health facilities are listed here on the 2019 WHO database, {r} of them health centres or MCH centres.',
    so: '{n} xarumood caafimaad ayaa halkan ku jira xogta WHO ee 2019, {r} ka mid ah waa xarumo caafimaad ama MCH.',
  },
  facsPlus: {
    en: ' The 2021 WHO / Ministry of Health list adds {k} more, some of them the same places under other names.',
    so: ' Liiska WHO / Wasaaradda Caafimaadka ee 2021 wuxuu ku daraa {k} kale, qaarkood isla meelaha magacyo kale.',
  },
  farStl: {
    en: '{n} villages here have no listed facility within 5 km and lie in squares averaging over an hour on foot: candidates for a mobile clinic day.',
    so: '{n} tuulo oo halkan ah ma laha xarun liis ku jirta 5 km gudahood, waxayna ku yaallaan afargeesyo celcelis ahaan saacad ka badan la socdo: meelo ku habboon maalin rugta guurguurta.',
  },
  rankTop: { en: 'Of Bakool’s five districts, {d} ranks first on the people-far-from-care score.', so: 'Shanta degmo ee Bakool, {d} ayaa kaalinta koowaad ku jirta dhibcaha dadka ka fog daryeelka.' },
  rank: { en: 'Of Bakool’s five districts, {d} ranks {o} on the people-far-from-care score.', so: 'Shanta degmo ee Bakool, {d} waxay ku jirtaa kaalinta {o} ee dhibcaha dadka ka fog daryeelka.' },
  hospitalNote: {
    en: 'No hospital in Bakool is on either official list. WHO reported services restored at Bakool Regional Hospital in Xudur town in January 2026; its location is not in our data.',
    so: 'Isbitaal Bakool ku yaal liisaska rasmiga ah kuma jiro. WHO waxay sheegtay in adeegyada Isbitaalka Gobolka Bakool ee magaalada Xudur dib loo soo celiyay Janaayo 2026; goobtiisa xogtayada kuma jirto.',
  },
  roadNote: { en: 'Access note', so: 'Ogeysiis marin' },
  source: { en: 'source', so: 'il' },
  tapHelp: {
    en: 'Tap a square (10 × 10 km) to see who lives there and how far care is. Tap a dot to see that facility.',
    so: 'Taabo afargees (10 × 10 km) si aad u aragto cidda ku nool iyo inta ay daryeelku u jirto. Taabo dhibic si aad u aragto xaruntaas.',
  },
  listTitle: { en: 'Listed facilities here', so: 'Xarumaha liiska ee halkan' },
  listNote: { en: 'not confirmed open', so: 'lama xaqiijin inay furan yihiin' },
  listHelp: { en: 'Tap a name to see it on the map.', so: 'Taabo magac si aad khariidadda ugu aragto.' },
  tapped: { en: 'The square you tapped', so: 'Afargeeska aad taabatay' },
  cellPeople: { en: 'About {n} people live in this square (2020 estimate).', so: 'Qiyaastii {n} qof ayaa afargeeskan ku nool (qiyaasta 2020).' },
  cellNone: { en: 'Nobody is estimated to live in this square (2020).', so: 'Qof lama qiyaasin inuu afargeeskan ku nool yahay (2020).' },
  cellNearest: { en: 'Nearest listed facility: {f}, about {km} km in a straight line.', so: 'Xarunta liiska ugu dhow: {f}, qiyaastii {km} km oo toos ah.' },
  cellWalk: { en: 'Modelled walk to care from this square: about {w}', so: 'Socodka la qiyaasay ee ilaa daryeelka laga bilaabo afargeeskan: qiyaastii {w}' },
  cellDrive: { en: ', by vehicle about {d}', so: ', gaadhi qiyaastii {d}' },
  modelTag: { en: ' (2020 model, an average for the square).', so: ' (qiyaas 2020, celcelis afargeeska).' },
  cellNoWalk: { en: 'No travel-time estimate for this square.', so: 'Afargeeskan qiyaas waqti safar uma jirto.' },
  cellBuildings: { en: '{n} buildings were detected here on satellite images (up to 2023).', so: '{n} dhisme ayaa halkan laga helay sawirrada dayaxgacmeedka (ilaa 2023).' },
  cellNoBuildings: {
    en: 'No buildings were detected here from space: people may be on the move, in shelters too small to detect, or the population estimate may be off.',
    so: 'Dhisme laguma helin halkan: dadku waxay noqon karaan kuwo socda, hoy aad u yar oo aan la arki karin, ama qiyaasta dadku way khaldanaan kartaa.',
  },
  cellNoData: { en: 'There is no health-access record for this square: it lies at the edge of the region.', so: 'Afargeeskan diiwaan daryeel caafimaad uma jiro: wuxuu ku yaal cidhifka gobolka.' },
  cellFinder: { en: 'Find the nearest facility from {p}', so: 'Raadi xarunta ugu dhow {p}' },
  cellFinderD: { en: 'opens the phone finder', so: 'wuxuu furayaa raadiyaha taleefanka' },
  cellClear: { en: 'Close', so: 'Xidh' },
  facTitle: { en: 'Listed facility', so: 'Xarun liis ku jirta' },
  facReferral: { en: 'Health centre / MCH (above health-post level)', so: 'Xarun caafimaad / MCH (ka sarreeya heerka rugta)' },
  facPost: { en: 'Health post', so: 'Rugta caafimaadka' },
  facUnnamed: { en: 'Unnamed facility', so: 'Xarun aan magac lahayn' },
  facListed: { en: 'Listed in {s}. Not confirmed open today.', so: 'Waxay ku jirtaa {s}. Lama xaqiijin inay maanta furan tahay.' },
  facCheckNone: {
    en: 'No building was detected within {m} m of this point (imagery up to 2023): the coordinates may be imprecise or the structure too small to detect. Check before relying on it.',
    so: 'Dhisme laguma helin {m} m gudahood bartan (sawirro ilaa 2023): goobta way khaldanaan kartaa ama dhismuhu aad u yar. Hubi ka hor inta aadan ku tiirsanin.',
  },
  facCheck: { en: '{n} buildings detected within {m} m of this point (imagery up to 2023).', so: '{n} dhisme ayaa la helay {m} m gudahood bartan (sawirro ilaa 2023).' },
  facClose: { en: 'Close', so: 'Xidh' },
  srcMaina: { en: 'the 2019 WHO/KEMRI facility database (from lists dated up to 2013)', so: 'xogta xarumaha WHO/KEMRI ee 2019 (liisas ilaa 2013)' },
  srcWho: { en: 'the 2021 WHO / Ministry of Health list', so: 'liiska WHO / Wasaaradda Caafimaadka ee 2021' },
  srcOsm: { en: 'OpenStreetMap only (mapped by volunteers, on no official list)', so: 'OpenStreetMap oo keliya (mutadawiciin sameeyeen, liis rasmi ah kuma jirto)' },
  finder: { en: 'Open the phone finder', so: 'Fur raadiyaha taleefanka' },
  finderD: {
    en: 'For the health worker’s phone: ask in Somali, by voice or text, where the nearest listed facility is, and make a referral slip. Works offline after the first visit.',
    so: 'Taleefanka shaqaalaha caafimaadka: weydii Af-Soomaali, cod ama qoraal, halka xarunta liiska ugu dhow ku taal, oo samee warqad gudbin. Wuxuu shaqeeyaa internet la’aan kadib booqashada koowaad.',
  },
  finderAi: {
    en: 'Small AI on the phone: Somali speech recognition runs on the device itself (Whisper tiny, 41 MB). Every answer is one of a fixed set of sentences filled from the facility lists, with the list’s date; the health worker confirms what was heard and makes the decision.',
    so: 'AI yar oo taleefanka ku jira: aqoonsiga hadalka Soomaaliga wuxuu ku shaqeeyaa qalabka laftiisa (Whisper tiny, 41 MB). Jawaab kasta waa mid ka mid ah jumlado go’an oo laga buuxiyay liisaska xarumaha, iyo taariikhda liiska; shaqaalaha caafimaadka ayaa xaqiijiya waxa la maqlay, isagana go’aanka gaara.',
  },
  share: { en: 'Copy a link to this view', so: 'Koobi xiriiriyaha muuqaalkan' },
  shared: { en: 'Link copied.', so: 'Xiriiriyaha waa la koobiyay.' },
  sources: { en: 'Where the numbers come from', so: 'Halka tirooyinka ka yimaadaan' },
  sourcesNote: {
    en: 'All figures are estimates from open data; nothing here was surveyed by us. Within Bakool everyone counts as poor (97.4% multidimensionally poor, OPHI 2024), so the score ranks squares by people × walking time. Method, data gaps and code: the project README.',
    so: 'Dhammaan tirooyinku waa qiyaaso laga sameeyay xog furan; waxba annagu ma aannu sahamin. Bakool gudaheeda qof walba sabool ayaa loo tiriyaa (97.4%, OPHI 2024), sidaas darteed dhibcuhu afargeesyada waxay u kala horreysiiyaan dadka × waqtiga socodka. Habka, daldaloolada xogta iyo koodhka: README-ga mashruuca.',
  },
  draftTag: { en: 'draft', so: 'qabyo' },
  draftNote: {
    en: 'The Somali text is a draft; a native speaker has not checked it yet.',
    so: 'Qoraalka Soomaaliga waa qabyo; af-hooyo weli ma hubin.',
  },
  provenance: {
    en: 'Built on the open-source geo-somalia map platform by NexaSEE; the Bakool health layers, the finder and the data pipeline are new for Challenge 04 (Health).',
    so: 'Waxaa lagu dhisay madal khariidadeed furan (geo-somalia, NexaSEE); lakabyada caafimaadka Bakool, raadiyaha iyo habka xogta waa cusub, Tartanka 04 (Caafimaad).',
  },
  unknown: { en: 'unknown', so: 'lama oga' },
  min: { en: 'min', so: 'daqiiqo' },
  hour: { en: 'h', so: 'saac' },
} satisfies Record<string, Str>;

type Key = keyof typeof S;
const ORDINALS: Record<Lang, string[]> = {
  en: ['', 'first', 'second', 'third', 'fourth', 'fifth'],
  so: ['', 'koowaad', 'labaad', 'saddexaad', 'afraad', 'shanaad'],
};

const HOSPITAL_URL = 'https://www.emro.who.int/somalia/news/who-and-aics-restore-lifesaving-services-at-bakool-regional-hospital-renewing-hope-for-families.html';

/** the public pages behind the figures, each with its licence */
const SOURCE_LINKS: { en: string; so: string; url: string }[] = [
  { en: 'People: WorldPop 2020, constrained 100 m (Bondarenko et al. 2020, CC BY 4.0)', so: 'Dadka: WorldPop 2020, 100 m (Bondarenko et al. 2020, CC BY 4.0)', url: 'https://hub.worldpop.org/geodata/summary?id=49662' },
  { en: 'Bakool population, other estimates: 367,226 (UNFPA PESS 2014, Table 2.1)', so: 'Dadka Bakool, qiyaaso kale: 367,226 (UNFPA PESS 2014)', url: 'https://somalia.unfpa.org/sites/default/files/pub-pdf/Population-Estimation-Survey-of-Somalia-PESS-2013-2014.pdf' },
  { en: 'Bakool population, other estimates: 543,371 (FSNAU/IPC projection Oct–Dec 2024)', so: 'Dadka Bakool, qiyaaso kale: 543,371 (FSNAU/IPC, Okt–Dis 2024)', url: 'https://fsnau.org/downloads/Somalia-2024-Post-Gu-Acute-Food-Insecurity-Rural-Urban-and-IDP-Population-Stressed-Crisis-and-Emergency-%28Projection-Oct-Dec-2024%29.pdf' },
  { en: 'Walking and vehicle time to care: Malaria Atlas Project 2020 (Weiss et al. 2020, Nature Medicine; CC BY)', so: 'Waqtiga socodka iyo gaadhiga ilaa daryeelka: Malaria Atlas Project 2020 (Weiss et al. 2020; CC BY)', url: 'https://malariaatlas.org/project-resources/accessibility-to-healthcare/' },
  { en: 'Health facilities: WHO Somalia health facilities on HDX — the 2019 WHO/KEMRI database and the 2021 WHO/MoH list (CC BY-IGO)', so: 'Xarumaha caafimaadka: WHO Somalia health facilities, HDX — xogta 2019 iyo liiska 2021 (CC BY-IGO)', url: 'https://data.humdata.org/dataset/somalia-health-facilities-data' },
  { en: 'Facility database behind the 2019 list: Maina et al. 2019, Scientific Data', so: 'Xogta xarumaha ee liiska 2019: Maina et al. 2019, Scientific Data', url: 'https://www.nature.com/articles/s41597-019-0142-2' },
  { en: 'Poverty rate (97.4% of Bakool multidimensionally poor): OPHI and SNBS, Somalia MPI report 2024 (2022 survey data)', so: 'Heerka saboolnimada (97.4% Bakool): OPHI iyo SNBS, warbixinta Somalia MPI 2024 (xog sahan 2022)', url: 'https://ophi.org.uk/sites/default/files/2024-12/Somalia_MPI_report_2024.pdf' },
  { en: 'Districts and district population: OCHA Somalia COD-AB and COD-PS on HDX (CC BY-IGO)', so: 'Degmooyinka iyo dadka degmooyinka: OCHA Somalia COD-AB iyo COD-PS, HDX (CC BY-IGO)', url: 'https://data.humdata.org/dataset/cod-ab-som' },
  { en: 'Buildings and villages: Google Research, Open Buildings V3 (Sirko et al. 2021), CC BY 4.0', so: 'Dhismayaasha iyo tuulooyinka: Google Research, Open Buildings V3 (Sirko et al. 2021), CC BY 4.0', url: 'https://sites.research.google/gr/open-buildings/' },
  { en: 'Place names: © OpenStreetMap contributors (ODbL)', so: 'Magacyada meelaha: © OpenStreetMap contributors (ODbL)', url: 'https://www.openstreetmap.org/copyright' },
  { en: 'Access notes: EUAA, Somalia security situation 2025, Bakool', so: 'Ogeysiisyada marinka: EUAA, xaaladda amniga Soomaaliya 2025, Bakool', url: 'https://www.euaa.europa.eu/coi/somalia/2025/security-situation/22-south-west/221-bakool' },
  { en: 'Access notes: EUAA, Somalia security situation 2026, Bakool (partial lifting of the blockades)', so: 'Ogeysiisyada marinka: EUAA, xaaladda amniga Soomaaliya 2026, Bakool', url: 'https://www.euaa.europa.eu/somalia-security-situation/221-bakool' },
  { en: 'Bakool Regional Hospital, Xudur: WHO EMRO news, January 2026', so: 'Isbitaalka Gobolka Bakool, Xudur: war WHO EMRO, Janaayo 2026', url: HOSPITAL_URL },
  { en: 'Province outlines: Somalia administrative boundaries (OCHA, HDX)', so: 'Xuduudaha gobollada: xuduudaha maamulka Soomaaliya (OCHA, HDX)', url: 'https://data.humdata.org/dataset/somalia-administrative-boundaries' },
  { en: 'Satellite basemap: Esri World Imagery (Maxar, Earthstar Geographics), darkened in the browser', so: 'Khariidadda dayaxgacmeedka: Esri World Imagery (Maxar, Earthstar Geographics)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer' },
];

/** the card's language: a mirror of view.lang, set by the render pass before the card is drawn */
let lang: Lang = 'en';
let places: PlacesData | null = null;
let placesRequested = false;
let adm2Layer: L.GeoJSON | null = null;
/** the facility whose record the card shows, after a tap on its marker or its name */
let picked: Facility | null = null;
let lastDistrict: string | null | undefined;
/** what the card last drew; the card is rebuilt only when this changes */
let lastKey = '';
let listOpen = false;
let sourcesOpen = false;

function t(key: Key, vars: Record<string, string | number> = {}): string {
  const e: Str = S[key];
  let s = e[lang] || e.en;
  for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** "about" numbers: two significant figures from 100 up, so an estimate does not read as a count */
function about(n: number): string {
  if (n < 100) return fmt(n);
  const p = 10 ** (Math.floor(Math.log10(n)) - 1);
  return fmt(Math.round(n / p) * p);
}

function minutes(m: number | undefined | null): string {
  if (m == null) return t('unknown');
  const total = Math.round(m);
  if (total < 60) return total + ' ' + t('min');
  const h = Math.floor(total / 60);
  const r = total - h * 60;
  return h + ' ' + t('hour') + (r ? ' ' + r + ' ' + t('min') : '');
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function beside(): boolean {
  return window.matchMedia('(min-width: 901px)').matches;
}

function districtNames(): string[] {
  return store.HEALTH.adm2.adm2.features.map((f) => f.properties.district).sort();
}

function sourceLabel(f: Facility): string {
  return f.source_key === 'maina2019' ? t('srcMaina') : f.source_key === 'who2021' ? t('srcWho') : t('srcOsm');
}

function facName(f: Facility): string {
  return f.name || t('facUnnamed');
}

// ---- figures -----------------------------------------------------------------------------

interface Figures {
  people: number;
  gt60: number;
  gt120: number;
  /** facilities on the 2019 database, and those at health-centre or MCH level */
  facs: number;
  referral: number;
  /** entries of the 2021 list, kept apart: some are the same places */
  who: number;
  farStl: number | null;
}

/** the listed (non-OpenStreetMap) facilities of a district, or of the five districts */
function listedFacilities(district: string | null): Facility[] {
  return store.HEALTH.facilities.facilities.filter((f) => f.source_key !== 'osm' && (district ? f.district_adm2 === district : f.district_adm2 != null));
}

/** totals for one district, or for the five districts: the district rows of the access file plus the facility and settlement lists */
function figures(district: string | null): Figures {
  const H = store.HEALTH;
  const out: Figures = { people: 0, gt60: 0, gt120: 0, facs: 0, referral: 0, who: 0, farStl: H.settlements ? 0 : null };
  for (const [name, d] of Object.entries(H.access.districts)) {
    if (district ? name !== district : name === 'outside ADM2') continue;
    out.people += d.pop2020c;
    out.gt60 += d.pop_gt60_walk;
    out.gt120 += d.pop_gt120_walk;
  }
  for (const f of listedFacilities(district)) {
    if (f.source_key === 'who2021') out.who++;
    else {
      out.facs++;
      if (f.referral) out.referral++;
    }
  }
  if (H.settlements) out.farStl = H.settlements.settlements.filter((s) => s.far_from_care && (district ? s.district === district : s.district != null)).length;
  return out;
}

/** 1 = the district with the largest share of the score U */
function districtRank(district: string): number {
  const rows = Object.entries(store.HEALTH.access.districts)
    .filter(([n]) => n !== 'outside ADM2')
    .sort((a, b) => b[1].U - a[1].U);
  return rows.findIndex(([n]) => n === district) + 1;
}

// ---- map pieces ----------------------------------------------------------------------------

function districtBounds(district: string | null): L.LatLngBounds | null {
  const A2 = store.HEALTH.adm2;
  const features = district ? A2.adm2.features.filter((f) => f.properties.district === district) : A2.adm1.features;
  if (!features.length) return null;
  return L.geoJSON({ type: 'FeatureCollection', features } as GeoJSON.FeatureCollection).getBounds();
}

/** room for the card: beside the map on wide screens, none on narrow ones where the card sits under the map */
function fitOptions(): L.FitBoundsOptions {
  const card = document.getElementById('bkCard');
  const side = !!card && beside();
  return { paddingTopLeft: [24, 24], paddingBottomRight: [side ? card.offsetWidth + 40 : 24, 24], maxZoom: 11, animate: !reducedMotion() };
}

function ensureAdm2Layer(): void {
  if (adm2Layer) return;
  adm2Layer = L.geoJSON(store.HEALTH.adm2.adm2 as GeoJSON.FeatureCollection, {
    interactive: false,
    style: () => ({ color: '#f8fafc', weight: 1.2, opacity: 0.8, fill: false, dashArray: '4 3' }),
    onEachFeature: (f, l) => {
      l.bindTooltip(esc((f.properties as { district: string }).district), { permanent: true, direction: 'center', className: 'bk-dlabel' });
    },
  });
}

function styleAdm2(district: string | null): void {
  adm2Layer?.setStyle((f) => {
    const sel = !!f && (f.properties as { district: string }).district === district;
    return sel
      ? { color: '#14c8dc', weight: 3, opacity: 1, fill: true, fillColor: '#14c8dc', fillOpacity: 0.06, dashArray: undefined }
      : { color: '#f8fafc', weight: 1.2, opacity: 0.75, fill: false, dashArray: '4 3' };
  });
}

/** the points stay above the fills, the cells and the district lines, so a dot can be tapped */
function pointsToFront(): void {
  if (view.settlements) state.natStl?.eachLayer((l) => (l as L.Path).bringToFront());
  if (view.facilities) state.natFac?.eachLayer((l) => (l as L.Path).bringToFront());
}

/** the named OpenStreetMap place inside Bakool nearest a cell's centre, within about one cell, for the finder link */
function placeNear(col: number, row: number): string | null {
  if (!places) return null;
  const cd = store.CELL;
  const lon = col * cd;
  const lat = row * cd;
  let best: { name: string; d: number } | null = null;
  for (const p of places.places) {
    if (p.in_region === false) continue;
    const name = (p.name || '').replace(/[^\x20-\x7EÀ-ɏ’]/g, '').trim();
    if (!name) continue;
    const d = ((p.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2 + (p.lat - lat) ** 2;
    if (!best || d < best.d) best = { name, d };
  }
  return best && best.d <= (cd * 1.1) ** 2 ? best.name : null;
}

/** the nearer of the two registers' nearest facilities for a cell, by the pipeline's straight-line distances */
function nearestListed(c: CellRow): { f: Facility; km: number } | null {
  const a = accessForCell(c);
  if (!a) return null;
  const F = store.HEALTH.facilities.facilities;
  const cands: { f: Facility | undefined; km: number | undefined }[] = [
    { f: a.nearest_maina2019 ? F.find((x) => x.id === a.nearest_maina2019) : undefined, km: a.nearest_maina2019_km },
    { f: a.nearest_who2021 ? F.find((x) => x.id === a.nearest_who2021) : undefined, km: a.nearest_who2021_km },
  ];
  let best: { f: Facility; km: number } | null = null;
  for (const x of cands) if (x.f && x.km != null && (!best || x.km < best.km)) best = { f: x.f, km: x.km };
  return best;
}

/** the tooltip of a 10 km square, in the card's language (map/layers/squares.ts) */
export function bakoolCellTip(c: CellRow, selected: boolean): string {
  const a = accessForCell(c);
  const n = a && a.pop2020c != null ? a.pop2020c : c[5];
  const people = lang === 'so' ? 'qiyaastii ' + about(n) + ' qof' : 'about ' + about(n) + ' people';
  const next = selected ? (lang === 'so' ? 'la doortay' : 'selected') : lang === 'so' ? 'taabo faahfaahin' : 'tap for details';
  return people + ' · ' + next;
}

// ---- rendering ---------------------------------------------------------------------------------

function chip(color: string, round = false, hollow = false): string {
  return '<i class="bk-chip' + (round ? ' round' : '') + (hollow ? ' hollow' : '') + '" style="' + (hollow ? 'border-color:' : 'background:') + color + '"></i>';
}

function facChip(f: Facility): string {
  return chip(f.referral ? FAC_FILL.referral : FAC_FILL.post, true, isDoubtful(f));
}

function fillOf(v: ViewState): FillChoice {
  return v.access ? 'access' : v.travel ? 'travel' : v.buildings ? 'buildings' : 'none';
}

/** a big toggle: swatches and a short label; the legend lives at the top of the card */
function bigButton(act: string, label: string, pressed: boolean, swatches: string): string {
  return '<button type="button" class="bk-big" data-act="' + act + '" aria-pressed="' + pressed + '">' +
    '<span class="bk-big-l">' + (swatches ? '<span class="bk-sw">' + swatches + '</span>' : '') + esc(label) + '</span></button>';
}

const SW = {
  access: () => [U_RAMP[1], U_RAMP[4], U_RAMP[7]].map((x) => chip(x)).join(''),
  travel: () => TT_RAMP.map((x) => chip(x)).join(''),
  buildings: () => [BLD_RAMP[1], BLD_RAMP[3], BLD_RAMP[6]].map((x) => chip(x)).join(''),
  facilities: () => chip(FAC_FILL.referral, true) + chip(FAC_FILL.post, true) + chip(FAC_FILL.post, true, true),
  settlements: () => chip(STL_FAR, true) + chip(STL_NEAR, true),
};

/** the legend: one line with its swatches for each thing on the map, read before anything else */
function legend(v: ViewState): string {
  const fill = fillOf(v);
  const rows: string[] = [];
  if (fill === 'access') rows.push(SW.access() + ' ' + esc(t('legendAccess')));
  else if (fill === 'travel') rows.push(SW.travel() + ' ' + esc(t('legendTravel')));
  else if (fill === 'buildings') rows.push(SW.buildings() + ' ' + esc(t('legendBuildings')));
  if (v.facilities) rows.push(SW.facilities() + ' ' + esc(t('legendFac')));
  if (v.settlements) rows.push(SW.settlements() + ' ' + esc(t('legendStl')));
  let h = '<section class="bk-legend" aria-label="' + esc(t('now')) + '"><h3 class="bk-h3">' + esc(t('now')) + '</h3>';
  h += rows.length ? rows.map((r) => '<p class="bk-lg">' + r + '</p>').join('') : '<p class="bk-lg">' + esc(t('nothing')) + '</p>';
  return h + '</section>';
}

function facilityBlock(f: Facility): string {
  const chk = store.HEALTH.checks?.checks[f.id];
  let h = '<section class="bk-sec bk-sec--fac"><h3 class="bk-h3">' + esc(t('facTitle')) + '</h3><div class="bk-sum">';
  h += '<p class="bk-p bk-p--big">' + facChip(f) + esc(facName(f)) + '</p>';
  h += '<p class="bk-p">' + esc(f.referral ? t('facReferral') : t('facPost')) + (f.type ? ' · ' + esc(f.type) : '') + (f.owner ? ' · ' + esc(f.owner) : '') +
    (f.district_adm2 ? '<br><span class="bk-tag">' + esc(f.district_adm2) + '</span>' : '') + '</p>';
  h += '<p class="bk-p bk-p--muted">' + esc(t('facListed', { s: sourceLabel(f) })) + '</p>';
  if (chk) h += '<p class="bk-p ' + (chk.buildings_within_m === 0 ? 'bk-p--flag' : 'bk-p--muted') + '">' + esc(chk.buildings_within_m === 0 ? t('facCheckNone', { m: chk.radius_m }) : t('facCheck', { n: fmt(chk.buildings_within_m), m: chk.radius_m })) + '</p>';
  h += '<div class="bk-row"><button type="button" class="bk-btn" data-act="fac:close">' + esc(t('facClose')) + '</button></div></div></section>';
  return h;
}

function cellBlock(c: CellRow): string {
  const H = store.HEALTH;
  const a = accessForCell(c);
  let h = '<section class="bk-sec bk-sec--pick"><h3 class="bk-h3">' + esc(t('tapped')) + '</h3><div class="bk-sum">';
  if (!a) {
    h += '<p class="bk-p">' + esc(t('cellNoData')) + '</p>';
  } else {
    const pop = a.pop2020c || 0;
    const near = nearestListed(c);
    const b = H.buildings?.cells[c[0] + '_' + c[1]];
    h += '<p class="bk-p bk-p--big">' + esc(pop > 0 ? t('cellPeople', { n: about(pop) }) : t('cellNone')) + (a.district ? ' <span class="bk-tag">' + esc(a.district) + '</span>' : '') + '</p>';
    if (near) h += '<p class="bk-p">' + esc(t('cellNearest', { f: facName(near.f), km: near.km.toFixed(1) })) + '</p>';
    h += '<p class="bk-p">' + esc(a.tt_walking_mean != null
      ? t('cellWalk', { w: minutes(a.tt_walking_mean) }) + (a.tt_motorized_mean != null ? t('cellDrive', { d: minutes(a.tt_motorized_mean) }) : '') + t('modelTag')
      : t('cellNoWalk')) + '</p>';
    if (H.buildings) {
      if (b) h += '<p class="bk-p">' + esc(t('cellBuildings', { n: fmt(b.n) })) + '</p>';
      else if (pop > 0) h += '<p class="bk-p bk-p--muted">' + esc(t('cellNoBuildings')) + '</p>';
    }
    const pn = placeNear(c[0], c[1]);
    if (pn) {
      h += '<div class="bk-row"><a class="bk-btn bk-btn--primary" href="/finder.html?lang=' + lang + '&q=' + encodeURIComponent(pn) + '">' + esc(t('cellFinder', { p: pn })) + '</a></div>' +
        '<p class="bk-p bk-p--muted">' + esc(t('cellFinderD')) + '</p>';
    }
  }
  h += '<div class="bk-row"><button type="button" class="bk-btn" data-act="cell:clear">' + esc(t('cellClear')) + '</button></div>';
  h += '</div></section>';
  return h;
}

function facilityList(district: string | null): string {
  const list = listedFacilities(district).sort((x, y) => Number(y.referral) - Number(x.referral) || facName(x).localeCompare(facName(y)));
  if (!list.length) return '';
  let h = '<details class="bk-details" data-details="list"' + (listOpen ? ' open' : '') + '><summary>' + esc(t('listTitle')) + ' (' + list.length + ') — ' + esc(t('listNote')) + '</summary>';
  h += '<p class="bk-p bk-p--muted">' + esc(t('listHelp')) + '</p><ul class="bk-list">';
  for (const f of list) {
    h += '<li><button type="button" class="bk-fac" data-fac="' + esc(f.id) + '"' + (picked && picked.id === f.id ? ' aria-pressed="true"' : '') + '>' + facChip(f) +
      '<span class="bk-fac-n">' + esc(facName(f)) + '</span><span class="bk-fac-d">' + esc((f.type || (f.referral ? t('facReferral') : t('facPost'))) + (f.source_key === 'who2021' ? ' · 2021' : '')) + '</span></button></li>';
  }
  h += '</ul></details>';
  return h;
}

function renderKey(v: ViewState): string {
  return [lang, v.district, v.cell ? v.cell.join('_') : '', picked ? picked.id : '', fillOf(v), v.facilities, v.settlements, !!places, listOpen, sourcesOpen].join('|');
}

/** Rebuild the card when something it shows has changed; keep the keyboard focus where it was. */
function renderCard(v: ViewState, force = false): void {
  const card = document.getElementById('bkCard');
  if (!card) return;
  const key = renderKey(v);
  if (!force && key === lastKey) return;
  lastKey = key;
  const H = store.HEALTH;
  const fill = fillOf(v);
  const d = v.district;
  const fg = figures(d);
  const pct = (a: number, b: number): number => (b ? Math.round((100 * a) / b) : 0);
  const active = document.activeElement as HTMLElement | null;
  // which control had the focus, by attribute and value, so the "all districts" pill (data-d="") is found again too
  const focusKey = active && card.contains(active)
    ? (['act', 'd', 'lang', 'fac'] as const).map((k) => (active.dataset[k] != null ? '[data-' + k + '="' + active.dataset[k] + '"]' : '')).find(Boolean) || ''
    : null;

  // 1. head: title, language (the Somali button carries a "draft" tag until a native speaker has checked the text)
  let h = '<div class="bk-head"><h2 class="bk-title" id="bkTitle">' + esc(t('title')) + '</h2>' +
    '<div class="bk-lang" role="group" aria-label="Language / Luqadda">' +
    '<button type="button" data-lang="so" aria-pressed="' + (lang === 'so') + '" lang="so">Soomaali <small lang="en">· draft</small></button>' +
    '<button type="button" data-lang="en" aria-pressed="' + (lang === 'en') + '" lang="en">English</button></div></div>';
  h += '<p class="bk-lead">' + esc(t('lead')) + '</p>';
  h += '<p class="bk-caveat">' + esc(t('caveat')) + '</p>';

  // 2. the legend, before anything else
  h += legend(v);

  // 3. what was just touched comes next: a facility, or a square
  if (picked) h += facilityBlock(picked);
  const c = state.selectedCell;
  if (c) h += cellBlock(c);

  // 4. the district and its figures
  h += '<section class="bk-sec"><h3 class="bk-h3" id="bkDistrictH">' + esc(t('district')) + '</h3><div class="bk-dist" role="group" aria-labelledby="bkDistrictH">';
  h += '<button type="button" class="bk-pill" data-d="" aria-pressed="' + (d == null) + '">' + esc(t('all')) + '</button>';
  for (const n of districtNames()) h += '<button type="button" class="bk-pill" data-d="' + esc(n) + '" aria-pressed="' + (d === n) + '">' + esc(n) + '</button>';
  h += '</div><div class="bk-sum">';
  h += '<p class="bk-p bk-p--big">' + esc(d ? t('people', { n: about(fg.people), d }) : t('peopleRegion', { n: about(fg.people) })) + '</p>';
  h += '<p class="bk-p">' + esc(t('far1', { n: about(fg.gt60), p: pct(fg.gt60, fg.people) })) + ' <span class="bk-p--muted">' + esc(t('far2', { m: about(fg.gt120), q: pct(fg.gt120, fg.people) })) + '</span></p>';
  h += '<p class="bk-p">' + esc(t('facs', { n: fmt(fg.facs), r: fmt(fg.referral) }) + (fg.who ? t('facsPlus', { k: fmt(fg.who) }) : '')) + '</p>';
  if (fg.farStl != null) h += '<p class="bk-p">' + esc(t('farStl', { n: fmt(fg.farStl) })) + '</p>';
  if (d) {
    const r = districtRank(d);
    if (r === 1) h += '<p class="bk-p bk-p--muted">' + esc(t('rankTop', { d })) + '</p>';
    else if (r > 1) h += '<p class="bk-p bk-p--muted">' + esc(t('rank', { d, o: ORDINALS[lang][r] || String(r) })) + '</p>';
    const flag = flagFor(d);
    if (flag) h += '<p class="bk-p bk-p--flag"><strong>' + esc(t('roadNote')) + ':</strong> ' + esc(flag[lang]) + ' <a href="' + esc(flag.url) + '" target="_blank" rel="noopener">' + esc(t('source')) + ', ' + esc(flag.asOf) + '</a></p>';
  }
  if (!d || d === 'Xudur') h += '<p class="bk-p bk-p--muted">' + esc(t('hospitalNote')) + ' <a href="' + HOSPITAL_URL + '" target="_blank" rel="noopener">' + esc(t('source')) + '</a></p>';
  if (!c) h += '<p class="bk-p bk-p--hint">' + esc(t('tapHelp')) + '</p>';
  h += '</div></section>';

  // 5. what the map shows; the legend above explains the colours; layers whose files are missing are not offered
  h += '<section class="bk-sec"><h3 class="bk-h3" id="bkShowH">' + esc(t('showFill')) + '</h3><div class="bk-grid" role="group" aria-labelledby="bkShowH">';
  h += bigButton('fill:access', t('fillAccess'), fill === 'access', SW.access());
  h += bigButton('fill:travel', t('fillTravel'), fill === 'travel', SW.travel());
  if (H.buildings) h += bigButton('fill:buildings', t('fillBuildings'), fill === 'buildings', SW.buildings());
  h += bigButton('fill:none', t('fillNone'), fill === 'none', '');
  h += '</div><h3 class="bk-h3" id="bkPointsH">' + esc(t('showPoints')) + '</h3><div class="bk-grid" role="group" aria-labelledby="bkPointsH">';
  h += bigButton('pts:facilities', t('pointsFac'), v.facilities, chip(FAC_FILL.referral, true) + chip(FAC_FILL.post, true));
  if (H.settlements) h += bigButton('pts:settlements', t('pointsStl'), v.settlements, SW.settlements());
  h += '</div></section>';

  // 6. the finder: the phone side of the tool, and the one AI sentence
  h += '<section class="bk-sec"><a class="bk-btn bk-btn--primary bk-btn--wide" href="/finder.html?lang=' + lang + '">' + esc(t('finder')) + '</a>' +
    '<p class="bk-p bk-p--muted">' + esc(t('finderD')) + '</p>' +
    '<p class="bk-p bk-p--muted">' + esc(t('finderAi')) + '</p></section>';

  // 7. the list of facilities, the sources, and the footer
  h += '<section class="bk-sec">' + facilityList(d);
  h += '<details class="bk-details" data-details="sources"' + (sourcesOpen ? ' open' : '') + '><summary>' + esc(t('sources')) + '</summary><ul class="bk-src">';
  for (const s of SOURCE_LINKS) h += '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s[lang]) + '</a></li>';
  h += '</ul><p class="bk-p bk-p--muted">' + esc(t('sourcesNote')) + '</p></details></section>';
  h += '<footer class="bk-foot"><p><button type="button" class="bk-link" data-act="share">' + esc(t('share')) + '</button> <span class="bk-status" id="bkStatus" role="status"></span></p>' +
    '<p>' + esc(S.draftNote[lang]) + (lang === 'so' ? ' <span lang="en">' + esc(S.draftNote.en) + '</span>' : ' <span lang="so">' + esc(S.draftNote.so) + '</span>') + '</p>' +
    '<p>' + esc(t('provenance')) + '</p></footer>';
  card.lang = lang;
  card.innerHTML = h;

  if (focusKey != null) {
    const again = focusKey ? card.querySelector<HTMLElement>(focusKey) : null;
    (again || card.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
  }
}

function status(msg: string): void {
  const el = document.getElementById('bkStatus');
  if (el) el.textContent = msg;
}

// ---- entry points used by the render pass -----------------------------------------------

/** Show or update the card and the district lines for the current state (render pass). */
export function renderBakool(v: ViewState, prev: ViewState | null): void {
  const entered = !prev;
  lang = v.lang;
  const cellChanged = !entered && JSON.stringify(prev!.cell) !== JSON.stringify(v.cell);
  const districtChanged = entered || lastDistrict !== v.district;
  ensureAdm2Layer();
  if (adm2Layer && !map.hasLayer(adm2Layer)) adm2Layer.addTo(map);
  styleAdm2(v.district);
  pointsToFront();
  // a new scope is a new subject: the tapped facility's record goes
  if (entered || prev!.district !== v.district || cellChanged) picked = null;
  renderCard(v);
  // the header follows the language: the finder link, the two door labels and the subtitle
  document.querySelectorAll<HTMLAnchorElement>('a[data-finder-link]').forEach((a) => {
    a.href = '/finder.html?lang=' + lang;
    a.textContent = lang === 'so' ? 'Raadiyaha taleefanka' : 'Phone finder';
  });
  const mapDoor = document.querySelector<HTMLAnchorElement>('a.door[aria-current]');
  if (mapDoor) mapDoor.textContent = lang === 'so' ? 'Khariidadda' : 'Map';
  const sub = document.querySelector<HTMLElement>('.header .subtitle');
  if (sub) sub.textContent = lang === 'so' ? 'Gaadhista daryeelka caafimaadka ee gobolka ugu saboolsan ee Soomaaliya la sahamiyay' : 'Reaching health care in Somalia’s poorest surveyed region';
  // the map follows a chosen district; a tapped square at a district's edge changes the district without a jump
  if (districtChanged && !cellChanged) {
    const b = districtBounds(v.district);
    if (b && b.isValid()) map.fitBounds(b, fitOptions());
    if (!entered) {
      const card = document.getElementById('bkCard');
      if (card) card.scrollTop = 0;
      // on phones the map is above the card: show the district that was just chosen
      if (!beside()) document.getElementById('map')?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }
  // a tapped square is read from the top of the card, where its block is
  if (cellChanged && v.cell) cardToTop();
  lastDistrict = v.district;
  if (!places && !placesRequested) {
    placesRequested = true;
    void fetchGzJson<PlacesData>(DATASETS.places)
      .then((p) => {
        places = p;
        renderCard(view);
      })
      .catch(() => undefined);
  }
}

/** After a tap on the map: the card is read from its top; on phones it sits under the map, so the page scrolls to it. */
function cardToTop(): void {
  const card = document.getElementById('bkCard');
  if (!card) return;
  card.scrollTop = 0;
  if (!beside()) card.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/** Wire the card's buttons once (the card itself is in index.html). */
export function initBakool(): void {
  const ui = document.getElementById('bakoolUi');
  if (!ui) return;

  // a tap on a facility marker puts its record on the card
  setFacilityClick((f) => {
    picked = f;
    renderCard(view);
    cardToTop();
  });

  ui.addEventListener('toggle', (e) => {
    const dt = e.target as HTMLDetailsElement;
    if (dt.dataset.details === 'list') listOpen = dt.open;
    else if (dt.dataset.details === 'sources') sourcesOpen = dt.open;
    lastKey = renderKey(view);
  }, true);

  ui.addEventListener('click', (e) => {
    const tgt = e.target as HTMLElement;
    const lb = tgt.closest<HTMLButtonElement>('.bk-lang button');
    if (lb) {
      const chosen = lb.dataset.lang as Lang;
      try {
        localStorage.setItem('bakool-lang', chosen);
      } catch {
        /* private mode */
      }
      setView({ lang: chosen });
      return;
    }
    const dp = tgt.closest<HTMLButtonElement>('.bk-pill');
    if (dp) {
      setView({ district: dp.dataset.d || null, cell: null }, { history: 'push' });
      return;
    }
    const fb = tgt.closest<HTMLButtonElement>('.bk-fac');
    if (fb) {
      const f = store.HEALTH.facilities.facilities.find((x) => x.id === fb.dataset.fac);
      if (f) {
        picked = f;
        renderCard(view);
        map.panTo([f.lat, f.lon], { animate: !reducedMotion() });
      }
      return;
    }
    const act = tgt.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act) return;
    if (act.startsWith('fill:')) {
      const which = act.slice(5) as FillChoice;
      setView({ access: which === 'access', travel: which === 'travel', buildings: which === 'buildings' });
    } else if (act === 'pts:facilities') setView({ facilities: !view.facilities });
    else if (act === 'pts:settlements') setView({ settlements: !view.settlements });
    else if (act === 'cell:clear') setView({ cell: null }, { history: 'push' });
    else if (act === 'fac:close') {
      picked = null;
      renderCard(view);
    } else if (act === 'share') {
      // the address bar carries the whole view, language included (router.ts)
      const url = location.href;
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => status(t('shared'))).catch(() => status(url));
      else status(url);
    }
  });
}
