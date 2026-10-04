/**
 * Every sentence the finder can show, in English and Somali. The tool composes
 * answers only from these templates and values read from the data files: a fixed
 * list of answers, as the challenge asks. The Somali column is a DRAFT written
 * without a native speaker; the UI marks it "draft" until a Somali speaker has
 * checked it. Placeholders in braces are filled from data; nothing else is
 * generated.
 */
export type Lang = 'en' | 'so';

export const STRINGS = {
  title: { en: 'Bakool facility finder', so: 'Raadiyaha xarumaha caafimaadka Bakool' },
  tagline: {
    en: 'Ask where the nearest listed health facility is, in Somali (Af-Soomaali) or English, by voice or text. Works offline after the first visit.',
    so: 'Weydii halka xarunta caafimaadka liiska ugu dhow ku taal, Af-Soomaali ama Ingiriisi, cod ama qoraal. Wuxuu shaqeeyaa internet la\'aan kadib booqashada koowaad.',
  },
  placeholder: { en: 'e.g. nearest facility to Kulunjerer · delivery near Waajid', so: 'tus. xarunta ugu dhow Kulunjerer · dhalmo Waajid agteeda' },
  examples: { en: ['nearest facility to Kulunjerer', 'delivery near Waajid', 'Xudur'], so: ['xarunta ugu dhow Kulunjerer', 'dhalmo Waajid agteeda', 'Xudur'] },
  ask: { en: 'Ask', so: 'Weydii' },
  speak: { en: 'Speak', so: 'Ku hadal' },
  stop: { en: 'Stop', so: 'Jooji' },
  listening: { en: 'Listening… tap Stop when you have finished.', so: 'Waan dhegaysanayaa… taabo Jooji markaad dhammayso.' },
  transcribing: { en: 'Working out what you said…', so: 'Waxaan fahmayaa waxaad tidhi…' },
  loadingModel: { en: 'Preparing voice (one-time download, about 70 MB)…', so: 'Codka waa la diyaarinayaa (soo dejin hal mar ah, qiyaastii 70 MB)…' },
  voiceNeeds: {
    en: 'Voice needs a one-time download of about 70 MB (use Wi-Fi). Typing works now.',
    so: 'Codku wuxuu u baahan yahay soo dejin hal mar ah oo qiyaastii 70 MB ah (isticmaal Wi-Fi). Qoraalku hadda wuu shaqeeyaa.',
  },
  prepareVoice: { en: 'Download voice', so: 'Soo deji codka' },
  voiceReady: { en: 'Voice ready offline', so: 'Codku diyaar internet la\'aan' },
  voiceNot: { en: 'Voice not downloaded (70 MB)', so: 'Codka lama soo dejin (70 MB)' },
  heard: { en: 'I heard:', so: 'Waxaan maqlay:' },
  heardNothing: { en: 'I did not catch that. Speak closer to the phone, or type the name.', so: 'Ma qaban waxaad tidhi. U hadal taleefanka agtiisa, ama qor magaca.' },
  didYouMean: { en: 'Did you mean {place}?', so: 'Ma waxaad u jeeddaa {place}?' },
  match: { en: 'match {score}%', so: 'isku mid {score}%' },
  yes: { en: 'Yes', so: 'Haa' },
  no: { en: 'No', so: 'Maya' },
  notSure: { en: 'Not sure. Ask a person.', so: 'Ma hubo. Qof weydii.' },
  notSureHelp: {
    en: 'No place in Bakool matched. Pick one below, type the name of the village, town or district, or ask someone who knows the area.',
    so: 'Ma helin meel Bakool ka tirsan oo u dhiganta. Hoos ka dooro, qor magaca tuulada, magaalada ama degmada, ama weydii qof aagga yaqaan.',
  },
  outsideRegion: {
    en: '{place} is outside Bakool. This finder covers Bakool only; ask a person who knows that area.',
    so: '{place} waa Bakool dibaddeeda. Raadiyahani wuxuu daboolaa Bakool oo keliya; weydii qof aaggaas yaqaan.',
  },
  outOfScope: {
    en: 'This finder only finds facilities and writes referral slips. It does not answer questions about medicines or doses. Ask it for a place; speak to a health worker about the treatment.',
    so: 'Raadiyahani wuxuu helaa xarumaha oo keliya, wuxuuna qoraa warqadaha gudbinta. Kama jawaabo su\'aalaha daawooyinka ama qiyaasta daawada. Weydii meel; daaweynta la hadal shaqaale caafimaad.',
  },
  nearestIs: {
    en: 'From {place}, the nearest listed facility is {facility} ({type}), about {km} km {dir}, in a straight line.',
    so: 'Laga bilaabo {place}, xarunta liiska ugu dhow waa {facility} ({type}), qiyaastii {km} km dhanka {dir}, toos.',
  },
  walkTime: {
    en: 'Modelled walk to care from this 10 km square: {walk}; by vehicle about {drive} (2020 model; an average for the square, not the walk to this facility).',
    so: 'Socodka la qiyaasay ee ilaa daryeelka laga bilaabo afargeeskan 10 km: {walk}; gaadhi qiyaastii {drive} (qiyaas 2020; celcelis afargeeska, ma aha socodka ilaa xaruntan).',
  },
  walkTimeOnly: { en: 'Modelled walk to care from this 10 km square: {walk} (2020 model; an average for the square).', so: 'Socodka la qiyaasay ee ilaa daryeelka laga bilaabo afargeeskan 10 km: {walk} (qiyaas 2020; celcelis afargeeska).' },
  referralIs: {
    en: 'The nearest health centre or MCH centre, a level above a health post, is {facility}, about {km} km {dir}. Whether it can take a case today is not known.',
    so: 'Xarunta caafimaadka ama MCH-ga ugu dhow, heer ka sarreeya rugta caafimaadka, waa {facility}, qiyaastii {km} km dhanka {dir}. In ay maanta kiis qaabili karto lama oga.',
  },
  nextIs: { en: 'Next nearest: {facility} ({type}), about {km} km {dir}.', so: 'Tan xigta: {facility} ({type}), qiyaastii {km} km dhanka {dir}.' },
  serviceUnknown: {
    en: 'No list says which services a facility offers; ask there or at the district health office.',
    so: 'Liis ma sheego adeegyada ay xarun bixiso; ka weydii halkaas ama xafiiska caafimaadka degmada.',
  },
  serviceUnknownPost: {
    en: 'No list says which services a facility offers; ask there or at the district health office. A health post may not handle {service}, so the nearest health centre is named too.',
    so: 'Liis ma sheego adeegyada ay xarun bixiso; ka weydii halkaas ama xafiiska caafimaadka degmada. Rugta caafimaadka waxaa laga yaabaa inaysan qaban {service}, sidaas darteed xarunta caafimaadka ugu dhow ayaa sidoo kale la sheegay.',
  },
  referralListed: { en: '{facility}: listed in the {source}.', so: '{facility}: waxay ku jirtaa {source}.' },
  hospitalNote: {
    en: 'No hospital in Bakool is on either list. WHO reported services restored at Bakool Regional Hospital in Xudur town in January 2026; ask the district health office.',
    so: 'Isbitaal Bakool ku yaal liisaska kuma jiro. WHO waxay sheegtay in adeegyada Isbitaalka Gobolka Bakool ee magaalada Xudur dib loo soo celiyay Janaayo 2026; weydii xafiiska caafimaadka degmada.',
  },
  registerDate: {
    en: 'Listed in the {source}. Names and operators are as recorded then; no source says whether it is open or staffed today.',
    so: 'Waxay ku jirtaa {source}. Magacyada iyo hawlwadeennadu waa sidii markaas la diiwaangeliyay; ma jiro il sheegaysa inay maanta furan tahay ama shaqaale joogaan.',
  },
  flagged: { en: 'Access note, {district} (as of {asOf} reporting): {flag}', so: 'Ogeysiis marin, {district} (warbixin {asOf}): {flag}' },
  noFacility: { en: 'No listed facility was found near {place}.', so: 'Xarun liiska ku jirta laguma helin agagaarka {place}.' },
  youAsked: { en: 'You asked about', so: 'Waxaad weydiisay' },
  service: { en: 'Service', so: 'Adeeg' },
  netOnline: { en: 'Online', so: 'Internet' },
  netOffline: { en: '● Offline · using saved data', so: '● Internet la\'aan · xog kaydsan' },
  savedPage: { en: 'page and data saved for offline use', so: 'bogga iyo xogta waa la kaydiyay internet la\'aan' },
  savingPage: { en: 'saving the page and data for offline use…', so: 'bogga iyo xogta waa la kaydinayaa…' },
  noMic: { en: 'Voice input is not available on this device; type instead.', so: 'Codka laguma heli karo qalabkan; qor.' },
  speechFailed: { en: 'The speech model could not load. Type instead.', so: 'Moodelka hadalka lama soo dejin karin. Qor.' },
  aiLine: {
    en: 'AI here: speech recognition only (Whisper tiny, on this phone, offline). Not AI, on purpose: the matching, the distances and every sentence are fixed and filled from cited files. Nothing is generated.',
    so: 'AI halkan: aqoonsiga hadalka oo keliya (Whisper tiny, taleefankan, internet la\'aan). AI ma aha, ula kac: isbarbardhigga, masaafooyinka iyo jumlad kasta, kuwaas oo go\'an oo laga buuxiyay faylal la tixraacay. Waxba lama abuuro.',
  },
  privacy: { en: 'No names, no phone numbers. Nothing leaves this phone unless you send it.', so: 'Magacyo ma jiraan, lambarro taleefan ma jiraan. Waxba kama baxaan taleefankan ilaa aad dirto.' },
  footer: {
    en: 'Facilities: WHO/KEMRI database 2019 (from lists dated up to 2013) and WHO/MoH list 2021, via HDX (CC BY-IGO). Travel time: Malaria Atlas Project 2020 (CC BY). Places: © OpenStreetMap contributors (ODbL). Speech recognition: OpenAI Whisper tiny (MIT) in the browser. Questions are not stored. Slips you save and recordings you keep stay on this phone until you delete or send them; a slip never carries a name.',
    so: 'Xarumaha: xogta WHO/KEMRI 2019 (liisas ilaa 2013) iyo liiska WHO/MoH 2021, HDX (CC BY-IGO). Waqtiga safarka: Malaria Atlas Project 2020 (CC BY). Meelaha: © OpenStreetMap contributors (ODbL). Hadalka: OpenAI Whisper tiny (MIT) oo biraawsarka ku shaqeeya. Su\'aalaha lama kaydiyo. Warqadaha aad kaydiso iyo cajaladaha aad hayso waxay ku sii jiraan taleefankan ilaa aad tirtirto ama dirto; warqad weligeed magac ma qaado.',
  },
  draftNote: { en: 'The Somali text is a draft; a native speaker has not checked it yet.', so: 'Af-Soomaaliga: qoraal qabyo ah oo aan af-hooyo weli hubin.' },
  mapLink: { en: 'Planner\'s map (needs internet)', so: 'Khariidadda qorshaynta (internet u baahan)' },
  openOnMap: { en: 'Open on the map (needs internet)', so: 'Khariidadda ka fur (internet u baahan)' },
  // ---- referral slip (draft Somali) ----
  slipOpen: { en: 'Make a referral slip', so: 'Samee warqad gudbin' },
  slipTitle: { en: 'Referral slip', so: 'Warqadda gudbinta' },
  slipHelp: {
    en: 'Say or tap who is being referred and why. No name, no phone number: place, facility, case type and time only.',
    so: 'Sheeg ama taabo cidda la gudbinayo iyo sababta. Magac iyo lambar ma jiraan: meesha, xarunta, nooca xaaladda iyo waqtiga oo keliya.',
  },
  slipConsent: {
    en: 'The slip describes a person. Tell the person, or whoever is with them, what will be sent and to whom; they can say no.',
    so: 'Warqaddu qof ayay tilmaamaysaa. U sheeg qofka, ama cidda la joogta, waxa la dirayo iyo cidda loo dirayo; way diidi karaan.',
  },
  slipSpeak: { en: 'Speak the slip', so: 'Ku hadal warqadda' },
  slipWho: { en: 'Who', so: 'Qofka' },
  slipWhy: { en: 'Why', so: 'Sababta' },
  slipTo: { en: 'To', so: 'Loo diro' },
  slipUrgent: { en: 'Urgent', so: 'Degdeg' },
  slipHuman: { en: 'Nothing is sent by this tool. You choose who receives it and you press send.', so: 'Qalabkani waxba ma diro. Adigaa dooranaya cidda hesha, adigaana riixaya dir.' },
  slipSms: { en: 'Open SMS app', so: 'Fur SMS' },
  slipSave: { en: 'Save on this phone', so: 'Ku kaydi taleefankan' },
  slipCopy: { en: 'Copy text', so: 'Koobi qoraalka' },
  slipSaved: { en: 'Saved on this phone.', so: 'Waa lagu kaydiyay taleefankan.' },
  slipIncomplete: { en: 'Choose who and why first.', so: 'Marka hore dooro qofka iyo sababta.' },
  slipAmbiguous: { en: 'I heard more than one option for "{slot}": tap the right one.', so: 'Waxaan maqlay in ka badan hal dooq oo "{slot}" ah: taabo tan saxda ah.' },
  slipLogTitle: { en: 'Slips on this phone', so: 'Warqadaha taleefankan ku jira' },
  slipLogEmpty: { en: 'No slips saved.', so: 'Warqad lama kaydin.' },
  slipClear: { en: 'Delete all slips', so: 'Tirtir dhammaan warqadaha' },
  slipSent: { en: 'SMS app opened', so: 'SMS waa la furay' },
  slipNotSent: { en: 'saved, not sent', so: 'la kaydiyay, lama dirin' },
  slipExpiry: { en: 'Slips are removed from this phone after 30 days.', so: '30 maalmood kadib warqadaha taleefankan waa laga tirtiraa.' },
  confirmDelete: { en: 'Delete all? This cannot be undone.', so: 'Dhammaan ma tirtiraa? Dib looma soo celin karo.' },
  more: { en: 'Slips and recordings on this phone', so: 'Warqadaha iyo cajaladaha taleefankan ku jira' },
  // ---- voice recordings kept for speech data (draft Somali) ----
  donateAsk: { en: 'Keep this recording of your voice for Somali speech data? Only if you said nothing about a patient.', so: 'Ma haysaa cajaladdan codkaaga xogta hadalka Soomaaliga? Kaliya haddii aadan waxba ka sheegin bukaan.' },
  donateEdit: { en: 'Edit what you said', so: 'Wax ka beddel waxaad tidhi' },
  donateHelp: {
    en: 'Keep it only if it is your own voice asking about a place, with nothing about a patient and no one else speaking. It stays on this phone until you export it yourself, and you can delete it any time. Exported recordings are released as public-domain (CC0) speech data. Somali has very little public speech data and Af-Maay has none; recordings like this, with the text you confirm, are how that changes.',
    so: 'Hay kaliya haddii uu yahay codkaaga oo meel weydiinaya, oo aan waxba ka sheegin bukaan, qof kalena aan hadlayn. Wuxuu ku sii jiraa taleefankan ilaa aad adigu dibadda u saarto, waadna tirtiri kartaa mar kasta. Cajaladaha la saaro waxaa lagu sii daayaa xog hadal oo dadweyne (CC0). Af-Soomaaligu wuxuu leeyahay xog hadal oo dadweyne oo aad u yar, Af-Maayna ma laha; cajaladaha sidan ah, oo wata qoraalka aad xaqiijisay, ayaa isbeddelka keenaya.',
  },
  donateLang: { en: 'I spoke', so: 'Waxaan ku hadlay' },
  donateSo: { en: 'Somali', so: 'Af-Soomaali' },
  donateYmm: { en: 'Af-Maay', so: 'Af-Maay' },
  donateOther: { en: 'another language', so: 'luqad kale' },
  donateText: { en: 'What I actually said', so: 'Waxa aan runtii idhi' },
  donateKeep: { en: 'Keep on this phone', so: 'Ku hay taleefankan' },
  donateSkip: { en: 'Not now', so: 'Hadda maya' },
  donateKept: { en: 'Kept. {n} recordings on this phone.', so: 'Waa la hayaa. {n} cajaladood ayaa taleefankan ku jira.' },
  donateCount: { en: '{n} recordings kept on this phone', so: '{n} cajaladood ayaa taleefankan lagu hayaa' },
  donateExport: { en: 'Export for speech data', so: 'Dibadda u saar xogta hadalka' },
  donateExportConfirm: {
    en: 'Share {n} recordings of your voice and the confirmed text as public-domain (CC0) speech data? Share only with people you trust to build Somali or Af-Maay speech data; once shared they cannot be recalled.',
    so: 'Ma wadaagtaa {n} cajaladood oo codkaaga ah iyo qoraalka la xaqiijiyay, xog hadal oo dadweyne (CC0) ahaan? La wadaag oo keliya dad aad ku kalsoon tahay inay dhisaan xogta hadalka Soomaaliga ama Af-Maay; marka la wadaago dib looma soo celin karo.',
  },
  donateClear: { en: 'Delete all recordings', so: 'Tirtir dhammaan cajaladaha' },
  donateExported: { en: 'Exported {n} recordings as a zip.', so: '{n} cajaladood ayaa zip ahaan loo saaray.' },
  kinds: {
    village: { en: 'village', so: 'tuulo' },
    hamlet: { en: 'hamlet', so: 'tuulo yar' },
    town: { en: 'town', so: 'magaalo' },
    city: { en: 'city', so: 'magaalo' },
    district: { en: 'district', so: 'degmo' },
    facility: { en: 'facility', so: 'xarun' },
  } as Record<string, { en: string; so: string }>,
  dirs: {
    en: ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'],
    so: ['waqooyi', 'waqooyi-bari', 'bari', 'koonfur-bari', 'koonfur', 'koonfur-galbeed', 'galbeed', 'waqooyi-galbeed'],
  },
  types: {
    'Health Post': { en: 'health post', so: 'rugta caafimaadka' },
    'Maternal & Child Health Centre': { en: 'maternal and child health centre', so: 'xarunta caafimaadka hooyada iyo ilmaha' },
    'Health Center (HC)': { en: 'health centre', so: 'xarunta caafimaadka' },
    'Hospital': { en: 'hospital', so: 'isbitaal' },
  } as Record<string, { en: string; so: string }>,
  sources: {
    maina2019: { en: 'WHO/KEMRI facility database, 2019 (from lists dated up to 2013)', so: 'xogta xarumaha WHO/KEMRI, 2019 (liisas ilaa 2013)' },
    who2021: { en: 'WHO / Ministry of Health list, 2021', so: 'liiska WHO / Wasaaradda Caafimaadka, 2021' },
    osm: { en: 'OpenStreetMap', so: 'OpenStreetMap' },
  } as Record<string, { en: string; so: string }>,
} as const;

export function t(key: keyof typeof STRINGS, lang: Lang, vars: Record<string, string | number> = {}): string {
  const entry = STRINGS[key] as unknown as { en: string; so: string };
  let s = entry[lang] ?? entry.en;
  for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
}

export function minutesWords(m: number | undefined, lang: Lang): string {
  if (m == null) return lang === 'so' ? 'lama oga' : 'unknown';
  if (m < 60) return Math.round(m) + (lang === 'so' ? ' daqiiqo' : ' min');
  const h = Math.floor(m / 60);
  const r = Math.round(m - h * 60);
  if (lang === 'so') return h + ' saac' + (r ? ' iyo ' + r + ' daqiiqo' : '');
  return h + ' h' + (r ? ' ' + r + ' min' : '');
}
