import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Diretório público para armazenamento local de imagens
export const UPLOADS_DIR = path.resolve(__dirname, '../../public/uploads');

export async function ensureUploadsDir(imovelId: number): Promise<string> {
  const dir = path.join(UPLOADS_DIR, 'imoveis', String(imovelId));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Faz download de um lote de fotos de um anúncio para armazenamento local permanente.
 * Retorna as URLs locais (ex: /uploads/imoveis/1/foto_0.jpg) ou a URL original em caso de falha.
 */
export async function downloadListingImages(
  imovelId: number,
  remoteUrls: string[],
  maxImages = 6
): Promise<string[]> {
  if (!remoteUrls || remoteUrls.length === 0) return [];

  const targetDir = await ensureUploadsDir(imovelId);
  const downloadedUrls: string[] = [];

  const toDownload = remoteUrls.slice(0, maxImages);

  for (let i = 0; i < toDownload.length; i++) {
    const remoteUrl = toDownload[i];
    const ext = path.extname(new URL(remoteUrl).pathname) || '.jpg';
    const filename = `foto_${i}${ext}`;
    const filePath = path.join(targetDir, filename);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(remoteUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      clearTimeout(timeout);

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));
        downloadedUrls.push(`/uploads/imoveis/${imovelId}/${filename}`);
        continue;
      }
    } catch {
      // Fallback gracioso para a URL remota em caso de erro de rede ou bloqueio
    }

    downloadedUrls.push(remoteUrl);
  }

  // Se houver mais URLs remotas além de maxImages, manter as URLs remotas para não perder as fotos
  if (remoteUrls.length > maxImages) {
    downloadedUrls.push(...remoteUrls.slice(maxImages));
  }

  return downloadedUrls;
}
