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
