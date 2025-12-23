import { sql } from '@vercel/postgres';
import pdfParse from 'pdf-parse';

// Common words to filter
const commonWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'did', 'having', 'may', 'should', 'am']);

function lemmatize(word) {
  const rules = [
    { suffix: 'ies', replacement: 'y' },
    { suffix: 'es', replacement: 'e' },
    { suffix: 's', replacement: '' },
    { suffix: 'ed', replacement: '' },
    { suffix: 'ing', replacement: '' }
  ];
  
  for (const { suffix, replacement } of rules) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      return word.slice(0, -suffix.length) + replacement;
    }
  }
  return word;
}

async function fetchDefinition(word) {
  try {
    const response = await fetch(
      `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${word}?key=${process.env.MW_DICTIONARY_KEY}`
    );
    
    const data = await response.json();
    
    if (!data || data.length === 0 || typeof data[0] === 'string') {
      return null;
    }

    const entry = data[0];
    const definition = entry.shortdef?.[0] || 'No definition available';
    const pronunciation = entry.hwi?.prs?.[0]?.mw || entry.hwi?.hw || '';
    
    let audioUrl = null;
    if (entry.hwi?.prs?.[0]?.sound?.audio) {
      const audio = entry.hwi.prs[0].sound.audio;
      const subdir = audio.startsWith('bix') ? 'bix' :
                     audio.startsWith('gg') ? 'gg' :
                     audio[0].match(/[0-9]/) ? 'number' :
                     audio[0];
      audioUrl = `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdir}/${audio}.mp3`;
    }

    return { definition, pronunciation, audioUrl };
  } catch (error) {
    console.error(`Error fetching definition for ${word}:`, error);
    return null;
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, fileBuffer, fileType } = req.body;
    let content = text;

    // Handle PDF
    if (fileType === 'application/pdf' && fileBuffer) {
      const buffer = Buffer.from(fileBuffer, 'base64');
      const pdfData = await pdfParse(buffer);
      content = pdfData.text;
    }

    // Extract sentences
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    
    // Extract unique words with sentences
    const wordMap = new Map();
    
    for (const sentence of sentences) {
      const words = sentence.toLowerCase().match(/\b[a-z]+\b/g) || [];
      
      for (const word of words) {
        if (word.length > 3 && !commonWords.has(word)) {
          const baseForm = lemmatize(word);
          if (!wordMap.has(baseForm)) {
            wordMap.set(baseForm, sentence.trim());
          }
        }
      }
    }

    // Check existing words and add new ones
    const newWords = [];
    
    for (const [word, sentence] of wordMap) {
      const { rows } = await sql`
        SELECT word FROM words WHERE word = ${word}
      `;
      
      if (rows.length === 0) {
        const definition = await fetchDefinition(word);
        
        if (definition) {
          await sql`
            INSERT INTO words (word, definition, pronunciation, example_sentence, mw_audio_url)
            VALUES (${word}, ${definition.definition}, ${definition.pronunciation}, ${sentence}, ${definition.audioUrl})
          `;
          
          newWords.push(word);
        }
      }
    }

    res.status(200).json({ 
      message: 'Processing complete',
      newWordsCount: newWords.length,
      newWords 
    });
  } catch (error) {
    console.error('Error processing text:', error);
    res.status(500).json({ error: 'Failed to process text', details: error.message });
  }
}