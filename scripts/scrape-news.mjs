import { load } from "cheerio";
import { writeFile, mkdir } from "node:fs/promises";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const normalize = (text = "") => text.replace(/\s+/g, " ").trim();

const mapCategory = (category = "") => {
  const c = category.toLowerCase();
  if (["país", "pais", "santa cruz", "cochabamba", "la paz", "seguridad"].some((x) => c.includes(x))) return "País";
  if (["econom", "hidrocarburos", "dinero", "negocios"].some((x) => c.includes(x))) return "Economía";
  if (["deport", "futbol", "fútbol"].some((x) => c.includes(x))) return "Deportes";
  if (["tecno", "ciencia", "digital"].some((x) => c.includes(x))) return "Tecnología";
  if (["mundo", "internac"].some((x) => c.includes(x))) return "Mundo";
  return "País";
};

const parseDateFromUrl = (url = "") => {
  const m = url.match(/\/(20\d{2})(\d{2})(\d{2})\//) || url.match(/\/(20\d{2})\/(\d{2})\/(\d{2})\//);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${mo}-${d}`;
};

async function fetchText(url) {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  return await res.text();
}

async function scrapeLosTiempos() {
  const html = await fetchText("https://www.lostiempos.com/inicio");
  const $ = load(html);
  const items = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (!href.startsWith("/") || !href.includes("/20")) return;
    if (!["/actualidad/", "/deportes/", "/tendencias/"].some((p) => href.includes(p))) return;

    const title = normalize($(el).text());
    if (title.length < 35) return;

    const parent = $(el).closest(".views-row, .item-list li, .node, .content");
    const img =
      parent.find("img").first().attr("src") ||
      parent.prevAll().find("img").first().attr("src") ||
      null;

    const rawCategory = href.split("/")[2] || "País";
    const date = parseDateFromUrl(href);
    items.push({
      source: "Los Tiempos",
      sourceUrl: "https://www.lostiempos.com",
      title,
      snippet: `${title.slice(0, 140)}...`,
      url: `https://www.lostiempos.com${href}`,
      image: img?.startsWith("http") ? img : img ? `https://www.lostiempos.com${img}` : null,
      category: mapCategory(rawCategory),
      date: date || new Date().toISOString().slice(0, 10),
    });
  });

  const uniq = new Map();
  for (const it of items) if (!uniq.has(it.url)) uniq.set(it.url, it);
  return Array.from(uniq.values()).slice(0, 10);
}

async function scrapeElDeber() {
  const html = await fetchText("https://eldeber.com.bo");
  const $ = load(html);
  const items = [];

  $(".nota").each((_, el) => {
    const card = $(el);
    const href = card.find('a[href^="/"]').first().attr("href");
    const title = normalize(card.find(".nota__titulo-item").first().text());
    const cat = normalize(card.find(".nota__volanta").first().text());
    const snippet = normalize(card.find(".nota__introduccion").first().text()) || `${title.slice(0, 140)}...`;
    const image =
      card.find("img").first().attr("src") ||
      card.find("amp-img").first().attr("src") ||
      null;

    if (!href || title.length < 25) return;

    items.push({
      source: "El Deber",
      sourceUrl: "https://eldeber.com.bo",
      title,
      snippet,
      url: `https://eldeber.com.bo${href}`,
      image: image?.startsWith("http") ? image : image ? `https://eldeber.com.bo${image}` : null,
      category: mapCategory(cat),
      date: parseDateFromUrl(href) || new Date().toISOString().slice(0, 10),
    });
  });

  const uniq = new Map();
  for (const it of items) if (!uniq.has(it.url)) uniq.set(it.url, it);
  return Array.from(uniq.values()).slice(0, 12);
}

function parseRssDate(raw = "") {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

async function scrapeRss(source, feedUrl, sourceUrl) {
  const xml = await fetchText(feedUrl);
  const $ = load(xml, { xmlMode: true });
  const items = [];

  $("item").each((_, el) => {
    const item = $(el);
    const title = normalize(item.find("title").first().text());
    const url = normalize(item.find("link").first().text());
    const snippet = normalize(item.find("description").first().text().replace(/<[^>]+>/g, ""));
    const date = parseRssDate(item.find("pubDate").first().text());
    const rawCat = normalize(item.find("category").first().text());

    const mediaUrl =
      item.find("media\\:content").attr("url") ||
      item.find("media\\:thumbnail").attr("url") ||
      item.find("enclosure").attr("url") ||
      null;

    if (!title || !url) return;
    items.push({
      source,
      sourceUrl,
      title,
      snippet: snippet || `${title.slice(0, 130)}...`,
      url,
      image: mediaUrl,
      category: mapCategory(rawCat),
      date,
    });
  });

  return items.slice(0, 10);
}

async function main() {
  const [lt, ed, p7, op] = await Promise.all([
    scrapeLosTiempos(),
    scrapeElDeber(),
    scrapeRss("Página Siete", "https://www.paginasiete.bo/rss", "https://www.paginasiete.bo"),
    scrapeRss("Opinión", "https://www.opinion.com.bo/rss", "https://www.opinion.com.bo"),
  ]);

  const news = [...lt, ...ed, ...p7, ...op]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 36)
    .map((n) => ({ ...n, image: n.image || "https://images.unsplash.com/photo-1504711331083-9c895941bf81?w=1200&q=80" }));

  await mkdir("src/data", { recursive: true });
  await writeFile(
    "src/data/news.json",
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        sources: ["Los Tiempos", "El Deber", "Página Siete", "Opinión"],
        news,
      },
      null,
      2,
    ),
  );

  console.log(`✅ Scraped ${news.length} news items`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});