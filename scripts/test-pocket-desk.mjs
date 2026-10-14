// Offline deterministic integration tests and render-tree/layout budgets.
// node scripts/test-pocket-desk.mjs [--capture=/tmp/pocket-desk-render-trees.json]
// These validate Scriptable API usage and point geometry, not iOS pixel rendering.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(resolve(root, 'public/scriptable/pocket-desk.js'), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const NOW = Date.parse('2026-10-14T10:00:00Z');
const DAY = 86400000, HOUR = 3600000;
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const trainData = json(resolve(root, 'scripts/fixtures/pocket-train.json'));
const index = { schemaVersion: 1, datasetVersion: '2026.07.29' };
const envelope = (payload) => ({ schemaVersion: 1, datasetVersion: index.datasetVersion, networkAsOf: trainData.date, payload });
const network = envelope({ stations: trainData.stations });
const timetable = envelope({ patterns: trainData.patterns, publishedLastDepartures: trainData.published, adjustments: trainData.adjustments });
const transfers = envelope({ rules: trainData.rules });
const holidays = { holidays: trainData.holidays };
const coordinates = json(resolve(root, 'public/data/sg-station-coordinates.json'));
const farrer = coordinates.stations.find((s) => s.id === 'farrer-park').exits[0];
const lakeside = coordinates.stations.find((s) => s.id === 'lakeside').exits[0];
const soraCsv = '\ufeffDate,SORA,1M,3M\n"13/10/2026","1.0846","1.2894","1.2366"\n12/10/2026,1.2026,1.2900,1.2400\n';
const fixtures = {
  'pub?output=csv': soraCsv,
  'valuation-data.json': { rows: [{ date: '2026-10-12', spx: 7807.24, eps: 406.12, pe: 19.22 }] },
  'data/index.json': index,
  [`network.v${index.datasetVersion}.json`]: network,
  [`timetables.v${index.datasetVersion}.json`]: timetable,
  [`transfers.v${index.datasetVersion}.json`]: transfers,
  'public-holidays.json': holidays,
  'sg-station-coordinates.json': coordinates,
  'air-quality?': { current: { us_aqi: 42, pm2_5: 8.4, time: (NOW - 15 * 60000) / 1000 } },
};

function runtime({ family = 'large', parameter = '', width = 390, height = 844, files = new Map(), offline = false, failure = '', location = farrer, locationError = false, app = false, choices = [], fixtureOverrides = {}, mockTime = NOW, timezoneOffset = 0 } = {}) {
  const requests = [], texts = [], drawnTexts = [], alerts = []; let result, locationCalls = 0, completed = false;
  const settingsPath = '/docs/pocket-desk/settings.json';
  class Stack {
    constructor(kind = 'stack') { this.kind = kind; this.children = []; this.axis = 'horizontal'; this.padding = [0, 0, 0, 0]; }
    addText(text) { const item = { kind: 'text', text: String(text), centerAlignText() {} }; this.children.push(item); texts.push(item); return item; }
    addStack() { const child = new Stack(); this.children.push(child); return child; }
    addImage(image) { const child = { kind: 'image', image }; this.children.push(child); return child; }
    addSpacer(length) { this.children.push({ kind: 'spacer', length }); }
    setPadding(...padding) { assert.equal(padding.length, 4); this.padding = padding; }
    layoutVertically() { this.axis = 'vertical'; }
    layoutHorizontally() { this.axis = 'horizontal'; }
    centerAlignContent() {}
    bottomAlignContent() {}
  }
  const setResult = (widget) => { result = widget; };
  class ListWidget extends Stack {
    constructor() { super('widget'); this.axis = 'vertical'; }
    async presentSmall() { setResult(this); }
    async presentMedium() { setResult(this); }
    async presentLarge() { setResult(this); }
  }
  class Request {
    constructor(url) { this.url = url; requests.push(url); this.response = { statusCode: 200 }; }
    async value() {
      if (offline || failure && this.url.includes(failure)) throw new Error('Offline');
      const values = { ...fixtures, ...fixtureOverrides };
      const match = Object.keys(values).find((key) => this.url.includes(key));
      assert.ok(match, `Unmocked external request ${this.url}`);
      return structuredClone(values[match]);
    }
    async loadJSON() { return this.value(); }
    async loadString() { return this.value(); }
  }
  class Alert {
    constructor() { this.actions = []; this.fields = []; alerts.push(this); }
    addAction(action) { this.actions.push(action); }
    addCancelAction(action) { this.cancel = action; }
    addTextField(_, value) { this.fields.push(value); }
    textFieldValue(index) { return this.fields[index]; }
    async presentSheet() { return choices.length ? choices.shift() : -1; }
    async presentAlert() { return choices.length ? choices.shift() : -1; }
  }
  class Point { constructor(x, y) { assert.ok(Number.isFinite(x) && Number.isFinite(y)); this.x = x; this.y = y; } }
  class Rect extends Point { constructor(x, y, width, height) { super(x, y); assert.ok(Number.isFinite(width) && Number.isFinite(height) && width >= 0 && height >= 0); this.width = width; this.height = height; } }
  class Path {
    constructor() { this.commands = []; }
    move(point) { this.commands.push({ type: 'move', ...point }); }
    addLine(point) { this.commands.push({ type: 'line', ...point }); }
    closeSubpath() { this.commands.push({ type: 'close' }); }
  }
  class DrawContext {
    constructor() { this.commands = []; this.lineWidth = 1; }
    setFillColor(color) { this.fillColor = color; }
    setStrokeColor(color) { this.strokeColor = color; }
    setFont(font) { this.font = font; }
    setTextColor(color) { this.textColor = color; }
    setTextAlignedCenter() { this.textAlignment = 'center'; }
    drawTextInRect(text, rect) {
      assert.ok(this.font && this.textColor && this.textAlignment, 'Canvas text has explicit styling');
      const command = { type: 'drawTextInRect', text, rect, font: this.font, color: this.textColor, alignment: this.textAlignment };
      this.commands.push(command); drawnTexts.push(command);
    }
    setLineWidth(width) { assert.ok(Number.isFinite(width) && width > 0); this.lineWidth = width; }
    fillRect(rect) { this.commands.push({ type: 'fillRect', rect, color: this.fillColor }); }
    fillEllipse(rect) { this.commands.push({ type: 'fillEllipse', rect, color: this.fillColor }); }
    addPath(path) { this.path = path; }
    strokePath() { this.commands.push({ type: 'strokePath', path: structuredClone(this.path.commands), color: this.strokeColor, lineWidth: this.lineWidth }); }
    fillPath() { this.commands.push({ type: 'fillPath', path: structuredClone(this.path.commands), color: this.fillColor }); }
    getImage() { assert.ok(this.respectScreenScale, 'Graphics must use Retina screen scale'); return { kind: 'drawing', size: this.size, commands: this.commands }; }
  }
  const env = {
    ListWidget, Request, Alert, Point, Rect, Path, DrawContext,
    FileManager: { local: () => ({ documentsDirectory: () => '/docs', joinPath: (a, b) => `${a}/${b}`, fileExists: (p) => files.has(p), createDirectory: (p) => files.set(p, ''), readString: (p) => files.get(p), writeString: (p, s) => files.set(p, s) }) },
    Font: new Proxy({}, { get: (_, name) => (size) => ({ name, size }) }),
    Color: function Color(hex, alpha = 1) { assert.ok(/^[a-fA-F0-9]{6}$/.test(hex)); assert.ok(alpha >= 0 && alpha <= 1); this.hex = hex; this.alpha = alpha; },
    Size: function Size(width, height) { assert.ok(Number.isFinite(width) && Number.isFinite(height)); this.width = width; this.height = height; },
    Device: { screenSize: () => ({ width, height }) },
    Location: { setAccuracyToHundredMeters() {}, async current() { locationCalls++; if (locationError) throw new Error('Location unavailable'); return { ...location, horizontalAccuracy: 100 }; } },
    Timer: { schedule: () => ({ invalidate() {} }) },
    Safari: { open: (url) => requests.push(url) },
    Script: { name: () => 'Pocket Desk', setWidget: (widget) => { result = widget; }, complete: () => { completed = true; } },
    config: { widgetFamily: family, runsInWidget: !app, runsInAccessoryWidget: family.startsWith('accessory') },
    args: { widgetParameter: parameter, queryParameters: {} },
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [mockTime])); }
      static now() { return mockTime; }
      getFullYear() { return new Date(this.getTime() + timezoneOffset * HOUR).getUTCFullYear(); }
      getMonth() { return new Date(this.getTime() + timezoneOffset * HOUR).getUTCMonth(); }
      getDate() { return new Date(this.getTime() + timezoneOffset * HOUR).getUTCDate(); }
      getHours() { return new Date(this.getTime() + timezoneOffset * HOUR).getUTCHours(); }
      getMinutes() { return new Date(this.getTime() + timezoneOffset * HOUR).getUTCMinutes(); }
    },
  };
  return {
    env, files, requests, texts, drawnTexts, alerts, settingsPath,
    get result() { return result; }, get locationCalls() { return locationCalls; }, get completed() { return completed; },
    async run() { await new AsyncFunction(...Object.keys(env), source)(...Object.values(env)); return result; },
    async api() {
      const exports = 'return { validIso,parseSora,validSpxRows,distanceKm,travelCard,nearestStation,singaporeServiceDate,makeTrainEngine,chosenCards,widgetDimensions,readSettings,trainCard,airCard,soraCard,spxCard,currentLocation,cached,buildWidget,loadAir,setupAir,chartGeometry,largeLayout,peDial,airDial,routeRail };';
      return new AsyncFunction(...Object.keys(env), source.replace(/await run\(\);\s*$/, exports))(...Object.values(env));
    },
  };
}
function settingsFiles(settings) { return new Map([['/docs/pocket-desk/settings.json', JSON.stringify(settings)]]); }
function widgetText(rt) { return [...rt.texts,...rt.drawnTexts].map((t) => t.text).join(' | '); }
function assertLayout(node, trail = 'widget') {
  if (node.kind === 'text') {
    assert.equal(node.lineLimit, 1, `${trail}: text must be single-line`);
    assert.ok(node.minimumScaleFactor >= 0.7 && node.minimumScaleFactor <= 1, `${trail}: readable scaling`);
    assert.ok(node.font.size >= 8, `${trail}: minimum font`);
    return { width: node.text.length * node.font.size * 0.56, height: node.font.size * 1.2, flexible: true };
  }
  if (node.kind === 'image') return { width: node.imageSize.width, height: node.imageSize.height, flexible: false };
  if (node.kind === 'spacer') return { width: node.length || 0, height: node.length || 0, flexible: !node.length };
  const children = node.children.map((child, i) => assertLayout(child, `${trail}/${i}`));
  const [top, right, bottom, left] = node.padding;
  const fixedHeights = children.map((c) => c.height);
  const naturalHeight = (node.axis === 'vertical' ? fixedHeights.reduce((a, b) => a + b, 0) : Math.max(0, ...fixedHeights)) + top + bottom;
  const naturalWidth = (node.axis === 'horizontal' ? children.reduce((sum, c) => sum + c.width, 0) : Math.max(0, ...children.map((c) => c.width))) + left + right;
  if (node.size?.height) assert.ok(naturalHeight <= node.size.height + 2, `${trail} height ${naturalHeight.toFixed(1)} exceeds ${node.size.height}`);
  if (node.axis === 'horizontal' && node.size?.width) {
    const fixedWidth = children.reduce((sum, c) => sum + (c.flexible ? 0 : c.width), 0) + left + right;
    assert.ok(fixedWidth <= node.size.width + 0.01, `${trail}: fixed widths ${fixedWidth} exceed ${node.size.width}`);
  }
  return { width: node.size?.width || naturalWidth, height: node.size?.height || naturalHeight, flexible: !node.size?.width };
}
function assertWidget(rt, dimensions) {
  assert.ok(rt.result && rt.completed, 'Widget was delivered and script completed');
  assert.ok(!/NaN|undefined|Infinity/.test(widgetText(rt)), widgetText(rt));
  const layout = assertLayout(rt.result);
  assert.ok(layout.width <= dimensions.width + 0.01, `Root width ${layout.width} > ${dimensions.width}`);
  assert.ok(layout.height <= dimensions.height + 2, `Root height ${layout.height} > ${dimensions.height}`);
  assert.ok(rt.result.refreshAfterDate.getTime() > NOW);
}
let count = 0;
async function test(name, fn) { await fn(); count++; console.log(`ok ${count} - ${name}`); }
const captures = [];

await test('CSV BOM, quotes, dates, sorting, duplicate rows and malformed payloads', async () => {
  const api = await runtime().api();
  assert.equal(api.parseSora(soraCsv).at(-1).sora, 1.0846);
  assert.equal(api.parseSora(soraCsv).at(-1).date, '2026-10-13');
  assert.equal(api.parseSora('date,a,b,c\n31/02/2026,1,2,3\n13/10/2026,,2,3\n13/10/2026,1,2,3\n13/10/2026,4,5,6').length, 1);
  assert.equal(api.parseSora('<html>Unavailable</html>').length, 0);
  assert.equal(api.validIso('2026-99-99'), false);
  assert.equal(api.validSpxRows([{date:'2026-10-12',spx:100,eps:10,pe:25}]), false);
});
await test('Widget parameters select supported cards without private values or arbitrary URLs', async () => {
  const api = await runtime().api();
  assert.deepEqual(api.chosenCards('large', 'air'), ['sora','spx','train','air']);
  assert.deepEqual(api.chosenCards('medium','local'), ['train','air']);
  assert.deepEqual(api.chosenCards('medium','sora,air'), ['sora','air']);
  assert.deepEqual(api.chosenCards('small','https://example.com'), ['sora']);
});
await test('Exact existing last-train engine preserves direct, transfer and buffer fixtures', async () => {
  const api = await runtime().api(), engine = api.makeTrainEngine(trainData);
  const route = (from,to,buffer=3,date='2026-07-29') => engine.calculateLastTrain({originId:from,destinationId:to,bufferMinutes:buffer,date}).recommended;
  assert.equal(route('farrer-park','lakeside').boardBy, 1421);
  assert.equal(route('farrer-park','lakeside',0).boardBy, 1428);
  assert.equal(route('farrer-park','lakeside',10).boardBy, 1414);
  assert.equal(route('bukit-panjang','expo').boardBy, 1415);
  assert.equal(route('harbourfront','punggol-coast').boardBy, 1435);
  assert.equal(route('farrer-park','lakeside').confidence, 'estimated');
});
await test('Singapore service date is previous day before 04:00 even on foreign device timezones', async () => {
  const api = await runtime().api();
  assert.equal(api.singaporeServiceDate(Date.parse('2026-10-13T16:30:00Z')), '2026-10-13');
  assert.equal(api.singaporeServiceDate(Date.parse('2026-10-13T20:00:00Z')), '2026-10-14');
});
await test('Nearest MRT uses precise local exit coordinates and rejects LRT', async () => {
  const api = await runtime().api();
  assert.equal(api.nearestStation(farrer, coordinates.stations, trainData.stations).station.id, 'farrer-park');
  assert.equal(api.nearestStation(lakeside, coordinates.stations, trainData.stations).station.id, 'lakeside');
  assert.ok(api.nearestStation(farrer, coordinates.stations, trainData.stations).distance < 0.001);
});
for (const [width,height] of [[320,568],[375,667],[390,844],[430,932],[440,956]]) {
  for (const family of ['small','medium','large']) {
    await test(`${family} point layout and populated cards on ${width}×${height}`, async () => {
      const rt = runtime({family,width,height,files:settingsFiles({autoLocation:true,airConsent:true,destination:'lakeside'}),parameter:family==='medium'?'local':''});
      const api = await rt.api(); await rt.run(); assertWidget(rt,api.widgetDimensions(family));
      if(family==='large') {
        assert.match(widgetText(rt),/Historical/); assert.match(widgetText(rt),/29 Jul · verify/);
        assert.match(widgetText(rt),/1.0846/); assert.match(widgetText(rt),/US AQI · model/);
        assert.equal(rt.result.children.filter((c)=>c.kind==='stack').length,4);
        assert.equal(rt.locationCalls,1);
        captures.push({name:`${family}-${width}x${height}`,dimension:api.widgetDimensions(family),tree:rt.result});
      }
    });
  }
}
await test('First run performs no location lookup or air-data sharing without in-app consent', async () => {
  const rt=runtime(); await rt.run();
  assert.equal(rt.locationCalls,0); assert.equal(rt.requests.some((u)=>u.includes('air-quality-api')),false);
  assert.match(widgetText(rt),/Enable location/); assert.match(widgetText(rt),/Enable air quality/);
});
await test('AQI rounds only outgoing coordinates; precise location remains local', async () => {
  const rt=runtime({family:'small',parameter:'air',files:settingsFiles({autoLocation:true,airConsent:true})}); await rt.run();
  const url=rt.requests.find((u)=>u.includes('air-quality-api'));
  assert.ok(url.includes(`latitude=${Number(farrer.latitude.toFixed(2))}`));
  assert.equal(JSON.parse(rt.files.get(rt.settingsPath)).location.latitude, farrer.latitude);
  assert.ok(!url.includes(String(farrer.latitude)) || farrer.latitude===Number(farrer.latitude.toFixed(2)));
});
await test('Cached location clearly shows its age and is rejected after six hours', async () => {
  const settings={autoLocation:true,destination:'lakeside',location:{...farrer,checkedAt:NOW-2*HOUR}};
  let rt=runtime({family:'small',parameter:'train',files:settingsFiles(settings),locationError:true}); await rt.run();
  assert.match(widgetText(rt),/Location 2h ago · saved/); assert.match(widgetText(rt),/Saved fix:/);
  settings.location.checkedAt=NOW-7*HOUR;
  rt=runtime({family:'small',parameter:'train',files:settingsFiles(settings),locationError:true}); await rt.run();
  assert.match(widgetText(rt),/Location unavailable/); assert.doesNotMatch(widgetText(rt),/Historical estimate/);
});
await test('Home station nearest, outside Singapore, missing and malformed source states are honest', async () => {
  for(const [loc,pattern] of [[lakeside,/Home turf :\)/],[{latitude:51.5,longitude:-0.1},/WANDER MODE/]]) {
    const rt=runtime({family:'small',parameter:'train',location:loc,files:settingsFiles({autoLocation:true})}); await rt.run();assert.match(widgetText(rt),pattern);
  }
  const rt=runtime({offline:true}); const api=await rt.api();await rt.run();assertWidget(rt,api.widgetDimensions('large'));
  assert.match(widgetText(rt),/Rates unavailable/);assert.match(widgetText(rt),/Valuation unavailable/);
});
await test('Home turf requires a nearby automatic home station; manual same-station is explicit', async () => {
  const rt = runtime(), api = await rt.api();
  const fresh = (point, cached = false) => ({ value:{...point,checkedAt:NOW-(cached?2*HOUR:0)},cached });
  const settings = {autoLocation:true,destination:'lakeside'};
  const home = await api.trainCard(settings,fresh(lakeside));
  assert.equal(home.state,'home'); assert.equal(home.metric,'Home turf :)'); assert.equal(home.label,'Lakeside is nearby');
  assert.doesNotMatch(JSON.stringify(home),/back home already|at home|arrived home/i);
  const farFromExit = {latitude:1.337,longitude:103.716};
  assert.equal(api.nearestStation(farFromExit,coordinates.stations,trainData.stations).station.id,'lakeside');
  const near = await api.trainCard(settings,fresh(farFromExit));
  assert.equal(near.state,'near-home'); assert.doesNotMatch(near.metric,/Home turf/);
  const manual = await api.trainCard({...settings,origin:'lakeside'},fresh(lakeside));
  assert.equal(manual.state,'station'); assert.equal(manual.label,'Same origin & home station');
  const saved = await api.trainCard(settings,fresh(lakeside,true));
  assert.equal(saved.state,'home'); assert.equal(saved.metric,'Home turf, last seen'); assert.equal(saved.warning,true);
  assert.match(saved.foot,/Location 2h ago · saved/);
});
await test('Travel distance is local, approximate and independent of train or coordinate data', async () => {
  const location = {latitude:51.5,longitude:-0.1};
  const rt = runtime({family:'small',parameter:'train',location,offline:true,files:settingsFiles({autoLocation:true})});
  const api=await rt.api(); await rt.run(); assertWidget(rt,api.widgetDimensions('small'));
  assert.match(widgetText(rt),/WANDER MODE/); assert.match(widgetText(rt),/from Singapore/);
  assert.match(widgetText(rt),/Straight-line · SG centre/);
  assert.equal(rt.requests.length,0,'Travel card must not request timetable, station, or geocoding data');
  const fix={value:{...location,checkedAt:NOW},cached:false};
  const card=await api.trainCard({autoLocation:true},fix,null,null);
  assert.equal(card.state,'travel'); assert.equal(card.metric,'~10,846 km');
  assert.equal(card.warning,false); assert.ok(card.distanceKm>10840&&card.distanceKm<10860);
  const manual=api.travelCard({autoLocation:true,origin:'farrer-park'},fix); assert.equal(manual,null);
  assert.equal(api.travelCard({autoLocation:false},fix),null);
  for(const point of [
    {latitude:1.470,longitude:103.815}, // northern SG
    {latitude:1.250,longitude:103.635}, // offshore/southwestern SG
    {latitude:1.470,longitude:104.050}, // northeastern SG
    {latitude:1.470,longitude:103.750}, // nearby Johor: no country assertion
    {latitude:1.100,longitude:103.980}, // nearby Batam: deliberately conservative
  ]) assert.equal(api.travelCard({autoLocation:true},{value:{...point,checkedAt:NOW},cached:false}),null);
  // The cutoff is a distance guard, never a country boundary.
  const reference={latitude:1.3521,longitude:103.8198};
  for(const km of [74.9,75.1]) {
    const point={latitude:reference.latitude+(km/6371)*180/Math.PI,longitude:reference.longitude,checkedAt:NOW};
    assert.equal(Boolean(api.travelCard({autoLocation:true},{value:point,cached:false})),km>75);
  }
  for(const bad of [null,{latitude:NaN,longitude:0,checkedAt:NOW},{latitude:91,longitude:0,checkedAt:NOW},{...location,checkedAt:NOW+DAY}]) {
    assert.equal(api.travelCard({autoLocation:true},{value:bad,cached:false}),null);
  }
  const remoteSg=await api.trainCard({autoLocation:true,destination:'lakeside'},{value:{latitude:1.250,longitude:103.635,checkedAt:NOW},cached:false},{value:trainData,offline:false},{value:coordinates,offline:false});
  assert.equal(remoteSg.label,'No nearby MRT'); assert.notEqual(remoteSg.state,'travel');
});
await test('Cached travel fixes state their age, expire, and do not pretend to be current', async () => {
  const settings={autoLocation:true,location:{latitude:51.5,longitude:-0.1,checkedAt:NOW-2*HOUR}};
  const rt=runtime({family:'large',locationError:true,offline:true,files:settingsFiles(settings)});
  const api=await rt.api(); await rt.run(); assertWidget(rt,api.widgetDimensions('large'));
  assert.match(widgetText(rt),/Location 2h ago · saved/); assert.match(widgetText(rt),/WANDER MODE/);
  const card=api.travelCard(settings,{value:settings.location,cached:true}); assert.equal(card.warning,true);
  settings.location.checkedAt=NOW-7*HOUR;
  assert.equal(api.travelCard(settings,{value:settings.location,cached:true}),null);
  const expired=runtime({family:'small',parameter:'train',locationError:true,files:settingsFiles(settings)}); await expired.run();
  assert.match(widgetText(expired),/Location unavailable/); assert.doesNotMatch(widgetText(expired),/WANDER MODE/);
});
await test('A failed card does not break unrelated cards', async () => {
  const rt=runtime({failure:'valuation-data.json'});await rt.run();
  assert.match(widgetText(rt),/1.0846/);assert.match(widgetText(rt),/Valuation unavailable/);
});
await test('Validated caches survive outage and corrupt/expired caches fail safely', async () => {
  const first=runtime();await first.run();
  const files=new Map(first.files);
  for(const [key,value] of files) if(key.includes('sora-v1')||key.includes('spx-v1')) {const record=JSON.parse(value);record.fetchedAt=NOW-4*HOUR;files.set(key,JSON.stringify(record));}
  const second=runtime({files,offline:true});await second.run();assert.match(widgetText(second),/13 Oct · cached/);assert.match(widgetText(second),/12 Oct · cached/);
  for(const [key] of files) if(key.includes('sora-v1'))files.set(key,'{broken');
  const third=runtime({files,offline:true});await third.run();assert.match(widgetText(third),/Rates unavailable/);
  for(const [key,value] of files)if(key.includes('spx-v1')){const record=JSON.parse(value);record.fetchedAt=NOW-15*DAY;files.set(key,JSON.stringify(record));}
  const fourth=runtime({files,offline:true});await fourth.run();assert.match(widgetText(fourth),/Valuation unavailable/);
});
await test('AQI never reuses another location cache or null model values', async () => {
  const settings={airConsent:true,airMode:'manual',airLocation:{latitude:1.3,longitude:103.8,checkedAt:NOW}};
  const first=runtime({family:'small',parameter:'air',files:settingsFiles(settings)});await first.run();assert.match(widgetText(first),/42/);
  const files=new Map(first.files);settings.airLocation={latitude:1.4,longitude:103.9,checkedAt:NOW};files.set(first.settingsPath,JSON.stringify(settings));
  const second=runtime({family:'small',parameter:'air',files,offline:true});await second.run();assert.match(widgetText(second),/Air data unavailable/);
  const third=runtime({family:'small',parameter:'air',files:settingsFiles(settings),fixtureOverrides:{'air-quality?':{current:{us_aqi:null,time:NOW/1000}}}});await third.run();assert.match(widgetText(third),/Air data unavailable/);
});
await test('Malformed cache records still permit online refresh; future cached location is rejected', async () => {
  const files = settingsFiles({autoLocation:true,location:{...farrer,checkedAt:NOW+DAY}});
  files.set('/docs/pocket-desk/sora-v1.json',JSON.stringify({fetchedAt:NOW,value:[null]}));
  const rt=runtime({files,locationError:true});await rt.run();
  assert.match(widgetText(rt),/1.0846/);assert.match(widgetText(rt),/Location unavailable/);
  assert.equal(rt.requests.some((url)=>url.includes('pub?output=csv')),true);
});
await test('AQI local dates agree with local times across Singapore midnight', async () => {
  const rt = runtime({family:'small',parameter:'air',timezoneOffset:8,mockTime:Date.parse('2026-10-13T16:45:00Z'),
    files:settingsFiles({airConsent:true,airMode:'manual',airLocation:{latitude:1.3,longitude:103.8,checkedAt:Date.parse('2026-10-13T16:30:00Z')}}),
    fixtureOverrides:{'air-quality?':{current:{us_aqi:42,time:Date.parse('2026-10-13T16:30:00Z')/1000}}}});
  await rt.run();assert.match(widgetText(rt),/14 Oct 00:30/);
});
await test('Long station names and metrics remain bounded single-line cards', async () => {
  const rt=runtime({width:320,height:568}), api=await rt.api();
  const cards=['sora','spx','train','air'].map((key)=>({key,title:'A VERY LONG CARD TITLE',metric:'123456.7890',unit:key==='sora'?'%':null,label:'A very long model observation label',detail:'Marina South Pier → Prince Edward Road',foot:'29 Jul 25 · cached, verify data',locationLabel:key==='train'?'Location 5h ago · saved':null,attribution:key==='air'?'CAMS / Open-Meteo':null,url:'https://example.com'}));
  const w=api.buildWidget(cards,'large'); const layout=assertLayout(w);assert.ok(layout.width<=292);assert.ok(layout.height<=313);
  captures.push({name:'long-values-292',dimension:api.widgetDimensions('large'),tree:w});
});
await test('App cancellation requests no location and no network', async () => {
  const rt=runtime({app:true,choices:[-1]});await rt.run();assert.equal(rt.locationCalls,0);assert.equal(rt.requests.length,0);assert.equal(rt.result,undefined);
});
await test('Accessories remain supported and meaningful', async()=>{
  for(const family of ['accessoryInline','accessoryRectangular','accessoryCircular']) { const rt=runtime({family});await rt.run();assert.ok(rt.result);assert.match(widgetText(rt),/1.0846/); }
});
await test('Air setup preserves a manually selected train origin', async()=>{
  const rt=runtime({app:true,choices:[0,0]});const api=await rt.api();
  const settings={autoLocation:false,origin:'farrer-park',destination:'lakeside'};
  await api.setupAir(settings);assert.equal(settings.origin,'farrer-park');assert.equal(settings.airConsent,true);assert.equal(settings.autoLocation,true);
});
await test('Circular accessories retain model and historical-data labels', async()=>{
  const rt=runtime({family:'accessoryCircular',parameter:'train',files:settingsFiles({origin:'farrer-park'})});await rt.run();
  assert.match(widgetText(rt),/Historical train/);assert.match(widgetText(rt),/29 Jul · verify/);
  const air=runtime({family:'accessoryCircular',parameter:'air',files:settingsFiles({airConsent:true,airMode:'manual',airLocation:{latitude:1.3,longitude:103.8,checkedAt:NOW}})});await air.run();
  assert.match(widgetText(air),/US AQI model/);assert.match(widgetText(air),/14 Oct/);
});

await test('Native instruments preserve the exact validated source series', async () => {
  const rows = [
    { date: '2026-10-09', spx: 7600, eps: 400, pe: 19 },
    { date: '2026-10-12', spx: 7800, eps: 400, pe: 19.5 },
    { date: '2026-10-13', spx: 7840, eps: 400, pe: 19.6 },
  ];
  const rt = runtime({ fixtureOverrides: { 'valuation-data.json': { rows } } }), api = await rt.api();
  const sora = await api.soraCard(), spx = await api.spxCard();
  assert.deepEqual(sora.series, [
    {date:'2026-10-12',value:1.2026,m1:1.29,m3:1.24},
    {date:'2026-10-13',value:1.0846,m1:1.2894,m3:1.2366},
  ]);
  assert.deepEqual(spx.series, rows.map((r) => ({ date:r.date,value:r.pe })));
  assert.equal(spx.value, 19.6);
  assert.ok(Math.abs(sora.delta + 11.8) < 1e-8);
  await rt.run(); assertWidget(rt, api.widgetDimensions('large'));
  captures.push({ name:'market-history-338',dimension:api.widgetDimensions('large'),tree:rt.result });
});
await test('Sixty-observation synthetic fixture renders the full three-series chart for visual QA', async () => {
  // Deliberately synthetic test-only fixture. Runtime never generates observations.
  const dailyRates = [1.19,1.14,1.12,1.21,1.22,1.18,1.16,1.25,1.12,1.15,1.24,1.22,1.20,1.19,1.26,1.18,1.17,1.19,1.21,1.18,1.16,1.15,1.14,1.20,1.18,1.16,1.13,1.12,1.15,1.13,1.12,1.14,1.16,1.14,1.13,1.10,1.12,1.16,1.12,1.09,1.11,1.14,1.13,1.12,1.15,1.11,1.10,1.14,1.11,1.08,1.12,1.11,1.09,1.11,1.10,1.09,1.12,1.10,1.09,1.0846];
  const csv = 'Date,SORA,1M,3M\n' + dailyRates.map((value,i) => {
    const date = new Date(NOW - (60-i) * DAY), m1 = 1.34 - i * .00086, m3 = 1.33 - i * .00158;
    return `${date.getUTCDate()}/${date.getUTCMonth()+1}/${date.getUTCFullYear()},${value},${m1.toFixed(4)},${m3.toFixed(4)}`;
  }).join('\n');
  const rows = dailyRates.map((_,i) => ({date:new Date(NOW-(60-i)*DAY).toISOString().slice(0,10),spx:(18.7+i*.014)*400,eps:400,pe:18.7+i*.014}));
  for(const [width,height] of [[320,568],[390,844],[430,932]]) {
    const rt=runtime({width,height,files:settingsFiles({autoLocation:true,airConsent:true}),fixtureOverrides:{'pub?output=csv':csv,'valuation-data.json':{rows}}});
    const api=await rt.api();await rt.run();assertWidget(rt,api.widgetDimensions('large'));
    assert.match(widgetText(rt),/60 obs/);
    captures.push({name:`synthetic-60-observations-${width}`,dimension:api.widgetDimensions('large'),tree:rt.result});
  }
});
await test('Chart geometry uses actual dates, shared scales and handles flat or missing history', async () => {
  const api = await runtime().api();
  const series = [
    {date:'2026-10-01',value:1,m1:2,m3:3},
    {date:'2026-10-02',value:2,m1:2,m3:3},
    {date:'2026-10-11',value:3,m1:2,m3:3},
  ];
  const geometry = api.chartGeometry(series, 106, 46, ['value','m1','m3']);
  assert.equal(geometry.low, 1); assert.equal(geometry.high, 3);
  assert.equal(geometry.paths[0][0].x, 3); assert.equal(geometry.paths[0][1].x, 13); assert.equal(geometry.paths[0][2].x, 103);
  assert.equal(geometry.paths[0][1].y, geometry.paths[1][1].y, 'Equal rates share the same y coordinate');
  assert.equal(geometry.paths[0][2].y, geometry.paths[2][2].y);
  const flat = api.chartGeometry(series.map((r) => ({date:r.date,value:2})), 70, 20);
  assert.ok(flat.paths[0].every((p) => p.y === 10));
  assert.equal(api.chartGeometry([], 70, 20), null);
  assert.equal(api.chartGeometry([{date:'2026-10-01',value:2}], 70, 20), null);
  for (const path of geometry.paths) for (const p of path) assert.ok(p.x >= 0 && p.x <= 106 && p.y >= 0 && p.y <= 46);
});
await test('P/E instrument clamps its marker, AQI ticks encode the actual value, and no-data has no marker', async () => {
  const api = await runtime().api();
  const markers = (value) => api.peDial(value, 110, 55).commands.filter((c) => c.type === 'fillEllipse');
  assert.deepEqual(markers(12), markers(16)); assert.deepEqual(markers(40), markers(26));
  assert.equal(markers(undefined).length, 0);
  assert.notDeepEqual(markers(19), markers(23));
  const lit = (value) => api.airDial(value, 46).commands.filter((c) => c.type === 'strokePath' && c.color.alpha === 1).length;
  assert.equal(lit(0), 0); assert.equal(lit(42), 4); assert.equal(lit(100), 10); assert.equal(lit(500), 30); assert.equal(lit(undefined), 0);
});
await test('AQI 0–1000 prints completely inside one Retina drawing without compressible text stacks', async () => {
  for(const aqi of [0,42,100,245,300,500,1000]) for(const [width,height] of [[320,568],[390,844],[440,956]]) for(const family of width===320?['small','medium','large']:['large']) {
    const rt=runtime({family,parameter:family==='small'?'air':'local',width,height,files:settingsFiles({autoLocation:true,airConsent:true}),fixtureOverrides:{'air-quality?':{current:{us_aqi:aqi,time:NOW/1000}}}});
    const api=await rt.api(); await rt.run(); assertWidget(rt,api.widgetDimensions(family));
    const value=rt.drawnTexts.find((t)=>t.text===String(aqi)); assert.ok(value,`AQI ${aqi} is rendered directly in its gauge`);
    assert.equal(value.alignment,'center'); assert.ok(value.font.size>=9);
    assert.ok(value.font.size*String(aqi).length*.72<=value.rect.width+.01,'All digits fit a conservative glyph budget');
    assert.ok(value.rect.height>=value.font.size*1.3,'Number has complete vertical glyph space');
    assert.equal(rt.texts.some((t)=>t.text===String(aqi)),false,'No native gauge label can ellipsize');
    if(width===320||aqi===245||aqi===500) captures.push({name:`${family}-aqi-${aqi}-${width}`,dimension:api.widgetDimensions(family),tree:rt.result});
  }
});
await test('Home, saved-home, travel, manual-home, missing and no-route tickets have no fake boarding divider', async () => {
  const states=[
    {name:'home',location:lakeside,settings:{autoLocation:true}},
    {name:'saved-home',locationError:true,settings:{autoLocation:true,location:{...lakeside,checkedAt:NOW-2*HOUR}}},
    {name:'travel',location:{latitude:35.68,longitude:139.76},settings:{autoLocation:true}},
    {name:'saved-travel',locationError:true,settings:{autoLocation:true,location:{latitude:35.68,longitude:139.76,checkedAt:NOW-2*HOUR}}},
    {name:'manual-home',settings:{origin:'lakeside'}},
    {name:'missing',settings:{}},
    {name:'no-nearby-route',location:{latitude:1.250,longitude:103.635},settings:{autoLocation:true}},
    {name:'home-station-farther',location:{latitude:1.337,longitude:103.716},settings:{autoLocation:true}},
  ];
  for(const state of states) for(const [width,height] of [[320,568],[390,844]]) for(const family of ['small','medium','large']) {
    const rt=runtime({family,parameter:family==='medium'?'local':'train',width,height,location:state.location,locationError:state.locationError,
      files:settingsFiles({...state.settings,airConsent:true}),fixtureOverrides:{'air-quality?':{current:{us_aqi:245,time:NOW/1000}}}});
    const api=await rt.api(); await rt.run(); assertWidget(rt,api.widgetDimensions(family));
    const drawings=[]; const visit=(node)=>{if(node.backgroundImage)drawings.push(node.backgroundImage);for(const child of node.children||[])visit(child);}; visit(rt.result);
    const ticket=drawings.find((drawing)=>drawing.commands.some((c)=>c.type==='fillRect'&&c.color.hex==='FFB45B'));
    assert.ok(ticket); assert.equal(ticket.commands.filter((c)=>c.type==='fillEllipse').length,0,'No punched divider on a non-journey state');
    assert.doesNotMatch(widgetText(rt),/BOARD BY/);
    if(family==='large'||family==='small') captures.push({name:`${family}-${state.name}-${width}`,dimension:api.widgetDimensions(family),tree:rt.result});
  }
});
await test('Leading text rows use explicit trailing spacers and source metadata stays clear of ticket divider', async () => {
  const rt=runtime({files:settingsFiles({autoLocation:true,airConsent:true})}); await rt.run();
  const visit=(node)=>{
    if(node.axis==='horizontal'&&node.children.filter((c)=>c.kind==='text').length===1&&node.children.every((c)=>['text','spacer'].includes(c.kind))) {
      assert.equal(node.children.at(-1).kind,'spacer','One-label rows need trailing spacer, including leading alignment');
    }
    for(const child of node.children||[])visit(child);
  }; visit(rt.result);
  const ticket=rt.result.children.filter((c)=>c.kind==='stack')[2],content=ticket.children[0];
  assert.equal(content.axis,'horizontal'); assert.equal(content.children.filter((c)=>c.kind==='stack').length,2);
  const route=content.children[0];
  const source=route.children.find((node)=>node.children?.some((text)=>text.text?.includes('29 Jul · verify')));
  assert.ok(source); assert.ok(source.size.width<ticket.size.width*.63-9,'Source footer stays entirely left of perforation');
});
await test('Transit rail derives colors and stops from the calculated journey only', async () => {
  const rt = runtime(), api = await rt.api();
  const card = await api.trainCard({origin:'farrer-park',destination:'lakeside',buffer:3},{value:null,cached:false});
  assert.equal(card.origin, 'Farrer Park'); assert.equal(card.destination, 'Lakeside');
  assert.deepEqual(card.routeLines.map((r) => r.id), ['NE','EW']);
  assert.ok(card.routeLines.every((r) => Number.isInteger(r.stops) && r.stops > 0));
  const rail = api.routeRail(card, 120, 9);
  assert.deepEqual(rail.commands.filter((c) => c.type === 'strokePath').map((c) => c.color.hex), ['874DBB','15864D']);
  assert.equal(api.routeRail({unavailable:true},120,9).commands.length,0);
});
await test('Every small instrument and every medium pair fits the smallest supported iPhone', async () => {
  const keys = ['sora','spx','train','air'];
  for (const family of ['small','medium']) for (const first of keys) for (const second of family === 'small' ? [''] : keys.filter((key) => key !== first)) {
    const parameter = family === 'small' ? first : `${first},${second}`;
    const rt = runtime({family,parameter,width:320,height:568,files:settingsFiles({autoLocation:true,airConsent:true})});
    const api = await rt.api(); await rt.run(); assertWidget(rt, api.widgetDimensions(family));
    if(family === 'small' || parameter === 'sora,spx' || parameter === 'train,air') captures.push({name:`${family}-${parameter}-292`,dimension:api.widgetDimensions(family),tree:rt.result});
  }
});
await test('Large layout stays asymmetric with separate source links and honest warning text', async () => {
  const rt = runtime({width:320,height:568,files:settingsFiles({autoLocation:true,airConsent:true})}), api=await rt.api(); await rt.run();
  const [header,finance,ticket,footer] = rt.result.children.filter((c) => c.kind === 'stack');
  assert.equal(header.size.height,16); assert.equal(ticket.size.width,268);
  const panels = finance.children.filter((c) => c.kind === 'stack');
  assert.ok(panels[0].size.width > panels[1].size.width * 1.4);
  assert.equal(panels[0].url,'https://kush0511.github.io/sora-rates/');
  assert.equal(panels[1].url,'https://kush0511.github.io/spy-valuation-bands/');
  assert.equal(ticket.url,'https://kush0511.github.io/sg-last-train-home/');
  assert.equal(footer.children.find((c) => c.kind === 'stack').url,'https://open-meteo.com/en/docs/air-quality-api');
  assert.match(widgetText(rt),/Historical · 29 Jul · verify/); assert.match(widgetText(rt),/Location now/);
  assert.match(widgetText(rt),/US AQI · model/); assert.match(widgetText(rt),/CAMS \/ Open-Meteo/);
  assert.equal(api.largeLayout({width:292,height:311}).finance,103);
});
const capture=process.argv.find((arg)=>arg.startsWith('--capture='));
if(capture) { writeFileSync(capture.slice('--capture='.length),JSON.stringify(captures,null,2));console.log(`Captured ${captures.length} render trees.`); }
console.log(`\n${count} deterministic tests passed. Native iOS rendering still requires a device check.`);
