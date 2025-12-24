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
