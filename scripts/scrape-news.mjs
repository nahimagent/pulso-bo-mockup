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

async function scrapeRedUno() {
  try {
    const html = await fetchText('https://www.reduno.com.bo');
    const $ = load(html);
    const items = [];

    $('article').each((_, el) => {
      const title = normalize($(el).find('h2, h3').text());
      const link = $(el).find('a').attr('href');
      const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
      
      if (!title || !link || !img) return;

      items.push({
        source: 'Red Uno',
        sourceUrl: 'https://www.reduno.com.bo',
        title,
        snippet: title, // Red Uno snippets are often hidden, using title
        url: link.startsWith('http') ? link : `https://www.reduno.com.bo${link}`,
        image: img.startsWith('http') ? img : `https://www.reduno.com.bo${img}`,
        category: 'País', // Defaulting
        date: new Date().toISOString()
      });
    });
    return items.slice(0, 8);
  } catch (e) {
    console.error('Error scraping Red Uno:', e.message);
    return [];
  }
}

async function main() {
  console.log('🕷️ Scraping news sources (REAL IMAGES MODE)...');
  
  const [lt, ed_pais, ed_scz, eju_scz, opinion, reduno] = await Promise.all([
    scrapeRss('Los Tiempos', 'https://www.lostiempos.com/rss/ultimas'),
    scrapeRss('El Deber', 'https://eldeber.com.bo/rss/pais', 'País'),
    scrapeRss('El Deber SCZ', 'https://eldeber.com.bo/rss/santa-cruz', 'Santa Cruz'), 
    scrapeRss('Eju.tv SCZ', 'https://eju.tv/tag/santa-cruz/feed/', 'Santa Cruz'),
    scrapeRss('Opinión', 'https://www.opinion.com.bo/rss/feed.html'),
    scrapeRedUno()
  ]);

  // Mix content to make it interesting (Shuffle)
  const allNews = [...reduno, ...ed_scz, ...lt, ...eju_scz, ...ed_pais, ...opinion]
    .filter(n => n.image && n.image.length > 10) // Filter items without valid images
    .map(n => ({
       ...n,
       // Force HTTPS on images
       image: n.image.replace('http://', 'https://')
    }));

  // Remove duplicates based on URL
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
