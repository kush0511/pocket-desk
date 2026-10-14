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
  const requests = [], texts = [], alerts = []; let result, locationCalls = 0, completed = false;
  const settingsPath = '/docs/pocket-desk/settings.json';
  class Stack {
    constructor(kind = 'stack') { this.kind = kind; this.children = []; this.axis = 'horizontal'; this.padding = [0, 0, 0, 0]; }
    addText(text) { const item = { kind: 'text', text: String(text), centerAlignText() {} }; this.children.push(item); texts.push(item); return item; }
    addStack() { const child = new Stack(); this.children.push(child); return child; }
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
  const env = {
    ListWidget, Request, Alert,
    FileManager: { local: () => ({ documentsDirectory: () => '/docs', joinPath: (a, b) => `${a}/${b}`, fileExists: (p) => files.has(p), createDirectory: (p) => files.set(p, ''), readString: (p) => files.get(p), writeString: (p, s) => files.set(p, s) }) },
    Font: new Proxy({}, { get: (_, name) => (size) => ({ name, size }) }),
    Color: function Color(hex) { this.hex = hex; },
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
    env, files, requests, texts, alerts, settingsPath,
    get result() { return result; }, get locationCalls() { return locationCalls; }, get completed() { return completed; },
    async run() { await new AsyncFunction(...Object.keys(env), source)(...Object.values(env)); return result; },
    async api() {
      const exports = 'return { validIso,parseSora,validSpxRows,nearestStation,singaporeServiceDate,makeTrainEngine,chosenCards,widgetDimensions,readSettings,trainCard,airCard,currentLocation,cached,buildWidget,loadAir,setupAir };';
      return new AsyncFunction(...Object.keys(env), source.replace(/await run\(\);\s*$/, exports))(...Object.values(env));
    },
  };
}
function settingsFiles(settings) { return new Map([['/docs/pocket-desk/settings.json', JSON.stringify(settings)]]); }
function widgetText(rt) { return rt.texts.map((t) => t.text).join(' | '); }
function assertLayout(node, trail = 'widget') {
  if (node.kind === 'text') {
    assert.equal(node.lineLimit, 1, `${trail}: text must be single-line`);
    assert.ok(node.minimumScaleFactor >= 0.7 && node.minimumScaleFactor <= 1, `${trail}: readable scaling`);
    assert.ok(node.font.size >= 8, `${trail}: minimum font`);
    return { width: node.text.length * node.font.size * 0.56, height: node.font.size * 1.2, flexible: true };
  }
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
        assert.match(widgetText(rt),/Historical estimate/); assert.match(widgetText(rt),/29 Jul · verify/);
        assert.match(widgetText(rt),/1.0846/); assert.match(widgetText(rt),/US AQI · model/);
        assert.equal(rt.result.children.filter((c)=>c.kind==='stack').length,3);
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
  for(const [loc,pattern] of [[lakeside,/Home MRT is nearest/],[{latitude:51.5,longitude:-0.1},/No nearby MRT/]]) {
    const rt=runtime({family:'small',parameter:'train',location:loc,files:settingsFiles({autoLocation:true})}); await rt.run();assert.match(widgetText(rt),pattern);
  }
  const rt=runtime({offline:true}); const api=await rt.api();await rt.run();assertWidget(rt,api.widgetDimensions('large'));
  assert.match(widgetText(rt),/Rates unavailable/);assert.match(widgetText(rt),/Valuation unavailable/);
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
const capture=process.argv.find((arg)=>arg.startsWith('--capture='));
if(capture) { writeFileSync(capture.slice('--capture='.length),JSON.stringify(captures,null,2));console.log(`Captured ${captures.length} render trees.`); }
console.log(`\n${count} deterministic tests passed. Native iOS rendering still requires a device check.`);
