import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Offline, reproducible import. Download the official GeoJSON with data.gov.sg's
// documented poll-download API, then pass that file, its metadata, and the
// matching sg-last-train-home network JSON. No user location is used here.
const [geoPath, metadataPath, networkPath, outputPath = 'public/data/sg-station-coordinates.json'] = process.argv.slice(2);
if (!geoPath || !metadataPath || !networkPath) {
  throw new Error('Usage: node scripts/import-station-coordinates.mjs <LTA.geojson> <metadata.json> <network.json> [output.json]');
}
const raw = fs.readFileSync(geoPath);
const geo = JSON.parse(raw);
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8')).data;
const network = JSON.parse(fs.readFileSync(networkPath, 'utf8'));
const mrtLines = new Set(['NS', 'EW', 'CG', 'NE', 'CC', 'DT', 'TE']);
const normalize = (name) => name.toLowerCase().replace(/ mrt station$/, '').replace(/[^a-z0-9]/g, '');
const eligible = network.payload.stations.filter((station) => station.lineIds.some((id) => mrtLines.has(id)));
const byName = new Map(eligible.map((station) => [normalize(station.name), station]));
const byCode = new Map(eligible.flatMap((station) => station.codes.map((code) => [code, station])));
const grouped = new Map();
const excludedNames = new Set();
const matchedByCode = new Set();
for (const feature of geo.features) {
  const name = feature.properties.STATION_NA;
  // Do not merge an adjacent LRT station's exits into its MRT interchange.
  const station = / LRT STATION$/.test(name) ? null : byName.get(normalize(name)) ?? byCode.get(name);
  if (!station) { excludedNames.add(name); continue; }
  if (byCode.has(name)) matchedByCode.add(name);
  if (feature.geometry.type !== 'Point') throw new Error(`Non-point geometry: ${name}`);
  const [longitude, latitude] = feature.geometry.coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
      || latitude < 1.15 || latitude > 1.5 || longitude < 103.55 || longitude > 104.1) {
    throw new Error(`Coordinate outside Singapore bounds: ${name}`);
  }
  const exit = {
    code: String(feature.properties.EXIT_CODE),
    latitude: Number(latitude.toFixed(7)),
    longitude: Number(longitude.toFixed(7)),
    sourceObjectId: feature.properties.OBJECTID,
  };
  const exits = grouped.get(station.id) ?? [];
  if (!exits.some((item) => item.code === exit.code && item.latitude === exit.latitude && item.longitude === exit.longitude)) exits.push(exit);
  grouped.set(station.id, exits);
}
const missing = eligible.filter((station) => !grouped.has(station.id)).map((station) => station.id);
if (missing.length) throw new Error(`No official coordinates for: ${missing.join(', ')}`);
const stations = eligible.map((station) => {
  const exits = grouped.get(station.id).sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }) || a.latitude - b.latitude);
  return {
    id: station.id,
    name: station.name,
    mode: 'MRT',
    codes: station.codes.filter((code) => /^(NS|EW|CG|NE|CC|DT|TE)\d+$/.test(code)),
    lineIds: station.lineIds.filter((id) => mrtLines.has(id)),
    latitude: Number((exits.reduce((sum, exit) => sum + exit.latitude, 0) / exits.length).toFixed(7)),
    longitude: Number((exits.reduce((sum, exit) => sum + exit.longitude, 0) / exits.length).toFixed(7)),
    coordinateMethod: 'mean-of-official-exits',
    exits,
  };
}).sort((a, b) => a.id.localeCompare(b.id));
const sourceUrl = 'https://data.gov.sg/datasets/d_b39d3a0871985372d7e1637193335da5/view';
const accessDate = new Date().toISOString().slice(0, 10);
const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    name: metadata.name,
    agency: metadata.managedBy,
    url: sourceUrl,
    datasetId: metadata.datasetId,
    updatedAt: metadata.lastUpdatedAt,
    coverageStart: metadata.coverageStart,
    accessedAt: accessDate,
    sha256: createHash('sha256').update(raw).digest('hex'),
    license: { name: 'Singapore Open Data Licence 1.0', url: 'https://data.gov.sg/open-data-licence' },
    attribution: `Contains information from LTA MRT Station Exit (GEOJSON), accessed on ${accessDate} from data.gov.sg, made available under the Singapore Open Data Licence 1.0.`,
  },
  network: { datasetVersion: network.datasetVersion, networkAsOf: network.networkAsOf, eligibleMrtStations: eligible.length },
  selection: {
    method: 'Operating MRT stations present in the matching routing-network whitelist; one record per physical station.',
    distanceMethod: 'Minimum local haversine distance to the official exits; station latitude/longitude is an exit centroid fallback.',
    limitations: 'Straight-line distance is not a walking route. Exit availability is not live. The whitelist must be updated with the routing network before newly opened stations can be selected.',
  },
  coverage: {
    expectedMrtStations: eligible.length,
    matchedMrtStations: stations.length,
    missingStationIds: missing,
    officialExitCount: stations.reduce((sum, station) => sum + station.exits.length, 0),
    matchedStationCodes: [...matchedByCode].sort(),
    excludedSourceNames: [...excludedNames].sort(),
  },
  stations,
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Saved ${stations.length} MRT stations / ${result.coverage.officialExitCount} exits to ${outputPath}. Missing: ${missing.length}.`);
