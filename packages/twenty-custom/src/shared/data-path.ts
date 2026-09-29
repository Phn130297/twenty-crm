const DATA_DIR = process.env.VERCEL ? '/tmp/data' : './data';
export function dataPath(file: string): string {
  return DATA_DIR + '/' + file;
}
export function ensureDataDir() {
  if (!require('fs').existsSync(DATA_DIR)) require('fs').mkdirSync(DATA_DIR, { recursive: true });
}
