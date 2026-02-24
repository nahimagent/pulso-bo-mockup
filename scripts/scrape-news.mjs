import { load } from 'cheerio';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { createHash } from 'crypto';
import { existsSync } from 'fs';
import path from 'path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images');
const normalize = (text = '') => text.replace(/\s+/g, ' ').trim();

const mapCategory = (category = '', source = '') => {
  const c = category.toLowerCase();
  const s = source.toLowerCase();
  if (c.includes('santa cruz') || s.includes('santa cruz')) return 'Santa Cruz';
  if (['país', 'pais', 'cochabamba', 'la paz', 'seguridad', 'nacional', 'policial'].some(x => c.includes(x))) return 'País';
  if (['econom', 'hidrocarburos', 'dinero', 'negocios', 'finanzas'].some(x => c.includes(x))) return 'Economía';
  if (['deport', 'futbol', 'fútbol', 'sport'].some(x => c.includes(x))) return 'Deportes';
  if (['tecno', 'ciencia', 'digital', 'innovación'].some(x => c.includes(x))) return 'Tecnología';
  if (['mundo', 'internac', 'global'].some(x => c.includes(x))) return 'Mundo';
  return 'País';
};

async function fetchText(url, timeout = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'es-BO,es;q=0.9' }, signal: controller.signal });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ==================== DIRECT WEB SCRAPERS ====================

async function scrapeElDeber() {
  const sections = [
    { url: 'https://eldeber.com.bo/pais', cat: 'País', name: 'El Deber' },
    { url: 'https://eldeber.com.bo/santa-cruz', cat: 'Santa Cruz', name: 'El Deber' },
    { url: 'https://eldeber.com.bo/economia', cat: 'Economía', name: 'El Deber' },
    { url: 'https://eldeber.com.bo/deportes', cat: 'Deportes', name: 'El Deber' },
    { url: 'https://eldeber.com.bo/mundo', cat: 'Mundo', name: 'El Deber' },
  ];
  const allItems = [];
  for (const sec of sections) {
    try {
      const html = await fetchText(sec.url);
      const $ = load(html);
      $('article, .news-item, .card, [class*="nota"], [class*="article"]').each((_, el) => {
        const $el = $(el);
        const title = normalize($el.find('h2, h3, h4, .title, [class*="title"]').first().text());
        const linkEl = $el.find('a[href*="/"]').first();
        let link = linkEl.attr('href') || '';
        const img = $el.find('img').attr('data-src') || $el.find('img').attr('src') || '';
        const snippet = normalize($el.find('p, .summary, [class*="sumario"], [class*="desc"]').first().text());

        if (!title || title.length < 15) return;
        if (!link.startsWith('http')) link = `https://eldeber.com.bo${link}`;

        allItems.push({
          source: sec.name, sourceUrl: 'https://eldeber.com.bo',
          title, snippet: snippet || title,
          url: link,
          image: img.startsWith('http') ? img : img ? `https://eldeber.com.bo${img}` : '',
          category: sec.cat, date: new Date().toISOString()
        });
      });
    } catch (e) { console.error(`  ⚠️ El Deber (${sec.cat}):`, e.message); }
  }
  console.log(`  📰 El Deber: ${allItems.length} noticias`);
  return dedup(allItems).slice(0, 12);
}

async function scrapeLosTiempos() {
  const items = [];
  try {
    const html = await fetchText('https://www.lostiempos.com');
    const $ = load(html);
    $('article, .views-row, [class*="nota"], [class*="article"]').each((_, el) => {
      const $el = $(el);
      const title = normalize($el.find('h2, h3, h4, .field-content a, [class*="title"]').first().text());
      let link = $el.find('a[href*="/"]').first().attr('href') || '';
      const img = $el.find('img').attr('data-src') || $el.find('img').attr('src') || '';
      const catText = normalize($el.find('.category, [class*="seccion"], [class*="category"]').first().text());

      if (!title || title.length < 15) return;
      if (!link.startsWith('http')) link = `https://www.lostiempos.com${link}`;

      items.push({
        source: 'Los Tiempos', sourceUrl: 'https://www.lostiempos.com',
        title, snippet: title,
        url: link,
        image: img.startsWith('http') ? img : img ? `https://www.lostiempos.com${img}` : '',
        category: mapCategory(catText, 'Los Tiempos'), date: new Date().toISOString()
      });
    });
  } catch (e) { console.error('  ⚠️ Los Tiempos:', e.message); }
  console.log(`  📰 Los Tiempos: ${items.length} noticias`);
  return dedup(items).slice(0, 10);
}

async function scrapeOpinion() {
  const items = [];
  try {
    const html = await fetchText('https://www.opinion.com.bo');
    const $ = load(html);
    // Scrape from their main page article links
    $('article, .noticia, [class*="nota"], [class*="article"], .views-row').each((_, el) => {
      const $el = $(el);
      const title = normalize($el.find('h2, h3, h4, [class*="title"], [class*="titulo"]').first().text());
      let link = $el.find('a[href*="articulo"]').first().attr('href') || $el.find('a[href*="/"]').first().attr('href') || '';
      const img = $el.find('img').attr('data-src') || $el.find('img').attr('src') || '';

      if (!title || title.length < 15) return;
      if (!link.startsWith('http')) link = `https://www.opinion.com.bo${link}`;

      items.push({
        source: 'Opinión', sourceUrl: 'https://www.opinion.com.bo',
        title, snippet: title,
        url: link,
        image: img.startsWith('http') ? img : img ? `https://www.opinion.com.bo${img}` : '',
        category: 'País', date: new Date().toISOString()
      });
    });
  } catch (e) { console.error('  ⚠️ Opinión:', e.message); }
  console.log(`  📰 Opinión: ${items.length} noticias`);
  return dedup(items).slice(0, 8);
}

async function scrapeRedUno() {
  const items = [];
  try {
    const html = await fetchText('https://www.reduno.com.bo');
    const $ = load(html);
    $('article, [class*="nota"], [class*="article"], .card').each((_, el) => {
      const $el = $(el);
      const title = normalize($el.find('h2, h3, h4, [class*="title"]').first().text());
      let link = $el.find('a').first().attr('href') || '';
      const img = $el.find('img').attr('data-src') || $el.find('img').attr('src') || '';

      if (!title || title.length < 10) return;
      if (!link.startsWith('http')) link = `https://www.reduno.com.bo${link}`;

      items.push({
        source: 'Red Uno', sourceUrl: 'https://www.reduno.com.bo',
        title, snippet: title,
        url: link,
        image: img.startsWith('http') ? img : img ? `https://www.reduno.com.bo${img}` : '',
        category: 'País', date: new Date().toISOString()
      });
    });
  } catch (e) { console.error('  ⚠️ Red Uno:', e.message); }
  console.log(`  📰 Red Uno: ${items.length} noticias`);
  return dedup(items).slice(0, 8);
}

async function scrapePaginaSiete() {
  const items = [];
  try {
    const html = await fetchText('https://www.paginasiete.bo');
    const $ = load(html);
    $('article, [class*="nota"], [class*="article"], .card, .views-row').each((_, el) => {
      const $el = $(el);
      const title = normalize($el.find('h2, h3, h4, [class*="title"], [class*="titulo"]').first().text());
      let link = $el.find('a[href*="/"]').first().attr('href') || '';
      const img = $el.find('img').attr('data-src') || $el.find('img').attr('src') || '';

      if (!title || title.length < 15) return;
      if (!link.startsWith('http')) link = `https://www.paginasiete.bo${link}`;

      items.push({
        source: 'Página Siete', sourceUrl: 'https://www.paginasiete.bo',
        title, snippet: title,
        url: link,
        image: img.startsWith('http') ? img : img ? `https://www.paginasiete.bo${img}` : '',
        category: 'País', date: new Date().toISOString()
      });
    });
  } catch (e) { console.error('  ⚠️ Página Siete:', e.message); }
  console.log(`  📰 Página Siete: ${items.length} noticias`);
  return dedup(items).slice(0, 8);
}

async function scrapeEjuTV() {
  const items = [];
  try {
    const html = await fetchText('https://eju.tv');
    const $ = load(html);
    $('article, .post, [class*="entry"]').each((_, el) => {
      const $el = $(el);
      const title = normalize($el.find('h2, h3, .entry-title').first().text());
      let link = $el.find('a[href*="/"]').first().attr('href') || '';
      const img = $el.find('img').attr('data-src') || $el.find('img').attr('data-lazy-src') || $el.find('img').attr('src') || '';
      const catText = normalize($el.find('.category, [class*="cat"]').first().text());

      if (!title || title.length < 15) return;

      items.push({
        source: 'Eju.tv', sourceUrl: 'https://eju.tv',
        title, snippet: title,
        url: link,
        image: img,
        category: mapCategory(catText, 'Eju.tv'), date: new Date().toISOString()
      });
    });
  } catch (e) { console.error('  ⚠️ Eju.tv:', e.message); }
  console.log(`  📰 Eju.tv: ${items.length} noticias`);
  return dedup(items).slice(0, 8);
}

// ==================== HELPERS ====================

function dedup(items) {
  return Array.from(new Map(items.map(i => [i.title.toLowerCase().slice(0, 50), i])).values());
}

// Fallback images by category
const FALLBACK_IMAGES = {
  'Santa Cruz': 'https://images.unsplash.com/photo-1588611843986-e300959069d2?w=800&q=80',
  'Economía': 'https://images.unsplash.com/photo-1526304640152-d46f411db83e?w=800&q=80',
  'Deportes': 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80',
  'Tecnología': 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&q=80',
  'Mundo': 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=800&q=80',
  'País': 'https://images.unsplash.com/photo-1529243856184-4f8bc556cf0d?w=800&q=80',
  'default': 'https://images.unsplash.com/photo-1504711331083-9c895941bf81?w=800&q=80'
};

async function main() {
  console.log('🕷️ Scraping news sources (DIRECT WEB MODE)...\n');

  const [eldeber, lostiempos, opinion, reduno, paginasiete, ejutv] = await Promise.all([
    scrapeElDeber(),
    scrapeLosTiempos(),
    scrapeOpinion(),
    scrapeRedUno(),
    scrapePaginaSiete(),
    scrapeEjuTV()
  ]);

  // Interleave sources for variety
  const allNews = [];
  const sources = [eldeber, lostiempos, opinion, reduno, paginasiete, ejutv];
  const maxLen = Math.max(...sources.map(s => s.length));
  for (let i = 0; i < maxLen; i++) {
    for (const src of sources) {
      if (src[i]) allNews.push(src[i]);
    }
  }

  // Download images locally to bypass hotlinking
  await mkdir(IMAGES_DIR, { recursive: true });
  
  // Clean old images to avoid repo bloat
  if (existsSync(IMAGES_DIR)) {
    const { readdir } = await import('node:fs/promises');
    const oldFiles = await readdir(IMAGES_DIR);
    for (const f of oldFiles) {
      if (f.endsWith('.jpg') || f.endsWith('.webp') || f.endsWith('.png')) {
        await rm(path.join(IMAGES_DIR, f), { force: true });
      }
    }
  }
  
  console.log('\n📸 Downloading images locally...');
  const finalNews = [];
  for (const n of allNews) {
    let img = n.image;
    if (!img || img.length < 10 || img.includes('data:image') || img.includes('placeholder') || img.includes('svg+xml')) {
      img = FALLBACK_IMAGES[n.category] || FALLBACK_IMAGES['default'];
      finalNews.push({ ...n, image: img });
      continue;
    }
    
    // Try to download the image
    const hash = createHash('md5').update(n.url).digest('hex').slice(0, 10);
    const localName = `news-${hash}.jpg`;
    const localPath = path.join(IMAGES_DIR, localName);
    const publicUrl = `./images/${localName}`;
    
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const imgUrl = img.replace('http://', 'https://');
      const res = await fetch(imgUrl, { 
        headers: { 'user-agent': UA, 'referer': n.sourceUrl || '' },
        signal: controller.signal 
      });
      clearTimeout(timer);
      
      if (res.ok && res.headers.get('content-type')?.includes('image')) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 5000) { // Only save if > 5KB (not a tiny placeholder)
          await writeFile(localPath, buffer);
          finalNews.push({ ...n, image: publicUrl });
          continue;
        }
      }
    } catch (e) { /* download failed, use fallback */ }
    
    // Fallback if download failed
    img = FALLBACK_IMAGES[n.category] || FALLBACK_IMAGES['default'];
    finalNews.push({ ...n, image: img });
  }
  
  console.log(`   ✅ Downloaded ${finalNews.filter(n => n.image.startsWith('./')).length}/${finalNews.length} images locally`);

  const unique = dedup(finalNews);

  await mkdir('src/data', { recursive: true });
  await writeFile('src/data/news.json', JSON.stringify({
    updatedAt: new Date().toISOString(),
    sources: ['El Deber', 'Los Tiempos', 'Opinión', 'Red Uno', 'Página Siete', 'Eju.tv'],
    news: unique
  }, null, 2));

  console.log(`\n✅ Saved ${unique.length} news items.`);
  console.log(`   Santa Cruz: ${unique.filter(n => n.category === 'Santa Cruz').length}`);
  console.log(`   Sources: ${[...new Set(unique.map(n => n.source))].join(', ')}`);
}

main();
