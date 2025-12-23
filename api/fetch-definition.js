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