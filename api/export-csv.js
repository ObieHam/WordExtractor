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
