/**
 * District access notes, each with the published source it comes from. A note
 * never blocks an answer: the tool gives the answer with the note and names the
 * next facility as well. They are statements about 2024-2025 reporting, not live
 * conditions, and they say so; a health worker's phone can be inspected on the
 * road, so the wording stays practical (restricted access, reopened roads, check
 * locally) and carries no political statement. Review before each demo.
 */
export interface DistrictFlag {
  district: string;
  en: string;
  so: string;
  source: string;
  url: string;
  asOf: string;
}

export const DISTRICT_FLAGS: DistrictFlag[] = [
  {
    district: 'Rab Dhuure',
    en: '2025 reporting describes restricted access to Rab Dhuure town; the roads to it reopened in 2025 after a long blockade. Check locally before travelling.',
    so: 'Warbixinta 2025 waxay sheegaysaa in gaadhista magaalada Rab Dhuure xaddidan tahay; waddooyinka waa la furay 2025 kadib xannibaad dheer. Hubi xaaladda goobta ka hor safarka.',
    source: 'EUAA, Somalia security situation 2025, Bakool; Radio Ergo, May 2025',
    url: 'https://www.euaa.europa.eu/coi/somalia/2025/security-situation/22-south-west/221-bakool',
    asOf: '2025',
  },
  {
    district: 'Tayeeglow',
    en: '2025 reporting describes restricted access to Tayeeglow town. Check locally before travelling.',
    so: 'Warbixinta 2025 waxay sheegaysaa in gaadhista magaalada Tayeeglow xaddidan tahay. Hubi xaaladda goobta ka hor safarka.',
    source: 'EUAA, Somalia security situation 2025, Bakool',
    url: 'https://www.euaa.europa.eu/coi/somalia/2025/security-situation/22-south-west/221-bakool',
    asOf: '2025',
  },
  {
    district: 'Xudur',
    en: 'Road access to Xudur was blocked for over a decade and only partially reopened in 2025. Check the road before travelling.',
    so: 'Waddooyinka Xudur waxay xirnaayeen in ka badan toban sano, waxaana qayb ahaan la furay 2025. Hubi waddada ka hor safarka.',
    source: 'EUAA 2025 quoting UNOCHA (August 2024); EUAA 2026; Radio Ergo, May 2025',
    url: 'https://www.euaa.europa.eu/somalia-security-situation/221-bakool',
    asOf: '2025',
  },
  {
    district: 'Waajid',
    en: 'Road access to Waajid was blocked for years and only partially reopened in 2025. Check the road before travelling.',
    so: 'Waddooyinka Waajid sanado ayay xirnaayeen, waxaana qayb ahaan la furay 2025. Hubi waddada ka hor safarka.',
    source: 'EUAA 2026 (partial lifting of the blockades in Xudur and Waajid); Radio Ergo, May 2025',
    url: 'https://www.euaa.europa.eu/somalia-security-situation/221-bakool',
    asOf: '2025',
  },
];

export function flagFor(district: string | null | undefined): DistrictFlag | null {
  if (!district) return null;
  return DISTRICT_FLAGS.find((f) => f.district.toLowerCase() === district.toLowerCase()) || null;
}
