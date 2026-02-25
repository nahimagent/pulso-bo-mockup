import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { ElevenLabsClient } from 'elevenlabs';
import OpenAI from 'openai';
import { createHash } from 'crypto';

dotenv.config();

const NEWS_FILE = path.join(process.cwd(), 'src/data/news.json');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const AUDIO_DIR = path.join(PUBLIC_DIR, 'audio');

// Ensure audio dir exists
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function textToSpeech(text, outputPath) {
  try {
    const audioBuffer = await elevenlabs.textToSpeech.convert(
      process.env.ELEVENLABS_VOICE_ID,
      {
        text: text,
        model_id: "eleven_multilingual_v2",
        output_format: "mp3_44100_128",
      }
    );
    
    // Handle stream vs buffer
    if (audioBuffer && typeof audioBuffer.pipe === 'function') {
        const fileStream = fs.createWriteStream(outputPath);
        audioBuffer.pipe(fileStream);
        await new Promise((resolve) => fileStream.on('finish', resolve));
    } else if (audioBuffer instanceof ReadableStream) {
        const fileStream = fs.createWriteStream(outputPath);
        for await (const chunk of audioBuffer) {
            fileStream.write(Buffer.from(chunk));
        }
        fileStream.end();
    } else {
        fs.writeFileSync(outputPath, Buffer.from(audioBuffer));
    }
    return true;
  } catch (error) {
    console.error("❌ Error generating audio:", error.message);
    return false;
  }
}

async function generateMainBriefing(news) {
  console.log('🎙️ Generating Main Briefing...');
  const headlines = news.slice(0, 6).map(n => n.title).join('\n');
  
  const prompt = `
    Eres un periodista serio y directo de "Pulso Bolivia".
    Genera un guion de audio EXTENSO y DETALLADO de aproximadamente 5 MINUTOS (unas 800-900 palabras).
    Analiza a profundidad las noticias principales, dando contexto, causas y consecuencias.
    
    ESTRUCTURA OBLIGATORIA:
    1. NO SALUDES. Empieza directo con el tema más fuerte.
    2. Desarrolla las 3 noticias más importantes con mucho detalle (quién, qué, por qué).
    3. Agrupa las noticias secundarias por bloques (Economía, Política, Sociedad).
    4. Tono: Periodístico de análisis profundo, serio pero dinámico.
    5. Usa conectores fluidos entre temas.
    
    Noticias:
    ${headlines}
  `;

  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4o",
  });

  const script = completion.choices[0].message.content;
  console.log('📝 Main Script:', script.slice(0, 50) + '...');
  await textToSpeech(script, path.join(PUBLIC_DIR, 'briefing-long.mp3'));
}

async function generateIndividualNews(newsItems) {
  console.log('🎙️ Generating Individual News Audios...');
  const updatedNews = [];

  for (const item of newsItems) {
    // Generate a unique ID for the file based on URL
    const id = createHash('md5').update(item.url).digest('hex').slice(0, 8);
    const fileName = `news-${id}.mp3`;
    const filePath = path.join(AUDIO_DIR, fileName);
    const publicUrl = `/audio/${fileName}`;

    // Optimization: Check if file exists to save credits (optional, but good for dev)
    // For now, we regenerate to ensure new voice/style is applied.
    
    // Generate concise summary script
    const prompt = `
      Resume esta noticia en 2 frases claras y concisas para ser leída en radio.
      Usa un tono profesional boliviano.
      Título: ${item.title}
      Contexto: ${item.snippet}
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4o-mini",
    });

    const script = completion.choices[0].message.content;
    console.log(`   🔸 Processing: ${item.title.slice(0, 20)}...`);
    
    const success = await textToSpeech(script, filePath);
    
    updatedNews.push({
      ...item,
      audioUrl: success ? publicUrl : null
    });
  }
  return updatedNews;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf-8'));
  const allNews = data.news;

  // 1. Generate Main Briefing
  await generateMainBriefing(allNews);

  // 2. Generate Individual Audios (Top 20 to save credits/time)
  const processedNews = await generateIndividualNews(allNews.slice(0, 20));
  
  // Keep the rest without audio if any
  const finalNews = [...processedNews, ...allNews.slice(20)];

  // 3. Save updated JSON
  data.news = finalNews;
  fs.writeFileSync(NEWS_FILE, JSON.stringify(data, null, 2));
  console.log('✅ All audio generated and data updated.');
}

main().catch(console.error);
