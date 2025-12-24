// ============================================
// api/get-words.js
// ============================================
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { 
  ssl: 'require',
  max: 1 
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rows = await sql`
      SELECT 
        word, 
        definition, 
        pronunciation, 
        date_added 
      FROM words 
      ORDER BY word ASC
    `;

    res.status(200).json({ words: rows });
  } catch (error) {
    console.error('Error fetching words:', error);
    res.status(500).json({ error: 'Failed to fetch words' });
  }
}

// ============================================
// api/get-word.js
// ============================================
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { 
  ssl: 'require',
  max: 1 
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { word } = req.query;

  if (!word) {
    return res.status(400).json({ error: 'Word parameter required' });
  }

  try {
    const rows = await sql`
      SELECT * FROM words WHERE word = ${word}
    `;

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Word not found' });
    }

    res.status(200).json({ word: rows[0] });
  } catch (error) {
    console.error('Error fetching word:', error);
    res.status(500).json({ error: 'Failed to fetch word' });
  }
}

// ============================================
// api/delete-word.js
// ============================================
import postgres from 'postgres';
import { del } from '@vercel/blob';

const sql = postgres(process.env.DATABASE_URL, { 
  ssl: 'require',
  max: 1 
});

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { word } = req.query;

  if (!word) {
    return res.status(400).json({ error: 'Word parameter required' });
  }

  try {
    // Get media URLs before deleting
    const rows = await sql`
      SELECT user_image_url, user_audio_url 
      FROM words 
      WHERE word = ${word}
    `;

    if (rows.length > 0) {
      const { user_image_url, user_audio_url } = rows[0];

      // Delete media from blob storage if exists
      if (user_image_url) {
        try {
          await del(user_image_url);
        } catch (e) {
          console.error('Error deleting image:', e);
        }
      }
      if (user_audio_url) {
        try {
          await del(user_audio_url);
        } catch (e) {
          console.error('Error deleting audio:', e);
        }
      }
    }

    // Delete from database
    await sql`DELETE FROM words WHERE word = ${word}`;

    res.status(200).json({ message: 'Word deleted successfully' });
  } catch (error) {
    console.error('Error deleting word:', error);
    res.status(500).json({ error: 'Failed to delete word' });
  }
}

// ============================================
// api/export-csv.js
// ============================================
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, { 
  ssl: 'require',
  max: 1 
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rows = await sql`
      SELECT 
        word,
        definition,
        pronunciation,
        example_sentence,
        date_added
      FROM words
      ORDER BY word ASC
    `;

    // Generate CSV
    const headers = ['Word', 'Definition', 'Pronunciation', 'Example Sentence', 'Date Added'];
    const csvRows = rows.map(row => [
      row.word,
      row.definition,
      row.pronunciation,
      row.example_sentence,
      new Date(row.date_added).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell || ''}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="vocabulary_${new Date().toISOString().split('T')[0]}.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
}

// ============================================
// api/process-text.js
// ============================================
import postgres from 'postgres';
import pdfParse from 'pdf-parse';

const sql = postgres(process.env.DATABASE_URL, { 
  ssl: 'require',
  max: 1 
});

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
      const rows = await sql`
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

// ============================================
// api/fetch-definition.js
// ============================================
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { word } = req.query;
  
  if (!word) {
    return res.status(400).json({ error: 'Word parameter required' });
  }

  try {
    const response = await fetch(
      `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${word}?key=${process.env.MW_DICTIONARY_KEY}`
    );
    
    const data = await response.json();
    
    if (!data || data.length === 0 || typeof data[0] === 'string') {
      return res.status(404).json({ error: 'Word not found' });
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

    res.status(200).json({ definition, pronunciation, audioUrl });
  } catch (error) {
    console.error('Error fetching definition:', error);
    res.status(500).json({ error: 'Failed to fetch definition' });
  }
}

// ============================================
// api/upload-media.js
// ============================================
import postgres from 'postgres';
import { put } from '@vercel/blob';

const sql = postgres(process.env.DATABASE_URL, { 
  ssl: 'require',
  max: 1 
});

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
    const { word, mediaType, fileData, fileName } = req.body;

    // Upload to Vercel Blob Storage
    const buffer = Buffer.from(fileData, 'base64');
    const blob = await put(fileName, buffer, {
      access: 'public',
    });

    // Update database
    if (mediaType === 'image') {
      await sql`UPDATE words SET user_image_url = ${blob.url} WHERE word = ${word}`;
    } else {
      await sql`UPDATE words SET user_audio_url = ${blob.url} WHERE word = ${word}`;
    }

    res.status(200).json({ url: blob.url });
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ error: 'Failed to upload media', details: error.message });
  }
}
