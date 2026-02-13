import { load } from 'cheerio';
import { writeFile, mkdir } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const normalize = (text = '') => text.replace(/\s+/g, ' ').trim();

const mapCategory = (category = '', source = '') => {
  const c = category.toLowerCase();
  const s = source.toLowerCase();
  
  if (c.includes('santa cruz') || s.includes('santa cruz')) return 'Santa Cruz';
  
  if (['país', 'pais', 'cochabamba', 'la paz', 'seguridad', 'nacional'].some(x => c.includes(x))) return 'País';
  if (['econom', 'hidrocarburos', 'dinero', 'negocios', 'finanzas'].some(x => c.includes(x))) return 'Economía';
  if (['deport', 'futbol', 'fútbol', 'sport'].some(x => c.includes(x))) return 'Deportes';
  if (['tecno', 'ciencia', 'digital', 'innovación'].some(x => c.includes(x))) return 'Tecnología';
  if (['mundo', 'internac', 'global'].some(x => c.includes(x))) return 'Mundo';
  
  return 'País';
};

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: controller.signal });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function scrapeRss(sourceName, rssUrl, categoryOverride = null) {
  try {
    const xml = await fetchText(rssUrl);
    const $ = load(xml, { xmlMode: true });
    const items = [];

    $('item').each((_, el) => {
      const item = $(el);
      const title = normalize(item.find('title').text());
      const link = normalize(item.find('link').text());
      const pubDate = new Date(item.find('pubDate').text());
      const desc = normalize(item.find('description').text().replace(/<[^>]+>/g, ''));
      const category = normalize(item.find('category').first().text());
      
      const media = item.find('media\\:content').attr('url') || 
                    item.find('enclosure').attr('url') || 
                    item.find('image').find('url').text() ||
                    null;

      if (!title || !link) return;

      items.push({
        source: sourceName,
        sourceUrl: new URL(link).origin,
        title,
        snippet: desc.slice(0, 150) + '...',
        url: link,
        image: media,
        category: categoryOverride || mapCategory(category, sourceName),
        date: isNaN(pubDate.getTime()) ? new Date().toISOString() : pubDate.toISOString()
      });
    });

    return items.slice(0, 10);
  } catch (e) {
    console.error(`Error scraping ${sourceName}:`, e.message);
    return [];
  }
}

// Fallback images by category (High Quality Unsplash)
const FALLBACK_IMAGES = {
  'Santa Cruz': 'https://images.unsplash.com/photo-1588611843986-e300959069d2?w=800&q=80', // Santa Cruz vibes
  'Economía': 'https://images.unsplash.com/photo-1526304640152-d46f411db83e?w=800&q=80',   // Money/Business
  'Deportes': 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80',   // Sports stadium
  'Tecnología': 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&q=80', // Tech code
  'Mundo': 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=800&q=80',      // World map
  'País': 'https://images.unsplash.com/photo-1529243856184-4f8bc556cf0d?w=800&q=80',       // Bolivia landscape
  'default': 'https://images.unsplash.com/photo-1504711331083-9c895941bf81?w=800&q=80'     // News generic
};

async function main() {
  console.log('🕷️ Scraping news sources...');
  
  // Updated RSS Feeds
  const [lt, ed_pais, ed_scz, eju_scz, opinion] = await Promise.all([
    scrapeRss('Los Tiempos', 'https://www.lostiempos.com/rss/ultimas'),
    scrapeRss('El Deber', 'https://eldeber.com.bo/rss/pais', 'País'),
    scrapeRss('El Deber SCZ', 'https://eldeber.com.bo/rss/santa-cruz', 'Santa Cruz'), 
    scrapeRss('Eju.tv SCZ', 'https://eju.tv/tag/santa-cruz/feed/', 'Santa Cruz'),
    scrapeRss('Opinión', 'https://www.opinion.com.bo/rss/feed.html'),
  ]);

  const allNews = [...lt, ...ed_pais, ...ed_scz, ...eju_scz, ...opinion]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(n => {
       // AGGRESSIVE FALLBACK: 
       // El Deber and Los Tiempos block hotlinking. Use Unsplash by category for them.
       const blockedSources = ['El Deber', 'Los Tiempos', 'El Deber SCZ'];
       let validImage = n.image;
       
       if (blockedSources.includes(n.source) || !validImage || validImage.includes('white.jpg') || validImage.length < 10) {
         // Rotating images per category to avoid duplicates looking identical
         const cat = n.category || 'País';
         validImage = FALLBACK_IMAGES[cat] || FALLBACK_IMAGES['default'];
         // Add random parameter to avoid identical caching for same category
         validImage += '&sig=' + Math.floor(Math.random() * 1000);
       }
       return { ...n, image: validImage };
    });

  const uniqueNews = Array.from(new Map(allNews.map(item => [item.url, item])).values());

  await mkdir('src/data', { recursive: true });
  await writeFile('src/data/news.json', JSON.stringify({
    updatedAt: new Date().toISOString(),
    sources: ['Los Tiempos', 'El Deber', 'Opinión', 'Eju.tv'],
    news: uniqueNews
  }, null, 2));

  console.log(`✅ Saved ${uniqueNews.length} news items. Santa Cruz items: ${uniqueNews.filter(n => n.category === 'Santa Cruz').length}`);
}

main();
