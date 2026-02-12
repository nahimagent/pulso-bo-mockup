import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { ElevenLabsClient } from 'elevenlabs';
import OpenAI from 'openai';

dotenv.config();

const NEWS_FILE = path.join(process.cwd(), 'src/data/news.json');
const AUDIO_OUTPUT = path.join(process.cwd(), 'public/daily-briefing.mp3');

// Initialize clients
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY
});

// Check for OpenAI key (use process.env or fallback)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generateBriefing() {
  console.log('📰 Reading news data...');
  const newsData = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf-8'));
  
  // Take top 5 headlines (accessing the .news property)
  const headlines = newsData.news.slice(0, 5).map(n => n.title).join('\n');

  
  console.log('🤖 Generating script with OpenAI...');
  const prompt = `
    Act as a professional news anchor for "Pulso Bolivia".
    Summarize these top 5 headlines into a concise, engaging 30-45 second daily briefing script.
    Start with "Hola, bienvenidos a Pulso Bolivia. Estas son las noticias más importantes de hoy."
    End with "Mantente informado en Pulso Bolivia. Hasta mañana."
    Use a neutral, professional, yet warm tone suitable for a Bolivian audience.
    Do not use emojis or markdown, just plain text for TTS.
    
    Headlines:
    ${headlines}
  `;

  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4o-mini", // Cost-effective and fast
  });

  const script = completion.choices[0].message.content;
  console.log('📝 Generated Script:\n', script);

  console.log('🎙️ Converting to audio with ElevenLabs...');
  const audioBuffer = await elevenlabs.textToSpeech.convert(
    process.env.ELEVENLABS_VOICE_ID,
    {
      text: script,
      model_id: "eleven_multilingual_v2",
      output_format: "mp3_44100_128",
    }
  );

  console.log('💾 Saving audio file...');
  const fileStream = fs.createWriteStream(AUDIO_OUTPUT);
  
  // ElevenLabs returns a web ReadableStream in newer SDKs
  if (audioBuffer && typeof audioBuffer.pipe === 'function') {
      // Node Stream
      audioBuffer.pipe(fileStream);
  } else if (audioBuffer instanceof ReadableStream) {
      // Web ReadableStream
      for await (const chunk of audioBuffer) {
          fileStream.write(Buffer.from(chunk));
      }
      fileStream.end();
  } else {
      // Buffer/ArrayBuffer
      fs.writeFileSync(AUDIO_OUTPUT, Buffer.from(audioBuffer));
  }
  
  console.log(`✅ Audio saved to ${AUDIO_OUTPUT}`);
}

generateBriefing().catch(console.error);
