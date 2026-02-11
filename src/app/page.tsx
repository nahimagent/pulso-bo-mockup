"use client";

import { useMemo, useState } from "react";
import newsData from "@/data/news.json";

type NewsItem = {
  source: string;
  sourceUrl: string;
  title: string;
  snippet: string;
  url: string;
  image: string;
  category: string;
  date: string;
};

const categories = ["Todo", "País", "Economía", "Deportes", "Tecnología", "Mundo"];

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("Todo");
  const [dark, setDark] = useState(false);

  const allNews = newsData.news as NewsItem[];

  const filtered = useMemo(() => {
    if (activeCategory === "Todo") return allNews;
    return allNews.filter((n) => n.category === activeCategory);
  }, [activeCategory, allNews]);

  const featured = filtered[0];
  const secondary = filtered.slice(1, 7);
  const more = filtered.slice(7);

  return (
    <div className={dark ? "dark" : ""}>
      <main className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
          <header className="mb-8 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Pulso Bolivia</p>
              <h1 className="text-xl font-bold md:text-3xl">Tu resumen inteligente de noticias</h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Actualizado: {new Date(newsData.updatedAt).toLocaleString("es-BO")}
              </p>
            </div>
            <button
              onClick={() => setDark((v) => !v)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {dark ? "☀️ Claro" : "🌙 Oscuro"}
            </button>
          </header>

          <section className="mb-6 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-500 to-sky-500 p-4 text-white shadow-lg md:p-6">
            <h2 className="text-lg font-semibold md:text-xl">Boletín de audio (placeholder)</h2>
            <p className="mt-1 text-sm text-emerald-50">Escucha un resumen diario con IA de las noticias más importantes de Bolivia.</p>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/15 p-3 backdrop-blur">
              <button className="rounded-full bg-white px-3 py-2 text-sm font-bold text-slate-900">▶︎</button>
              <div className="h-2 w-full rounded-full bg-white/40">
                <div className="h-2 w-1/3 rounded-full bg-white" />
              </div>
              <span className="text-xs font-medium">07:24</span>
            </div>
          </section>

          <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap ${
                  activeCategory === cat
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {featured && (
            <article className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <img src={featured.image} alt={featured.title} className="h-64 w-full object-cover md:h-80" />
              <div className="p-5 md:p-7">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-600">
                  {featured.category} · {featured.source}
                </p>
                <h2 className="text-2xl font-bold leading-tight md:text-3xl">{featured.title}</h2>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{featured.snippet}</p>
                <a
                  href={featured.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  Leer noticia
                </a>
              </div>
            </article>
          )}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {secondary.map((n) => (
              <article key={n.url} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <img src={n.image} alt={n.title} className="h-40 w-full object-cover" />
                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">{n.category} · {n.source}</p>
                  <h3 className="mt-1 text-base font-bold leading-tight">{n.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{n.snippet}</p>
                  <a href={n.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-emerald-600">
                    Ver más →
                  </a>
                </div>
              </article>
            ))}
          </section>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h4 className="mb-4 text-lg font-bold">Más titulares</h4>
            <div className="space-y-3">
              {more.map((n) => (
                <a
                  key={n.url}
                  href={n.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/80"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{n.source} · {n.category}</p>
                  <p className="font-semibold">{n.title}</p>
                </a>
              ))}
            </div>
          </section>

          <footer className="mt-8 text-center text-xs text-slate-500">
            Fuentes: {newsData.sources.join(", ")} · Prototipo visual de Pulso Bolivia.
          </footer>
        </div>
      </main>
    </div>
  );
}
