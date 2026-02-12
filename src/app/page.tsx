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

const categories = ["Todo", "Santa Cruz", "País", "Economía", "Deportes", "Tecnología", "Mundo"];

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("Todo");
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const allNews = newsData.news as NewsItem[];

  // Time ago helper
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    if (hours > 24) return new Date(dateStr).toLocaleDateString("es-BO");
    if (hours > 0) return `hace ${hours}h`;
    return `hace ${mins}m`;
  };

  // Browser TTS for individual news
  const speakNews = (text: string, url: string) => {
    if (playingUrl === url) {
      window.speechSynthesis.cancel();
      setPlayingUrl(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.onend = () => setPlayingUrl(null);
    window.speechSynthesis.speak(utterance);
    setPlayingUrl(url);
  };

  const filtered = useMemo(() => {
    if (activeCategory === "Todo") return allNews;
    return allNews.filter((n) => n.category === activeCategory);
  }, [activeCategory, allNews]);

  const featured = filtered[0];
  const secondary = filtered.slice(1, 7);
  const more = filtered.slice(7);

  return (
    <div className="">
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
          <header className="mb-8 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Pulso Bolivia</p>
              <h1 className="text-xl font-bold md:text-3xl text-slate-900">Tu resumen inteligente de noticias</h1>
              <p className="mt-1 text-xs text-slate-500">
                Actualizado: {new Date(newsData.updatedAt).toLocaleString("es-BO")}
              </p>
            </div>
            {/* Dark mode removed for cleaner pro look */}
          </header>

          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900">
                  🎙️ Resumen Diario
                </h2>
                <p className="mt-1 text-slate-500 text-sm">
                  Las noticias más importantes de la jornada en audio.
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 w-full md:w-auto min-w-[300px]">
                 <audio controls className="w-full h-10 accent-slate-900">
                    <source src="./daily-briefing.mp3" type="audio/mpeg" />
                    Tu navegador no soporta el elemento de audio.
                 </audio>
              </div>
            </div>
          </section>



          <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? "bg-emerald-600 text-white shadow-md"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {featured && (
            <article className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              <div className="relative h-64 md:h-80 w-full bg-slate-100">
                  <img 
                    src={featured.image ? `https://images.weserv.nl/?url=${encodeURIComponent(featured.image)}&output=webp&w=800` : "https://images.unsplash.com/photo-1529243856184-4f8bc556cf0d?w=800&q=80"} 
                    alt={featured.title} 
                    className="h-full w-full object-cover"
                    onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1529243856184-4f8bc556cf0d?w=800&q=80"}
                  />
                  <div className="absolute top-4 left-4 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-slate-900 shadow-sm">
                    {timeAgo(featured.date)}
                  </div>
              </div>
              <div className="p-5 md:p-7">
                <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                      {featured.category} · {featured.source}
                    </p>
                    <button 
                      onClick={() => speakNews(featured.title + ". " + featured.snippet, featured.url)}
                      className={`text-xl hover:scale-110 transition-transform ${playingUrl === featured.url ? "animate-pulse text-emerald-600" : "text-slate-400"}`}
                      title="Escuchar noticia"
                    >
                      {playingUrl === featured.url ? "🔊" : "🔈"}
                    </button>
                </div>
                <h2 className="text-2xl font-bold leading-tight md:text-3xl text-slate-900">{featured.title}</h2>
                <p className="mt-3 text-sm text-slate-600 line-clamp-3">{featured.snippet}</p>
                <a
                  href={featured.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
                >
                  Leer completa
                </a>
              </div>
            </article>
          )}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {secondary.map((n) => (
              <article key={n.url} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
                <div className="relative h-48 w-full bg-slate-100">
                   <img 
                      src={n.image ? `https://images.weserv.nl/?url=${encodeURIComponent(n.image)}&output=webp&w=600` : "https://images.unsplash.com/photo-1529243856184-4f8bc556cf0d?w=600&q=80"} 
                      alt={n.title} 
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1529243856184-4f8bc556cf0d?w=600&q=80"}
                   />
                   <div className="absolute top-2 right-2 rounded bg-white/95 px-2 py-1 text-[10px] font-bold text-slate-900 shadow-sm">
                      {timeAgo(n.date)}
                   </div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">{n.category} · {n.source}</p>
                      <button 
                        onClick={() => speakNews(n.title, n.url)}
                        className={`text-lg hover:text-emerald-500 transition-colors ${playingUrl === n.url ? "text-emerald-500 animate-pulse" : "text-slate-300"}`}
                      >
                        {playingUrl === n.url ? "🔊" : "🔈"}
                      </button>
                  </div>
                  <h3 className="mt-1 text-base font-bold leading-tight text-slate-900 line-clamp-3 group-hover:text-emerald-700 transition-colors">{n.title}</h3>
                  <a href={n.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-semibold text-emerald-600 hover:underline">
                    Ver más →
                  </a>
                </div>
              </article>
            ))}
          </section>


          <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h4 className="mb-4 text-lg font-bold text-slate-900">Más titulares</h4>
            <div className="space-y-3">
              {more.map((n) => (
                <a
                  key={n.url}
                  href={n.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-emerald-200 hover:shadow-sm"
                >
                  <div className="flex justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{n.source} · {n.category}</p>
                    <span className="text-xs text-slate-400">{timeAgo(n.date)}</span>
                  </div>
                  <p className="mt-1 font-semibold text-slate-800">{n.title}</p>
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
