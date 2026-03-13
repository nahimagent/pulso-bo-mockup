import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

const NEWS_FILE = path.join(process.cwd(), 'src/data/news.json');
const AUDIO_DIR = path.join(process.cwd(), 'public/audio');

try {
  const data = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf-8'));
  const news = data.news;
  let updatedCount = 0;

  for (const item of news) {
    if (!item.url) continue;
    
    const id = createHash('md5').update(item.url).digest('hex').slice(0, 8);
    const fileName = `news-${id}.mp3`;
    const filePath = path.join(AUDIO_DIR, fileName);

    if (fs.existsSync(filePath)) {
      if (!item.audioUrl) {
          item.audioUrl = `/audio/${fileName}`;
          updatedCount++;
      }
    }
  }

  fs.writeFileSync(NEWS_FILE, JSON.stringify(data, null, 2));
  console.log(`✅ Patched news.json: linked ${updatedCount} audio files.`);

} catch (error) {
  console.error("❌ Error patching JSON:", error);
}
