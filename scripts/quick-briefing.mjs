import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { ElevenLabsClient } from 'elevenlabs';
import OpenAI from 'openai';

dotenv.config();

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function textToSpeech(text, outputPath) {
  try {
    const audioBuffer = await elevenlabs.textToSpeech.convert(
      "2yObP7Hz8Q6WBwVXpKyy", // Voice ID: Nahim
      {
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
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

async function main() {
  const news = JSON.parse(fs.readFileSync('src/data/news.json', 'utf-8')).news;
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

  console.log('📝 Generating script...');
  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4o",
  });

  const script = completion.choices[0].message.content;
  console.log('🎙️ Generating audio (briefing-nahim.mp3)...');
  await textToSpeech(script, path.join(PUBLIC_DIR, 'briefing-nahim.mp3'));
  console.log('✅ Done.');
}

main().catch(console.error);
