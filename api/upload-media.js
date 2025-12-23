import { sql } from '@vercel/postgres';
import { put } from '@vercel/blob';

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
    const column = mediaType === 'image' ? 'user_image_url' : 'user_audio_url';
    
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