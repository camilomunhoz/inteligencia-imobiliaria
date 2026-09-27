import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const osrmDataDir = path.resolve(rootDir, 'osrm-data');

if (!fs.existsSync(osrmDataDir)) {
  fs.mkdirSync(osrmDataDir, { recursive: true });
}

const pbfPath = path.resolve(osrmDataDir, 'porto-alegre.osm.pbf');
const pbfUrl = 'https://download.bbbike.org/osm/bbbike/PortoAlegre/PortoAlegre.osm.pbf';

console.log('=== Configuração da Malha Viária OSRM (Porto Alegre) ===\n');

// 1. Download do extrato se não existir
if (!fs.existsSync(pbfPath)) {
  console.log(`1. Baixando extrato OSM de Porto Alegre (~25MB) de ${pbfUrl}...`);
  execSync(`curl -L -o "${pbfPath}" "${pbfUrl}"`, { stdio: 'inherit' });
} else {
  console.log('1. Extrato porto-alegre.osm.pbf já presente em osrm-data/.');
}

const osrmImage = 'ghcr.io/project-osrm/osrm-backend:v5.27.1';
const volumeMount = `${osrmDataDir}:/data`;

// 2. osrm-extract
console.log('\n2. Executando osrm-extract (perfil car.lua)...');
execSync(`docker run --rm -v "${volumeMount}" ${osrmImage} osrm-extract -p /opt/car.lua /data/porto-alegre.osm.pbf`, { stdio: 'inherit' });

// 3. osrm-partition
console.log('\n3. Executando osrm-partition (MLD)...');
execSync(`docker run --rm -v "${volumeMount}" ${osrmImage} osrm-partition /data/porto-alegre.osrm`, { stdio: 'inherit' });

// 4. osrm-customize
console.log('\n4. Executando osrm-customize (MLD)...');
execSync(`docker run --rm -v "${volumeMount}" ${osrmImage} osrm-customize /data/porto-alegre.osrm`, { stdio: 'inherit' });

console.log('\nProcessamento do OSRM para Porto Alegre concluído com sucesso!');
console.log('Para iniciar o serviço: docker compose up -d osrm');
