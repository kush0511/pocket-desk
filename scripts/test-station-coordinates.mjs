import assert from 'node:assert/strict';
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('public/data/sg-station-coordinates.json', 'utf8'));
const networkPath = process.argv[2] ?? '../sg-last-train-home/data/network.v2026.07.29.json';
const mrtLines = new Set(['NS', 'EW', 'CG', 'NE', 'CC', 'DT', 'TE']);
assert.equal(data.schemaVersion, 1);
assert.ok(Number.isFinite(Date.parse(data.generatedAt)));
assert.equal(data.source.agency, 'Land Transport Authority');
assert.equal(data.source.license.url, 'https://data.gov.sg/open-data-licence');
assert.deepEqual(data.coverage.missingStationIds, []);
assert.equal(new Set(data.stations.map((station) => station.id)).size, data.stations.length);
assert.equal(data.coverage.matchedMrtStations, data.stations.length);
const seenCodes = new Set();
for (const station of data.stations) {
  assert.equal(station.mode, 'MRT');
  assert.ok(station.lineIds.length && station.lineIds.every((line) => mrtLines.has(line)));
  assert.ok(station.exits.length);
  for (const code of station.codes) {
    assert.match(code, /^(NS|EW|CG|NE|CC|DT|TE)\d+$/);
    assert.ok(!seenCodes.has(code), `Duplicate MRT code ${code}`);
    seenCodes.add(code);
  }
  for (const point of [station, ...station.exits]) {
    assert.ok(Number.isFinite(point.latitude) && point.latitude >= 1.15 && point.latitude <= 1.5);
    assert.ok(Number.isFinite(point.longitude) && point.longitude >= 103.55 && point.longitude <= 104.1);
  }
}
for (const id of ['marina-south', 'mount-pleasant', 'bedok-south', 'sungei-bedok', 'xilin', 'bakau', 'phoenix']) {
  assert.ok(!data.stations.some((station) => station.id === id), `Non-whitelisted station ${id}`);
}
for (const id of ['lakeside', 'keppel', 'cantonment', 'prince-edward-road', 'punggol-coast', 'hume']) {
  assert.ok(data.stations.some((station) => station.id === id), `Expected operating station ${id}`);
}
function distance(a, b) {
  const radians = (number) => number * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude), dLon = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function nearest(point) {
  return data.stations.map((station) => ({ id: station.id, distance: Math.min(...station.exits.map((exit) => distance(point, exit))) }))
    .sort((a, b) => a.distance - b.distance)[0];
}
// Every individual official exit maps back to its one physical station record.
for (const station of data.stations) {
  for (const exit of station.exits) assert.equal(nearest(exit).id, station.id, `Nearest exit for ${station.id}`);
}
assert.equal(nearest({ latitude: 1.3441, longitude: 103.721 }).id, 'lakeside');
assert.equal(nearest({ latitude: 1.2705, longitude: 103.83 }).id, 'keppel');
assert.equal(nearest({ latitude: 1.355, longitude: 103.7687 }).id, 'hume');
if (fs.existsSync(networkPath)) {
  const network = JSON.parse(fs.readFileSync(networkPath, 'utf8'));
  const expected = network.payload.stations.filter((station) => station.lineIds.some((line) => mrtLines.has(line)));
  assert.deepEqual(data.stations.map((station) => station.id).sort(), expected.map((station) => station.id).sort());
  for (const station of data.stations) assert.equal(station.name, expected.find((item) => item.id === station.id).name);
  assert.equal(data.network.datasetVersion, network.datasetVersion);
  console.log(`Routing-network coverage: ${expected.length}/${expected.length} MRT station IDs.`);
} else {
  console.log('Routing-network comparison skipped: pass its JSON path as the first argument.');
}
console.log(`Coordinate checks passed: ${data.stations.length} MRT stations, ${data.coverage.officialExitCount} official exits, no duplicate physical stations, nearest-exit tests passed.`);
