import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone();

// Mood keyword reference for emotional context
const moodKeywords = {
  energetic: ['Upbeat', 'Lively', 'Energetic', 'Exuberant', 'Bouncy', 'Enthusiastic', 'Pumped', 'Frantic'],
  calm: ['Relaxed', 'Peaceful', 'Soothing', 'Mellow', 'Tranquil', 'Serene', 'Chill', 'Dreamy'],
  happy: ['Joyful', 'Cheerful', 'Uplifting', 'Optimistic', 'Playful', 'Carefree', 'Lighthearted', 'Feel-good'],
  sad: ['Melancholic', 'Somber', 'Gloomy', 'Wistful', 'Heartbroken', 'Nostalgic', 'Pensive', 'Bittersweet'],
  intense: ['Passionate', 'Dramatic', 'Intense', 'Powerful', 'Epic', 'Fierce', 'Angry', 'Aggressive'],
  introspective: ['Reflective', 'Thoughtful', 'Introspective', 'Contemplative', 'Meditative', 'Soulful', 'Deep', 'Ethereal'],
  romantic: ['Sensual', 'Intimate', 'Romantic', 'Tender', 'Heartfelt', 'Warm', 'Loving', 'Sentimental']
};

function parseTrackMetadata(text: string) {
  const lines = text.split('\n');
  const metadata: Record<string, any> = {};
  
  // First pass: collect basic metadata
  for (const line of lines) {
    if (line.includes(': ')) {
      const [key, ...valueParts] = line.split(': ');
      const value = valueParts.join(': ').trim();
      metadata[key.trim()] = value;
    }
  }

  // Get artist and album info
  let artist = metadata.artist || 'Unknown Artist';
  let album = metadata.album || 'Unknown Album';
  
  // Look for nested artist info
  const artistLines = lines.filter(line => line.includes('artist": {'));
  if (artistLines.length > 0) {
    const artistIdx = lines.indexOf(artistLines[0]);
    for (let i = artistIdx; i < lines.length; i++) {
      if (lines[i].includes('name": "')) {
        artist = lines[i].split('name": "')[1].replace(/[",]/g, '').trim();
        break;
      }
    }
  }

  // Look for nested album info
  const albumLines = lines.filter(line => line.includes('album": {'));
  if (albumLines.length > 0) {
    const albumIdx = lines.indexOf(albumLines[0]);
    for (let i = albumIdx; i < lines.length; i++) {
      if (lines[i].includes('name": "')) {
        album = lines[i].split('name": "')[1].replace(/[",]/g, '').trim();
        break;
      }
    }
  }

  return {
    name: metadata.name || 'Unknown Track',
    artist,
    album,
    popularity: parseInt(metadata.popularity) || 0,
    preview_url: metadata.preview_url === 'None' ? null : metadata.preview_url,
    uri: metadata.uri
  };
}

export async function POST(req: NextRequest) {
  try {
    const { mood } = await req.json();
    console.log('1. Received mood:', mood);

    if (!mood?.trim()) {
      return NextResponse.json(
        { message: 'No mood provided' },
        { status: 400 }
      );
    }

    // Create mood context with keywords
    const moodContext = `Find songs that match this emotional mood or feeling: ${mood}. 
    If the mood is "happy", consider keywords like joyful, upbeat, cheerful, energetic.
    If the mood is "sad", consider keywords like melancholic, somber, downbeat, blue.
    If the mood is "relaxed", consider keywords like calm, peaceful, tranquil, serene.
    If the mood is "energetic", consider keywords like dynamic, lively, vigorous, powerful.
    If the mood is "romantic", consider keywords like passionate, tender, intimate, loving.
    
    Consider musical elements like tempo, energy, instrumentation, and emotional resonance 
    that would create this feeling.`;

    // Get embedding for mood
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: moodContext,
    });

    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
    
    // Query similar songs from user's library
    const queryResponse = await index.query({
      vector: embeddingResponse.data[0].embedding,
      topK: 3,
      includeMetadata: true,
    });

    // Process matched songs
    const matchedSongs = queryResponse.matches.map(match => {
      const parsedMetadata = parseTrackMetadata(match.metadata?.text || '');
      
      return {
        name: parsedMetadata.name,
        artist: parsedMetadata.artist,
        album: parsedMetadata.album,
        popularity: parsedMetadata.popularity,
        score: match.score,
        preview_url: parsedMetadata.preview_url,
        uri: parsedMetadata.uri
      };
    });

    // Create analysis prompt
    const analysisPrompt = `The user is feeling "${mood}".

    These songs from their music library match this mood:
    ${matchedSongs.map(song => `
    "${song.name}" by ${song.artist}
    Album: ${song.album}
    Popularity: ${song.popularity}
    Similarity: ${(song.score * 100).toFixed(1)}%
    `).join('\n')}

    What musical elements make these songs appropriate for a ${mood} mood?
    Consider tempo, key, instrumentation, vocal style, and emotional qualities.`;

    const analysis = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a music expert who understands how musical elements create emotional responses."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ]
    });

    // Get recommendations based on analysis
    const recommendationPrompt = `Based on this analysis of what creates a ${mood} mood:
    ${analysis.choices[0].message.content}

    The user enjoys these songs:
    ${matchedSongs.map(song => `- ${song.name} by ${song.artist}`).join('\n')}

    Recommend 5 different songs that:
    1. Share similar musical characteristics
    2. Match the ${mood} mood
    3. Are from different artists and genres
    4. Would be fresh discoveries for someone who enjoys these songs

    Format each recommendation as:
    Song Title - Artist - Genre1, Genre2

    Don't include numbering or quotes in the song titles.`;

    const recommendations = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a music recommendation expert. Suggest songs based on musical patterns and user preferences."
        },
        {
          role: "user",
          content: recommendationPrompt
        }
      ]
    });

    // Process recommendations
    const songs = recommendations.choices[0].message.content
      ?.split('\n')
      .filter(line => line.trim())
      .map((line, index) => {
        const parts = line.split('-').map(s => s.trim());
        
        return {
          id: `rec_${index}`,
          metadata: {
            track_name: parts[0],
            artist_name: parts[1],
            genres: parts[2]?.split(',').map(g => g.trim()) || ['Genre Unknown']
          }
        };
      });

    return NextResponse.json({ 
      matches: songs,
      sourceSongs: matchedSongs
    });

  } catch (error) {
    console.error('Error in route:', error);
    return NextResponse.json(
      { message: 'An unexpected error occurred', error: String(error) },
      { status: 500 }
    );
  }
}