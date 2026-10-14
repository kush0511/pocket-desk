// Pocket Desk — a calm, source-labelled iPhone widget for Scriptable.
// https://kush0511.github.io/pocket-desk/
// Run once inside Scriptable for previews and private, on-device setup.
// Large: four cards. Medium: markets | local | sora,air (any two cards).
// Small: sora | spx | train | air. Default: sora.
// iOS controls refresh timing; this script cannot guarantee live updates.
// Air quality: CAMS model via Open-Meteo, US AQI (not Singapore PSI).
// Train: SG Last Train Home planning model, never a live ETA or service guarantee.

const PD = {
  version: 1,
  site: 'https://kush0511.github.io/pocket-desk/',
  soraSite: 'https://kush0511.github.io/sora-rates/',
  soraData: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSetwT6jWgq4H6LPeIp3hB_hgo4HdF1P1Q7pu0JYlaUqXnzxbonDFpA_Myndbv3ewsbFOyGhW6kxLro/pub?output=csv',
  spxSite: 'https://kush0511.github.io/spy-valuation-bands/',
  spxData: 'https://raw.githubusercontent.com/kush0511/spy-valuation-bands/main/src/data/valuation-data.json',
  trainSite: 'https://kush0511.github.io/sg-last-train-home/',
  trainData: 'https://raw.githubusercontent.com/kush0511/sg-last-train-home/main/',
  stationsData: 'https://kush0511.github.io/pocket-desk/data/sg-station-coordinates.json',
  airSite: 'https://open-meteo.com/en/docs/air-quality-api',
  hour: 3600000,
  day: 86400000,
};
const COLORS = {
  background: '101C25', panel: '121D2B', panelBorder: '233246',
  text: 'F1F5FA', muted: 'A4B3C5', faint: '7F92AA',
  sora: '9CDEC8', spx: 'AAC5F7', train: 'EAC793', air: 'AED4BE',
  warning: 'EAC793', bad: 'F0A6A6',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fm = FileManager.local();
const root = fm.joinPath(fm.documentsDirectory(), 'pocket-desk');
if (!fm.fileExists(root)) fm.createDirectory(root, true);
const settingsPath = fm.joinPath(root, 'settings.json');
const now = () => Date.now();
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
function validIso(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
const color = (hex) => new Color(hex);
const age = (time) => Math.max(0, now() - time);
const isoAge = (date) => (now() - Date.parse(date + 'T00:00:00Z')) / PD.day;
function shortDate(iso) {
  if (!validIso(iso)) return 'Date unavailable';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ' ' + String(y).slice(-2) : ''}`;
}
function localDate(timestamp) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function clockText(timestamp, zone) {
  const d = new Date(timestamp);
  if (!Number.isFinite(d.getTime())) return '—';
  if (zone === 'SG') return new Date(timestamp + 8 * PD.hour).toISOString().slice(11, 16);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function elapsed(timestamp) {
  const minutes = Math.floor(age(timestamp) / 60000);
  return minutes < 1 ? 'now' : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
}
function readJson(path) {
  try { return fm.fileExists(path) ? JSON.parse(fm.readString(path)) : null; } catch { return null; }
}
function saveJson(path, value) {
  // Storage failure must not suppress otherwise valid live data.
  try { fm.writeString(path, JSON.stringify(value)); } catch { /* best effort */ }
}
function validLocation(v) {
  return v && finite(v.latitude) && finite(v.longitude) && Math.abs(v.latitude) <= 90 && Math.abs(v.longitude) <= 180 && finite(v.checkedAt) && v.checkedAt > 0 && v.checkedAt <= now() + 60000;
}
function readSettings() {
  const s = readJson(settingsPath) || {};
  return {
    destination: typeof s.destination === 'string' ? s.destination : 'lakeside',
    origin: typeof s.origin === 'string' ? s.origin : '',
    autoLocation: s.autoLocation === true,
    airConsent: s.airConsent === true,
    airMode: s.airMode === 'manual' ? 'manual' : 'auto',
    location: validLocation(s.location) ? s.location : null,
    airLocation: validLocation(s.airLocation) ? s.airLocation : null,
    buffer: Number.isInteger(s.buffer) && s.buffer >= 0 && s.buffer <= 15 ? s.buffer : 3,
  };
}
function saveSettings(s) { saveJson(settingsPath, s); }
async function requestJson(url) {
  const request = new Request(url);
  request.timeoutInterval = 8;
  const value = await request.loadJSON();
  if (request.response && (request.response.statusCode < 200 || request.response.statusCode >= 300)) throw new Error('Source unavailable');
  return value;
}
async function cached(key, ttl, maximumAge, load, validate) {
  const path = fm.joinPath(root, key + '.json');
  const saved = readJson(path);
  let usable = false;
  try { usable = saved && finite(saved.fetchedAt) && saved.fetchedAt <= now() + 60000 && age(saved.fetchedAt) <= maximumAge && validate(saved.value); } catch { /* discard a malformed cache and still try online */ }
  if (usable && age(saved.fetchedAt) < ttl) return { value: saved.value, fetchedAt: saved.fetchedAt, offline: false };
  try {
    const value = await load();
    if (!validate(value)) throw new Error('Invalid source data');
    const result = { value, fetchedAt: now(), offline: false };
    saveJson(path, result);
    return result;
  } catch {
    if (usable) return { value: saved.value, fetchedAt: saved.fetchedAt, offline: true };
    throw new Error('No recent data available');
  }
}
function splitCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === ',' || c === '\n')) { row.push(cell); cell = ''; if (c === '\n') { rows.push(row); row = []; } }
    else if (c !== '\r') cell += c;
  }
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  return rows;
}
function parseSora(text) {
  const result = [];
  for (const cells of splitCsv(text).slice(1)) {
    const match = (cells[0] || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) continue;
    const date = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    const values = cells.slice(1, 4).map((x) => x.trim() === '' ? NaN : Number(x.trim().replace(/%$/, '')));
    if (validIso(date) && values.length === 3 && values.every((x) => finite(x) && x > -100 && x < 100)) result.push({ date, sora: values[0], m1: values[1], m3: values[2] });
  }
  return [...new Map(result.map((r) => [r.date, r])).values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-60);
}
function validRateRows(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((r) => r && validIso(r.date) && [r.sora, r.m1, r.m3].every(finite));
}
function validSpxRows(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((r) => r && validIso(r.date) && [r.spx, r.eps, r.pe].every((v) => finite(v) && v > 0) && Math.abs(r.spx / r.eps - r.pe) < 0.05);
}
async function loadSora() {
  return cached('sora-v1', 3 * PD.hour, 14 * PD.day, async () => {
    const req = new Request(PD.soraData); req.timeoutInterval = 8;
    return parseSora(await req.loadString());
  }, validRateRows);
}
async function loadSpx() {
  return cached('spx-v1', 3 * PD.hour, 14 * PD.day, async () => {
    const json = await requestJson(PD.spxData);
    if (!Array.isArray(json.rows)) throw new Error('Invalid snapshot');
    return json.rows.filter((r) => validSpxRows([r])).sort((a, b) => a.date.localeCompare(b.date)).slice(-60);
  }, validSpxRows);
}
function validTrainData(d) {
  if (!d || !validIso(d.date) || !Array.isArray(d.stations) || !Array.isArray(d.patterns) || !Array.isArray(d.rules) || !d.holidays || !Array.isArray(d.adjustments)) return false;
  if (!d.stations.length || !d.patterns.length || !d.published) return false;
  return d.stations.every((s) => typeof s.id === 'string' && typeof s.name === 'string' && Array.isArray(s.codes)) &&
    d.patterns.every((p) => typeof p.id === 'string' && Array.isArray(p.stops) && Array.isArray(p.segmentMinutes) && p.segmentMinutes.every((v) => finite(v) && v >= 0) && finite(p.lateHeadwayMinutes) && p.lateHeadwayMinutes > 0);
}
async function loadTrainData() {
  return cached('train-v1', PD.day, 30 * PD.day, async () => {
    const index = await requestJson(PD.trainData + 'data/index.json');
    if (index.schemaVersion !== 1 || !/^\d{4}\.\d{2}\.\d{2}$/.test(index.datasetVersion)) throw new Error('Invalid timetable index');
    const suffix = '.v' + index.datasetVersion + '.json';
    const [network, timetable, transfers, holidays] = await Promise.all([
      requestJson(PD.trainData + 'data/network' + suffix), requestJson(PD.trainData + 'data/timetables' + suffix),
      requestJson(PD.trainData + 'data/transfers' + suffix), requestJson(PD.trainData + 'src/data/public-holidays.json'),
    ]);
    for (const entry of [network, timetable, transfers]) {
      if (entry.schemaVersion !== 1 || entry.datasetVersion !== index.datasetVersion || !entry.payload) throw new Error('Mismatched timetable data');
    }
    return { date: network.networkAsOf, stations: network.payload.stations, patterns: timetable.payload.patterns,
      published: timetable.payload.publishedLastDepartures, adjustments: timetable.payload.adjustments,
      rules: transfers.payload.rules, holidays: holidays.holidays };
  }, validTrainData);
}
function validStations(data) {
  return data && data.schemaVersion === 1 && Array.isArray(data.stations) && data.stations.length > 0 && data.stations.every((s) =>
    typeof s.id === 'string' && finite(s.latitude) && finite(s.longitude) && s.latitude >= 1.1 && s.latitude <= 1.6 && s.longitude >= 103.5 && s.longitude <= 104.1);
}
async function loadStations() {
  return cached('stations-v1', 7 * PD.day, 90 * PD.day, () => requestJson(PD.stationsData), validStations);
}
function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad, dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
function nearestStation(location, stations, network) {
  const activeMrt = new Set(network.filter((s) => s.codes.some((code) => /^(NS|EW|CG|NE|CC|DT|TE)\d+$/.test(code))).map((s) => s.id));
  const ranked = stations.filter((s) => activeMrt.has(s.id)).map((s) => {
    const points = Array.isArray(s.exits) && s.exits.length ? s.exits.filter((e) => finite(e.latitude) && finite(e.longitude)) : [s];
    return { station: s, distance: Math.min(...(points.length ? points : [s]).map((p) => distanceKm(location, p))) };
  }).sort((a, b) => a.distance - b.distance);
  return ranked[0] || null;
}
async function currentLocation(settings) {
  if (!settings.autoLocation) return { value: null, cached: false };
  let timer;
  try {
    Location.setAccuracyToHundredMeters();
    const location = await Promise.race([
      Location.current(),
      new Promise((_, reject) => { timer = Timer.schedule(config.runsInWidget ? 4000 : 15000, false, () => reject(new Error('Location timed out'))); }),
    ]);
    const value = { latitude: location.latitude, longitude: location.longitude, checkedAt: now() };
    if (!validLocation(value) || (finite(location.horizontalAccuracy) && (location.horizontalAccuracy < 0 || location.horizontalAccuracy > 1500))) throw new Error('Location is imprecise');
    settings.location = value; saveSettings(settings);
    return { value, cached: false };
  } catch {
    // Old location must never masquerade as the user's current position.
    return { value: settings.location && age(settings.location.checkedAt) <= 6 * PD.hour ? settings.location : null, cached: true };
  } finally { if (timer) timer.invalidate(); }
}
async function loadAir(settings, locationResult) {
  if (!settings.airConsent) return null;
  const location = settings.airMode === 'manual' ? settings.airLocation : locationResult.value;
  if (!location) throw new Error('Location unavailable');
  const latitude = Number(location.latitude.toFixed(2)), longitude = Number(location.longitude.toFixed(2));
  const key = `air-v1-${latitude}-${longitude}`;
  const result = await cached(key, 30 * 60000, 6 * PD.hour, async () => {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,pm2_5&timezone=auto&timeformat=unixtime`;
    const json = await requestJson(url), c = json.current;
    if (!c) throw new Error('No air model output');
    return { aqi: c.us_aqi, pm25: c.pm2_5, time: c.time * 1000 };
  }, (d) => d && finite(d.aqi) && d.aqi >= 0 && d.aqi <= 1000 && finite(d.time) && age(d.time) <= 6 * PD.hour && d.time <= now() + PD.hour);
  return { ...result, manual: settings.airMode === 'manual', locationAt: location.checkedAt, locationCached: locationResult.cached };
}
function singaporeServiceDate(timestamp = now()) {
  const singapore = new Date(timestamp + 8 * PD.hour);
  if (singapore.getUTCHours() < 4) singapore.setUTCDate(singapore.getUTCDate() - 1);
  return singapore.toISOString().slice(0, 10);
}
function resolveStation(input, stations) {
  const text = String(input || '').trim().toLowerCase();
  return stations.find((s) => s.id === text || s.name.toLowerCase() === text || s.codes.some((c) => c.toLowerCase() === text));
}
function setupUrl(section = '') {
  return 'scriptable:///run?scriptName=' + encodeURIComponent(Script.name()) + (section ? '&setup=' + encodeURIComponent(section) : '');
}
function mapsUrl(station = 'Lakeside') {
  return 'https://maps.apple.com/?daddr=' + encodeURIComponent(station + ' MRT Station, Singapore') + '&dirflg=r';
}
function emptyCard(key, title, message, detail, url) {
  return { key, title, metric: '—', label: message, detail, foot: 'Tap to open', url: url || setupUrl(key), warning: true };
}
function sourceFoot(date, offline, threshold = 4) {
  return `${shortDate(date)}${isoAge(date) > threshold ? ' · old' : ''}${offline ? ' · cached' : ''}`;
}
async function soraCard() {
  try {
    const result = await loadSora(), rows = result.value, last = rows[rows.length - 1];
    if (isoAge(last.date) > 30 || isoAge(last.date) < -1) throw new Error('Old rates');
    return { key: 'sora', title: 'SORA', metric: last.sora.toFixed(4), unit: '%', label: 'Overnight',
      detail: `1M ${last.m1.toFixed(3)}% · 3M ${last.m3.toFixed(3)}%`, foot: sourceFoot(last.date, result.offline),
      warning: result.offline || isoAge(last.date) > 4, url: PD.soraSite };
  } catch { return emptyCard('sora', 'SORA', 'Rates unavailable', 'Open the rates dashboard', PD.soraSite); }
}
async function spxCard() {
  try {
    const result = await loadSpx(), rows = result.value, last = rows[rows.length - 1];
    if (isoAge(last.date) > 30 || isoAge(last.date) < -1) throw new Error('Old valuation');
    const band = last.pe < 16 ? 'Below 16× band' : last.pe > 26 ? 'Above 26× band' : last.pe % 2 === 0 ? `At ${last.pe}× band` : `${Math.floor(last.pe / 2) * 2}–${Math.ceil(last.pe / 2) * 2}× band`;
    return { key: 'spx', title: 'S&P 500', metric: last.pe.toFixed(2), unit: '×', label: 'Forward P/E', detail: band,
      foot: sourceFoot(last.date, result.offline), warning: result.offline || isoAge(last.date) > 4, url: PD.spxSite };
  } catch { return emptyCard('spx', 'S&P 500', 'Valuation unavailable', 'Open the valuation dashboard', PD.spxSite); }
}
function aqiLabel(aqi) {
  return aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Sensitive groups' : aqi <= 200 ? 'Unhealthy' : aqi <= 300 ? 'Very unhealthy' : 'Hazardous';
}
async function airCard(settings, locationResult) {
  if (!settings.airConsent) return emptyCard('air', 'AIR QUALITY', 'Enable air quality', 'Set location in Scriptable', setupUrl('air'));
  try {
    const result = await loadAir(settings, locationResult), d = result.value;
    return { key: 'air', title: 'AIR QUALITY', metric: String(Math.round(d.aqi)), label: 'US AQI · model',
      detail: `${aqiLabel(d.aqi)}${result.offline ? ' · cached' : result.locationCached && !result.manual ? ` · loc ${elapsed(result.locationAt)}` : ''}`, foot: `${shortDate(localDate(d.time))} ${clockText(d.time)}${result.offline ? ' · cache' : ''}`,
      attribution: 'CAMS / Open-Meteo', warning: result.offline || age(d.time) > 3 * PD.hour || (result.locationCached && !result.manual) || d.aqi > 100, url: PD.airSite };
  } catch { return emptyCard('air', 'AIR QUALITY', 'Air data unavailable', 'Open app to check location', setupUrl('air')); }
}
async function trainCard(settings, locationResult, preloaded, preloadedCoordinates) {
  if (!settings.autoLocation && !settings.origin) return emptyCard('train', 'LAST TRAIN', 'Nearest MRT → home', 'Enable location in Scriptable', setupUrl('train'));
  try {
    if (preloaded === null) throw new Error('Timetable unavailable');
    const result = preloaded || await loadTrainData(), data = result.value;
    const destination = resolveStation(settings.destination, data.stations);
    if (!destination) return emptyCard('train', 'LAST TRAIN', 'Set destination', 'Choose a valid home station', setupUrl('train'));
    let origin, nearest, locationLabel;
    if (settings.origin) { origin = resolveStation(settings.origin, data.stations); locationLabel = 'Saved origin'; }
    else {
      if (!locationResult.value) return emptyCard('train', 'LAST TRAIN', 'Location unavailable', 'Open app to update location', setupUrl('train'));
      if (preloadedCoordinates === null) throw new Error('Station coordinates unavailable');
      const coordinates = preloadedCoordinates || await loadStations();
      nearest = nearestStation(locationResult.value, coordinates.value.stations, data.stations);
      if (!nearest || nearest.distance > 5) return emptyCard('train', 'LAST TRAIN', 'No nearby MRT', 'Over 5 km from a mapped exit', mapsUrl(destination.name));
      origin = resolveStation(nearest.station.id, data.stations);
      locationLabel = `Location ${elapsed(locationResult.value.checkedAt)}${locationResult.cached ? ' · saved' : ''}`;
    }
    if (!origin) return emptyCard('train', 'LAST TRAIN', 'Origin unavailable', 'Choose an origin in the app', setupUrl('train'));
    if (origin.id === destination.id) return { key: 'train', title: 'LAST TRAIN', metric: destination.name, label: settings.origin ? 'Same origin & home station' : 'Home MRT is nearest', detail: 'Walk / get transit directions', foot: locationLabel, url: mapsUrl(destination.name) };
    const serviceDate = singaporeServiceDate();
    const years = Object.keys(data.holidays).map((d) => d.slice(0, 4));
    if (!years.includes(serviceDate.slice(0, 4)) || isoAge(data.date) > 180) return emptyCard('train', 'LAST TRAIN', 'Timetable too old', 'Check the train dashboard', PD.trainSite);
    const engine = makeTrainEngine(data);
    const journey = engine.calculateLastTrain({ originId: origin.id, destinationId: destination.id, date: serviceDate, bufferMinutes: settings.buffer }).recommended;
    if (!journey) return emptyCard('train', 'LAST TRAIN', 'No route available', `${origin.name} → ${destination.name}`, PD.trainSite);
    const departed = engine.hasDeparturePassed(serviceDate, journey.boardBy, new Date());
    const minute = ((journey.boardBy % 1440) + 1440) % 1440;
    const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    const stale = isoAge(data.date) > 45;
    return { key: 'train', title: 'LAST TRAIN', metric: departed && !stale ? 'Ended' : time,
      label: stale ? 'Historical estimate' : departed ? `Last board-by ${time} SGT` : `${journey.confidence !== 'exact' ? 'Est. ' : ''}board-by · SGT`,
      detail: `${locationResult.cached && !settings.origin ? 'Saved fix: ' : ''}${origin.name} → ${destination.name}`,
      foot: stale ? `${shortDate(data.date)} · verify` : `${shortDate(data.date)} · table`,
      extra: `${locationLabel} · station-to-station only`, warning: stale || result.offline || locationResult.cached || departed,
      url: PD.trainSite, maps: mapsUrl(destination.name), route: journey, locationLabel, sourceDate: data.date };
  } catch { return emptyCard('train', 'LAST TRAIN', 'Train data unavailable', 'Open the train dashboard', PD.trainSite); }
}
function chosenCards(family, parameter) {
  const p = String(parameter || '').trim().toLowerCase();
  const keys = ['sora', 'spx', 'train', 'air'];
  if (family === 'large' || family === 'extraLarge') return keys;
  if (family === 'small' || family.startsWith('accessory')) return [keys.includes(p) ? p : 'sora'];
  if (p === 'local') return ['train', 'air'];
  const chosen = [...new Set(p.split(',').map((x) => x.trim()).filter((x) => keys.includes(x)))];
  return chosen.length === 2 ? chosen : ['sora', 'spx'];
}
function widgetDimensions(family) {
  // Apple HIG point sizes. Unknown/new displays use a conservative 321pt grid.
  const screen = Device.screenSize(), width = Math.min(screen.width, screen.height), height = Math.max(screen.width, screen.height);
  const sizes = {
    '320x568': [141, 292, 311], '375x667': [148, 321, 324], '414x736': [159, 348, 357],
    '360x780': [155, 329, 345], '375x812': [155, 329, 345], '390x844': [158, 338, 354],
    '393x852': [158, 338, 354], '402x874': [162, 344, 366], '414x896': [169, 360, 379],
    '428x926': [170, 364, 382], '430x932': [170, 364, 382], '440x956': [174, 374, 394],
  };
  const [small, wide, tall] = sizes[`${width}x${height}`] || (width <= 360 ? [141, 292, 311] : [148, 321, 324]);
  return family === 'small' ? { width: small, height: small } : { width: wide, height: family === 'medium' ? small : tall };
}
function addText(stack, value, size, hex = COLORS.text, weight = 'medium', scale = 0.8) {
  const item = stack.addText(String(value));
  item.font = weight === 'bold' ? Font.boldRoundedSystemFont(size) : weight === 'semibold' ? Font.semiboldSystemFont(size) : Font.mediumSystemFont(size);
  item.textColor = color(hex); item.lineLimit = 1; item.minimumScaleFactor = scale;
  return item;
}
function fixedRow(parent, width, height) {
  const row = parent.addStack(); row.layoutHorizontally(); row.size = new Size(width, height); row.centerAlignContent(); return row;
}
function drawCard(parent, card, width, height, compact = false) {
  const stack = parent.addStack(); stack.layoutVertically(); stack.size = new Size(width, height);
  stack.backgroundColor = color(({ sora: '1D3636', spx: '24323F', train: '39362B', air: '2A3936' })[card.key] || COLORS.panel); stack.cornerRadius = 16;
  stack.borderColor = color(COLORS.panelBorder); stack.borderWidth = 0.5;
  const pad = width < 140 ? 9 : 11; stack.setPadding(pad, pad, pad, pad); stack.url = card.url;
  const inner = width - 2 * pad;
  const title = fixedRow(stack, inner, 14);
  const dot = title.addStack(); dot.size = new Size(4, 4); dot.cornerRadius = 2; dot.backgroundColor = color(COLORS[card.key]);
  title.addSpacer(5); addText(title, card.title, 10, COLORS.muted, 'semibold', 0.85);
  stack.addSpacer(compact || height < 140 ? 3 : 5);
  const hero = fixedRow(stack, inner, compact || height < 140 ? 30 : 38); hero.bottomAlignContent();
  const number = hero.addStack(); number.layoutHorizontally(); number.size = new Size(inner - (card.unit ? 20 : 0), compact || height < 140 ? 30 : 38); number.bottomAlignContent();
  addText(number, card.metric, card.metric.length > 7 ? 23 : compact || height < 140 ? 25 : 31, COLORS.text, 'bold', 0.7);
  if (card.unit) { hero.addSpacer(2); addText(hero, card.unit, 17, COLORS[card.key], 'semibold'); }
  stack.addSpacer(2);
  addText(stack, card.label, 11, COLORS[card.key], 'medium', 0.8);
  stack.addSpacer(3);
  addText(stack, card.detail, 10, COLORS.muted, 'medium', 0.75);
  stack.addSpacer();
  if (card.attribution) addText(stack, card.attribution, 8, COLORS.faint, 'medium', 0.8);
  if (card.key === 'train' && card.locationLabel) addText(stack, card.locationLabel, 9, COLORS.faint);
  addText(stack, card.foot, 9, card.warning ? COLORS.warning : COLORS.faint, 'medium', 0.8);
  return stack;
}
function buildWidget(cards, family) {
  const widget = new ListWidget(); widget.backgroundColor = color(COLORS.background);
  widget.url = cards[0]?.url || PD.site;
  if (family.startsWith('accessory')) {
    widget.setPadding(0, 0, 0, 0);
    const card = cards[0];
    const title = card.key === 'air' ? 'US AQI model' : card.key === 'train' && card.label === 'Historical estimate' ? 'Historical train' : card.title;
    if (family === 'accessoryInline') addText(widget, `${title} ${card.metric}${card.unit || ''} · ${card.foot}`, 12);
    else {
      addText(widget, title, 10);
      addText(widget, `${card.metric}${card.unit || ''}`, 20, COLORS.text, 'bold');
      addText(widget, family === 'accessoryCircular' ? card.foot : `${card.label} · ${card.foot}`, family === 'accessoryCircular' ? 8 : 10);
    }
    return widget;
  }
  const dimension = widgetDimensions(family), pad = family === 'small' ? 8 : 12;
  widget.setPadding(pad, pad, pad, pad);
  const width = dimension.width - 2 * pad;
  if (family === 'small') drawCard(widget, cards[0], width, dimension.height - 2 * pad, true);
  else if (family === 'medium') {
    const row = fixedRow(widget, width, dimension.height - 2 * pad), cardWidth = (width - 8) / 2;
    drawCard(row, cards[0], cardWidth, dimension.height - 2 * pad, true); row.addSpacer(8);
    drawCard(row, cards[1], cardWidth, dimension.height - 2 * pad, true);
  } else {
    const header = fixedRow(widget, width, 16);
    addText(header, 'POCKET DESK', 10, COLORS.muted, 'semibold'); header.addSpacer();
    addText(header, `${clockText(now())} snapshot`, 9, COLORS.faint);
    widget.addSpacer(8);
    const cardWidth = (width - 8) / 2, cardHeight = Math.floor((dimension.height - 2 * pad - 16 - 8 - 8) / 2);
    for (let rowIndex = 0; rowIndex < 2; rowIndex++) {
      const row = fixedRow(widget, width, cardHeight);
      drawCard(row, cards[rowIndex * 2], cardWidth, cardHeight); row.addSpacer(8);
      drawCard(row, cards[rowIndex * 2 + 1], cardWidth, cardHeight);
      if (!rowIndex) widget.addSpacer(8);
    }
  }
  return widget;
}
async function alertMessage(title, message) {
  const a = new Alert(); a.title = title; a.message = message; a.addAction('OK'); await a.presentAlert();
}
async function enableLocation(settings, clearOrigin = true) {
  const a = new Alert(); a.title = 'Use your location?';
  a.message = 'Find the closest mapped MRT exit on your device and plan the last train to your saved home station. iOS may limit widget location updates. Your saved fallback location stays on this device. Air quality has a separate sharing choice.';
  a.addAction('Enable automatic location'); a.addCancelAction('Cancel');
  if (await a.presentAlert() < 0) return false;
  settings.autoLocation = true; if (clearOrigin) settings.origin = ''; saveSettings(settings);
  const result = await currentLocation(settings);
  if (!result.value) await alertMessage('Location unavailable', 'Allow location for Scriptable in iPhone Settings, then run this setup again. You can also choose a station manually.');
  return Boolean(result.value);
}
async function setupTrain(settings) {
  const a = new Alert(); a.title = 'Last train home'; a.message = 'Default destination: Lakeside. Board-by is a timetable planning estimate, not live departures or walking directions.';
  a.addAction('Use nearest MRT automatically'); a.addAction('Set stations manually'); a.addAction('Open transit directions to home'); a.addCancelAction('Cancel');
  const choice = await a.presentSheet();
  if (choice === 0) await enableLocation(settings);
  else if (choice === 1) {
    let source;
    try { source = await loadTrainData(); } catch { await alertMessage('Stations unavailable', 'Connect to the internet and try again.'); return; }
    const b = new Alert(); b.title = 'Set your stations'; b.message = 'Use a full station name or code, such as EW26. Blank origin uses automatic location if enabled. Stored only on your device.';
    b.addTextField('Origin station', settings.origin); b.addTextField('Home station', settings.destination);
    b.addTextField('Transfer buffer, 0–15 min', String(settings.buffer)); b.addAction('Save'); b.addCancelAction('Cancel');
    if (await b.presentAlert() < 0) return;
    const input = b.textFieldValue(0).trim(), origin = input ? resolveStation(input, source.value.stations) : null;
    const destination = resolveStation(b.textFieldValue(1), source.value.stations), buffer = Number(b.textFieldValue(2));
    if ((input && !origin) || !destination || !Number.isInteger(buffer) || buffer < 0 || buffer > 15) { await alertMessage('Check station details', 'Choose valid full station names/codes and a whole-number buffer from 0 to 15. Nothing was changed.'); return; }
    settings.origin = origin?.id || ''; settings.destination = destination.id; settings.buffer = buffer; saveSettings(settings);
  } else if (choice === 2) {
    let name = 'Lakeside';
    try { name = resolveStation(settings.destination, (await loadTrainData()).value.stations)?.name || name; } catch { /* use default public station */ }
    Safari.open(mapsUrl(name));
  }
}
async function setupAir(settings) {
  const a = new Alert(); a.title = 'Air quality location';
  a.message = 'CAMS / Open-Meteo provides modelled US AQI, not Singapore PSI or a local sensor. To fetch it, your location rounded to 2 decimals (about 1 km) is sent to Open-Meteo. Your exact coordinates stay on this device.';
  a.addAction('Allow approximate current location'); a.addAction('Use coordinates I enter'); a.addAction('Turn off air quality'); a.addCancelAction('Cancel');
  const choice = await a.presentSheet();
  if (choice === 0) {
    if (!settings.autoLocation && !await enableLocation(settings, false)) return;
    settings.airConsent = true; settings.airMode = 'auto'; saveSettings(settings);
  } else if (choice === 1) {
    const b = new Alert(); b.title = 'Saved air-quality place'; b.message = 'These coordinates, rounded to 2 decimals, will be sent to Open-Meteo for US AQI. They are stored on this device.';
    b.addTextField('Latitude (−90 to 90)', settings.airLocation ? String(settings.airLocation.latitude) : '');
    b.addTextField('Longitude (−180 to 180)', settings.airLocation ? String(settings.airLocation.longitude) : '');
    b.addAction('Save and allow'); b.addCancelAction('Cancel');
    if (await b.presentAlert() < 0) return;
    const lat = b.textFieldValue(0).trim(), lon = b.textFieldValue(1).trim();
    const loc = { latitude: Number(lat), longitude: Number(lon), checkedAt: now() };
    if (!lat || !lon || !validLocation(loc)) { await alertMessage('Invalid coordinates', 'Enter valid decimal latitude and longitude. Nothing was changed.'); return; }
    settings.airConsent = true; settings.airMode = 'manual'; settings.airLocation = loc; saveSettings(settings);
  } else if (choice === 2) { settings.airConsent = false; settings.airLocation = null; saveSettings(settings); }
}
async function menu(settings) {
  const a = new Alert(); a.title = 'Pocket Desk'; a.message = 'Four quiet cards. Local setup. Source dates on every snapshot.';
  ['Preview large', 'Preview medium', 'Preview small', 'Set up last train', 'Set up air quality', 'Location & data notes', 'Turn off automatic location'].forEach((x) => a.addAction(x));
  a.addCancelAction('Done');
  const choice = await a.presentSheet();
  if (choice < 0) return null;
  if (choice < 3) return ['large', 'medium', 'small'][choice];
  if (choice === 3) await setupTrain(settings);
  if (choice === 4) await setupAir(settings);
  if (choice === 5) await alertMessage('Snapshot, not a live feed', 'iOS decides refresh timing. Each card shows its own data time. Automatic location may fall back to a saved fix for up to 6 hours, clearly marked. MRT is selected by straight-line distance to a mapped exit; walking access can differ. Station exits: LTA / data.gov.sg, Singapore Open Data Licence: https://data.gov.sg/open-data-licence. Last-train tables older than 45 days are flagged; after 180 days no time is shown. Check operator notices. AQI is CAMS model data via Open-Meteo, with an approximate location sent only after you allow it. Small widgets have one tap target.');
  if (choice === 6) { settings.autoLocation = false; settings.location = null; saveSettings(settings); }
  return 'large';
}
async function run() {
  const settings = readSettings();
  let family = config.widgetFamily || 'large';
  if (!config.runsInWidget && !config.runsInAccessoryWidget) {
    const action = args.queryParameters?.setup;
    if (action === 'train') { await setupTrain(settings); family = 'large'; }
    else if (action === 'air') { await setupAir(settings); family = 'large'; }
    else family = await menu(settings);
    if (!family) { Script.complete(); return; }
  }
  const keys = chosenCards(family, args.widgetParameter);
  const needsLocation = keys.includes('train') && !settings.origin || keys.includes('air') && settings.airConsent && settings.airMode === 'auto';
  const locationPromise = needsLocation ? currentLocation(settings) : Promise.resolve({ value: settings.location, cached: true });
  const loaders = {
    sora: soraCard, spx: spxCard,
    train: async () => {
      const [location, data, coordinates] = await Promise.all([
        locationPromise, settings.autoLocation || settings.origin ? loadTrainData().catch(() => null) : Promise.resolve(null),
        settings.autoLocation && !settings.origin ? loadStations().catch(() => null) : Promise.resolve(undefined),
      ]);
      return trainCard(settings, location, data, coordinates);
    },
    air: async () => airCard(settings, await locationPromise),
  };
  const cards = await Promise.all(keys.map((key) => loaders[key]()));
  const widget = buildWidget(cards, family);
  widget.refreshAfterDate = new Date(now() + (keys.includes('train') || keys.includes('air') ? 20 * 60000 : 3 * PD.hour));
  if (config.runsInWidget || config.runsInAccessoryWidget) Script.setWidget(widget);
  else if (family === 'small') await widget.presentSmall();
  else if (family === 'medium') await widget.presentMedium();
  else await widget.presentLarge();
  Script.complete();
}

// The routing engine below reuses SG Last Train Home's graph, timetable, and
// backward scheduling implementation. Only the module wiring is adapted; source
// data remains fetched and validated separately. Upstream: https://github.com/kush0511/sg-last-train-home
// BEGIN ROUTING ENGINE

function makeTrainEngine(data) {
const STATION_BY_ID = new Map(data.stations.map(s => [s.id, s]));
const STATION_ID_BY_CODE = new Map(data.stations.flatMap(s => s.codes.map(c => [c, s.id])));
const SERVICE_PATTERNS = data.patterns;
const PATTERN_BY_ID = new Map(data.patterns.map(p => [p.id, p]));
const PUBLISHED_LAST_DEPARTURES = data.published;
const PUBLISHED_TIMETABLE_SOURCE_BY_PATTERN = {};
const TRANSFER_RULES = data.rules;
const PUBLIC_HOLIDAYS = data.holidays;
const SOURCE_BY_ID = new Map(data.patterns.map(p => [p.sourceId, {}]));
const DTL_LATE_OPEN_DATES = [];
const adjustmentsForDate = date => data.adjustments.filter(a => a.dates.includes(date));

// Adapted from lib/time.ts
const SERVICE_DAY_CUTOFF_HOUR = 4;











function addDaysIso(date        , days        )         {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return [
    utc.getUTCFullYear(),
    String(utc.getUTCMonth() + 1).padStart(2, "0"),
    String(utc.getUTCDate()).padStart(2, "0")
  ].join("-");
}



function singaporeClockParts(now = new Date())   
               
               
                 
  {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}

function hasDeparturePassed(
  serviceDate        ,
  boardBy        ,
  now = new Date()
)          {
  const current = singaporeClockParts(now);
  const clockMinutes = current.hour * 60 + current.minute;
  if (serviceDate > current.date) return false;
  if (serviceDate === current.date) return boardBy <= clockMinutes;
  if (serviceDate === addDaysIso(current.date, -1) && current.hour < SERVICE_DAY_CUTOFF_HOUR) {
    return boardBy <= 24 * 60 + clockMinutes;
  }
  return true;
}


// Adapted from lib/calendar.ts

function getServiceDay(date        )             {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    !date.match(/^\d{4}-\d{2}-\d{2}$/) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid service date: ${date}`);
  }

  const publicHoliday = PUBLIC_HOLIDAYS[date];
  const weekday = parsed.getUTCDay();
  const dayType = publicHoliday
    ? "sunday-public-holiday"
    : weekday === 0
      ? "sunday-public-holiday"
      : weekday === 6
        ? "saturday"
        : "weekday";

  return {
    date,
    dayType,
    publicHoliday,
    isPublicHolidayEve: Boolean(PUBLIC_HOLIDAYS[addDaysIso(date, 1)])
  };
}

/**
 * Operator public-holiday-eve tables take precedence over the ordinary day of
 * week, but only when that table has a published value for the service.
 */
function timetableCategoryForDate(date        )                    {
  const serviceDay = getServiceDay(date);
  return serviceDay.isPublicHolidayEve ? "public-holiday-eve" : serviceDay.dayType;
}


// Adapted from data/transfers.ts
function codePrefix(code        , pattern                )         {
  if (pattern.lineId === "CG") return "CG";
  if (code === "STC" || code.startsWith("SE") || code.startsWith("SW")) return "STC";
  if (code === "PTC" || code.startsWith("PE") || code.startsWith("PW")) return "PTC";
  return code.match(/^[A-Z]+/)?.[0] ?? code;
}

                          
                      
                   
                             
                       
                    
 

function lookupTransfer(
  stationIdValue        ,
  fromCode        ,
  toCode        ,
  fromPattern                ,
  toPattern                
)                 {
  if (fromPattern.lineId === toPattern.lineId) {
    return {
      walkMinutes: 0,
      sourceId: "same-line-pattern-change",
      directionSpecific: false,
      outOfSystem: false,
      fallback: false
    };
  }

  const from = codePrefix(fromCode, fromPattern);
  const to = codePrefix(toCode, toPattern);
  const match = TRANSFER_RULES.find(
    (candidate) =>
      candidate.stationId === stationIdValue &&
      candidate.fromCodePrefix === from &&
      candidate.toCodePrefix === to
  );

  if (match) {
    return {
      walkMinutes: match.walkMinutes,
      sourceId: match.sourceId,
      directionSpecific: match.directionSpecific,
      outOfSystem: Boolean(match.outOfSystem),
      fallback: false
    };
  }

  return {
    walkMinutes: 6,
    sourceId: "fallback-transfer-model",
    directionSpecific: false,
    outOfSystem: false,
    fallback: true
  };
}


// Adapted from lib/graph.ts
                       
                    
                           
                     
                           
                       
                           
               
 

function allowsSameLinePatternChange(fromPatternId        , toPatternId        )          {
  const pair = `${fromPatternId}>${toPatternId}`;
  return (
    (pair.includes("CC_SPUR_") && pair.includes("CC_LOOP_")) ||
    (pair.includes("CC_LOOP_") && pair.includes("CC_SPUR_")) ||
    (pair.includes("BP_TRUNK_") && pair.includes("BP_LOOP_")) ||
    (pair.includes("BP_LOOP_") && pair.includes("BP_TRUNK_"))
  );
}

function activePatternIds(date        )              {
  const disabled = new Set(
    adjustmentsForDate(date).flatMap((adjustment) => adjustment.disabledPatternIds ?? [])
  );
  return new Set(
    SERVICE_PATTERNS.filter((pattern) => !disabled.has(pattern.id)).map((pattern) => pattern.id)
  );
}

function buildAdjacency(
  date        ,
  allowedPatternIds                      
)                           {
  const active = activePatternIds(date);
  const adjacency = new Map                     ();

  for (const pattern of SERVICE_PATTERNS) {
    if (!active.has(pattern.id) || (allowedPatternIds && !allowedPatternIds.has(pattern.id))) {
      continue;
    }
    const edgeCount = pattern.circular ? pattern.stops.length : pattern.stops.length - 1;
    for (let index = 0; index < edgeCount; index += 1) {
      const fromCode = pattern.stops[index];
      const toCode = pattern.stops[(index + 1) % pattern.stops.length];
      const fromStationId = STATION_ID_BY_CODE.get(fromCode);
      const toStationId = STATION_ID_BY_CODE.get(toCode);
      if (!fromStationId || !toStationId) {
        throw new Error(`Pattern ${pattern.id} refers to an unknown stop`);
      }
      const edge            = {
        fromStationId,
        toStationId,
        fromCode,
        toCode,
        patternId: pattern.id,
        minutes: pattern.segmentMinutes[index]
      };
      const outgoing = adjacency.get(fromStationId) ?? [];
      outgoing.push(edge);
      adjacency.set(fromStationId, outgoing);
    }
  }

  return adjacency;
}

function compressRides(edges             )            {
  const rides            = [];
  for (const edge of edges) {
    const current = rides.at(-1);
    if (current?.patternId === edge.patternId) {
      current.toStationId = edge.toStationId;
      current.toCode = edge.toCode;
      current.stopCodes.push(edge.toCode);
      current.rideMinutes += edge.minutes;
    } else {
      rides.push({
        patternId: edge.patternId,
        fromStationId: edge.fromStationId,
        toStationId: edge.toStationId,
        fromCode: edge.fromCode,
        toCode: edge.toCode,
        stopCodes: [edge.fromCode, edge.toCode],
        rideMinutes: edge.minutes
      });
    }
  }
  return rides;
}

function routeSignature(rides           )         {
  return rides
    .map((ride) => `${ride.patternId}:${ride.fromCode}>${ride.toCode}`)
    .join("|");
}

function findRouteCandidates(
  originStationId        ,
  destinationStationId        ,
  date        ,
  bufferMinutes        ,
  limit = 32,
  allowedPatternIds                      
)                   {
  if (originStationId === destinationStationId) return [];
  const adjacency = buildAdjacency(date, allowedPatternIds);
  const queue                = [
    {
      stationId: originStationId,
      patternId: null,
      edges: [],
      transfers: [],
      visited: new Set([originStationId]),
      usedLineIds: new Set(),
      cost: 0
    }
  ];
  const candidates                   = [];
  const signatures = new Set        ();
  const best = new Map                ();
  let expanded = 0;
  let shortestCandidateCost = Number.POSITIVE_INFINITY;

  while (queue.length && candidates.length < limit && expanded < 20_000) {
    queue.sort((a, b) => a.cost - b.cost);
    const state = queue.shift() ;
    expanded += 1;
    if (
      candidates.length >= 12 &&
      Number.isFinite(shortestCandidateCost) &&
      state.cost > shortestCandidateCost + 45
    ) {
      break;
    }

    if (state.stationId === destinationStationId) {
      const rides = compressRides(state.edges);
      const signature = routeSignature(rides);
      if (!signatures.has(signature)) {
        signatures.add(signature);
        candidates.push({
          signature,
          rides,
          transfers: state.transfers,
          totalRideMinutes: rides.reduce((sum, ride) => sum + ride.rideMinutes, 0),
          totalTransferMinutes: state.transfers.reduce(
            (sum, transfer) => sum + transfer.walkMinutes + transfer.bufferMinutes,
            0
          )
        });
        shortestCandidateCost = Math.min(shortestCandidateCost, state.cost);
      }
      continue;
    }

    for (const edge of adjacency.get(state.stationId) ?? []) {
      if (state.visited.has(edge.toStationId)) continue;
      const changesPattern = state.patternId !== null && state.patternId !== edge.patternId;
      if (changesPattern && state.transfers.length >= 4) continue;

      let transfer                         ;
      let transferCost = 0;
      if (changesPattern) {
        const previousEdge = state.edges.at(-1) ;
        const previousPattern = PATTERN_BY_ID.get(previousEdge.patternId) ;
        const nextPattern = PATTERN_BY_ID.get(edge.patternId) ;
        if (
          previousPattern.lineId === nextPattern.lineId &&
          !allowsSameLinePatternChange(previousPattern.id, nextPattern.id)
        ) {
          continue;
        }
        if (
          previousPattern.lineId !== nextPattern.lineId &&
          state.usedLineIds.has(nextPattern.lineId)
        ) {
          continue;
        }
        const lookup = lookupTransfer(
          state.stationId,
          previousEdge.toCode,
          edge.fromCode,
          previousPattern,
          nextPattern
        );
        transfer = {
          stationId: state.stationId,
          fromPatternId: previousPattern.id,
          toPatternId: nextPattern.id,
          walkMinutes: lookup.walkMinutes,
          bufferMinutes,
          sourceId: lookup.sourceId,
          directionSpecific: lookup.directionSpecific,
          outOfSystem: lookup.outOfSystem
        };
        transferCost = lookup.walkMinutes + bufferMinutes + (lookup.outOfSystem ? 4 : 0);
      }

      const newTransfers = transfer ? [...state.transfers, transfer] : state.transfers;
      const edgeLineId = PATTERN_BY_ID.get(edge.patternId) .lineId;
      const newUsedLineIds = new Set(state.usedLineIds);
      newUsedLineIds.add(edgeLineId);
      const newCost = state.cost + edge.minutes + transferCost;
      const key = `${edge.toStationId}|${edge.patternId}|${newTransfers.length}`;
      const previousBest = best.get(key);
      if (previousBest != null && newCost > previousBest + 18) continue;
      if (previousBest == null || newCost < previousBest) best.set(key, newCost);

      queue.push({
        stationId: edge.toStationId,
        patternId: edge.patternId,
        edges: [...state.edges, edge],
        transfers: newTransfers,
        visited: new Set([...state.visited, edge.toStationId]),
        usedLineIds: newUsedLineIds,
        cost: newCost
      });
    }
  }

  return candidates;
}


// Adapted from lib/schedule.ts
                         
                
                         
                   
               
 

function cumulativeMinutes(pattern                , code        )         {
  const index = pattern.stops.indexOf(code);
  if (index < 0) throw new Error(`${code} is not served by ${pattern.id}`);
  return pattern.segmentMinutes.slice(0, index).reduce((sum, value) => sum + value, 0);
}

function remainingMinutes(pattern                , code        )         {
  const index = pattern.stops.indexOf(code);
  if (index < 0) throw new Error(`${code} is not served by ${pattern.id}`);
  if (pattern.circular) return 0;
  return pattern.segmentMinutes.slice(index).reduce((sum, value) => sum + value, 0);
}

function lastDepartureFor(
  pattern                ,
  code        ,
  date        
)                {
  let value        ;
  let confidence            ;
  let note        ;
  const category = timetableCategoryForDate(date);
  const ordinaryCategory = getServiceDay(date).dayType;
  const publishedForCategory =
    PUBLISHED_LAST_DEPARTURES[pattern.id]?.[category]?.[code] ??
    PUBLISHED_LAST_DEPARTURES[pattern.id]?.[ordinaryCategory]?.[code];

  if (publishedForCategory != null) {
    value = publishedForCategory;
    confidence = "exact";
    note = `Operator-published ${
      PUBLISHED_LAST_DEPARTURES[pattern.id]?.[category]?.[code] != null
        ? category.replaceAll("-", " ")
        : ordinaryCategory.replaceAll("-", " ")
    } station cutoff`;
  } else if (pattern.exactLastByStop?.[code] != null) {
    value = pattern.exactLastByStop[code];
    confidence = "exact";
    note = "Operator-published station cutoff";
  } else if (pattern.estimatedOriginLast != null) {
    value = pattern.estimatedOriginLast + cumulativeMinutes(pattern, code);
    confidence = "estimated";
    note = "Conservative service-horizon estimate";
  } else {
    throw new Error(`No last-departure data for ${pattern.id} at ${code}`);
  }

  for (const adjustment of adjustmentsForDate(date)) {
    const anchor = adjustment.anchorOverrides?.[pattern.id];
    if (anchor) {
      const anchorOffset = cumulativeMinutes(pattern, anchor.code);
      value = anchor.lastDeparture + cumulativeMinutes(pattern, code) - anchorOffset;
      confidence = code === anchor.code ? "exact" : "estimated";
      note =
        code === anchor.code
          ? "Published special-service departure anchor"
          : "Estimate propagated from a published special-service anchor";
    }
    if (adjustment.affectedLine === pattern.lineId && adjustment.closeBy != null) {
      value = Math.min(value, adjustment.closeBy - remainingMinutes(pattern, code));
      confidence = "estimated";
      note = "Conservative station estimate for an announced early line closure";
    }
  }

  return {
    value,
    confidence,
    sourceId:
      publishedForCategory != null
        ? (PUBLISHED_TIMETABLE_SOURCE_BY_PATTERN[pattern.id] ?? pattern.sourceId)
        : pattern.sourceId,
    note
  };
}


// Adapted from lib/routing.ts
function scheduleRouteCandidate(
  route                ,
  originId        ,
  destinationId        ,
  date        
)                       {
  const scheduled = new Array               (route.rides.length);
  const evidence                     = [];
  const warnings = new Set        ();
  let nextDeparture = Number.POSITIVE_INFINITY;

  for (let index = route.rides.length - 1; index >= 0; index -= 1) {
    const ride = route.rides[index];
    const pattern = PATTERN_BY_ID.get(ride.patternId);
    if (!pattern) throw new Error(`Unknown pattern: ${ride.patternId}`);
    const last = lastDepartureFor(pattern, ride.fromCode, date);
    let departure = last.value;
    let steppedBackByMinutes = 0;

    if (Number.isFinite(nextDeparture)) {
      const transfer = route.transfers[index];
      if (!transfer) return null;
      const latestArrival =
        nextDeparture - transfer.walkMinutes - transfer.bufferMinutes;
      const departureCap = latestArrival - ride.rideMinutes;
      if (departure > departureCap) {
        const intervals = Math.ceil(
          (departure - departureCap) / pattern.lateHeadwayMinutes
        );
        steppedBackByMinutes = intervals * pattern.lateHeadwayMinutes;
        departure -= steppedBackByMinutes;
        warnings.add(
          `${pattern.label}: stepped back ${steppedBackByMinutes} min using a conservative ${pattern.lateHeadwayMinutes}-min late headway.`
        );
      }
    }

    const arrival = departure + ride.rideMinutes;
    if (departure < 5 * 60 || arrival > 29 * 60) return null;

    const rideConfidence             =
      last.confidence === "exact" && steppedBackByMinutes === 0 ? "exact" : "estimated";
    scheduled[index] = {
      ...ride,
      departure,
      arrival,
      publishedLastDeparture: last.value,
      steppedBackByMinutes,
      confidence: rideConfidence,
      scheduleNote: last.note
    };
    evidence.push({
      sourceId: last.sourceId,
      statement: `${pattern.label} towards ${pattern.destination}: ${last.note.toLowerCase()}.`,
      confidence: rideConfidence
    });
    nextDeparture = departure;
  }

  for (const transfer of route.transfers) {
    const station = STATION_BY_ID.get(transfer.stationId) ;
    if (SOURCE_BY_ID.has(transfer.sourceId)) {
      evidence.push({
        sourceId: transfer.sourceId,
        statement: `${station.name}: ${transfer.walkMinutes}-minute interchange walking estimate.`,
        confidence: "estimated"
      });
    }
    if (transfer.sourceId === "fallback-transfer-model") {
      warnings.add(
        `${station.name}: no direction-specific interchange measurement; using a conservative 6-min walk.`
      );
    } else if (transfer.directionSpecific) {
      warnings.add(
        `${station.name}: ${transfer.walkMinutes}-min direction-specific walking estimate, plus your buffer.`
      );
    }
    if (transfer.outOfSystem) {
      warnings.add(
        `${station.name}: this interchange may require tapping out and back in; allow extra time and check fare-gate access.`
      );
    }
  }

  for (const adjustment of adjustmentsForDate(date)) {
    const usedPatterns = new Set(route.rides.map((ride) => ride.patternId));
    const affectsRoute =
      adjustment.affectedLine === "multiple"
        ? Object.keys(adjustment.anchorOverrides ?? {}).some((id) => usedPatterns.has(id))
        : route.rides.some(
            (ride) => PATTERN_BY_ID.get(ride.patternId)?.lineId === adjustment.affectedLine
          );
    if (affectsRoute) warnings.add(adjustment.note);
  }

  const exact =
    scheduled.length === 1 &&
    scheduled[0].confidence === "exact" &&
    route.transfers.length === 0;
  if (!exact) {
    warnings.add(
      "This is a cautious planning estimate, not a guaranteed connection. Arrive earlier when the trip matters."
    );
  }

  const origin = STATION_BY_ID.get(originId);
  const destination = STATION_BY_ID.get(destinationId);
  if (!origin || !destination) return null;

  const uniqueEvidence = [...new Map(evidence.map((item) => [item.sourceId, item])).values()];
  for (const item of uniqueEvidence) {
    if (!SOURCE_BY_ID.has(item.sourceId) && !item.sourceId.startsWith("model-")) {
      warnings.add(`Source metadata is incomplete for ${item.sourceId}.`);
    }
  }

  return {
    origin,
    destination,
    serviceDay: getServiceDay(date),
    boardBy: scheduled[0].departure,
    arriveBy: scheduled.at(-1) .arrival,
    confidence: exact ? "exact" : "estimated",
    confidenceLabel: exact
      ? "Exact last scheduled train"
      : "Estimated safe board-by time",
    rides: scheduled,
    transfers: route.transfers,
    warnings: [...warnings],
    evidence: uniqueEvidence,
    totalRideMinutes: route.totalRideMinutes,
    totalTransferMinutes: route.totalTransferMinutes,
    signature: route.signature
  };
}

function compareResults(a               , b               )         {
  const departureDifference = b.boardBy - a.boardBy;
  if (Math.abs(departureDifference) > 2) return departureDifference;
  if (a.transfers.length !== b.transfers.length) {
    return a.transfers.length - b.transfers.length;
  }
  const aDuration = a.arriveBy - a.boardBy;
  const bDuration = b.arriveBy - b.boardBy;
  if (aDuration !== bDuration) return aDuration - bDuration;
  if (a.confidence !== b.confidence) return a.confidence === "exact" ? -1 : 1;
  return 0;
}

                            
                   
                        
               
                         
                                            
 

function calculateLastTrain({
  originId,
  destinationId,
  date,
  bufferMinutes = 3,
  availablePatternIds
}                  )                    {
  if (!STATION_BY_ID.has(originId) || !STATION_BY_ID.has(destinationId)) {
    return {
      recommended: null,
      alternatives: [],
      notices: [],
      error: "Choose a valid origin and destination station."
    };
  }
  if (originId === destinationId) {
    return {
      recommended: null,
      alternatives: [],
      notices: [],
      error: "Origin and destination must be different stations."
    };
  }
  if (!Number.isInteger(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > 15) {
    return {
      recommended: null,
      alternatives: [],
      notices: [],
      error: "Connection buffer must be a whole number from 0 to 15 minutes."
    };
  }

  let serviceDay;
  try {
    serviceDay = getServiceDay(date);
  } catch (error) {
    return {
      recommended: null,
      alternatives: [],
      notices: [],
      error: error instanceof Error ? error.message : "Invalid service date."
    };
  }

  const routes = findRouteCandidates(
    originId,
    destinationId,
    date,
    bufferMinutes,
    32,
    availablePatternIds
  );
  const shortestRouteMinutes = Math.min(
    ...routes.map((route) => route.totalRideMinutes + route.totalTransferMinutes)
  );
  const detourAllowance = Math.max(20, Math.ceil(shortestRouteMinutes * 0.35));
  const plausibleRoutes = routes.filter(
    (route) =>
      route.totalRideMinutes + route.totalTransferMinutes <=
      shortestRouteMinutes + detourAllowance
  );
  const scheduled = plausibleRoutes
    .map((route) => scheduleRouteCandidate(route, originId, destinationId, date))
    .filter((result)                          => result !== null)
    .sort(compareResults);

  const deduplicated                  = [];
  const seenLineJourneys = new Set        ();
  for (const result of scheduled) {
    const lineJourney = result.rides.map((ride) => ride.patternId).join(">");
    if (seenLineJourneys.has(lineJourney)) continue;
    seenLineJourneys.add(lineJourney);
    deduplicated.push(result);
  }

  const notices = adjustmentsForDate(date).map((adjustment) => adjustment.note);
  if (DTL_LATE_OPEN_DATES.includes(date)) {
    notices.push(
      "Downtown Line service starts at about 8:30 AM today. This does not normally change last-train times, but it is shown for service-day completeness."
    );
  }
  if (serviceDay.publicHoliday) {
    notices.push(`${serviceDay.publicHoliday}: Sunday/public-holiday service day.`);
  } else if (serviceDay.isPublicHolidayEve) {
    notices.push("Public-holiday eve. Only explicitly published extensions are applied.");
  }

  return {
    recommended: deduplicated[0] ?? null,
    alternatives: deduplicated.slice(1, 3),
    notices,
    error: deduplicated.length
      ? undefined
      : "No through journey was found in the active service graph. Try an earlier trip or another destination."
  };
}


return { calculateLastTrain, hasDeparturePassed };
}
// END ROUTING ENGINE

/*
MIT License

Copyright (c) 2026 Kushal

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

await run();
