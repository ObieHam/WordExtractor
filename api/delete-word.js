import { sql } from '@vercel/postgres';
import { del } from '@vercel/blob';

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
    const { rows } = await sql`
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