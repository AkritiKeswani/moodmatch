import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;

interface SpotifyTrack {
  uri: string;
  name: string;
  artists: Array<{
    uri: string;
    name: string;
  }>;
  album: {
    uri: string;
    name: string;
  };
  duration_ms: number;
  popularity: number;
}

interface AirbyteRecord {
  stream: string;
  data: {
    track: SpotifyTrack;
    added_at: string;
    artist_genres?: string[];  // From Airbyte's artist data
    audio_features?: {
      danceability: number;
      energy: number;
      key: number;
      loudness: number;
      mode: number;
      speechiness: number;
      acousticness: number;
      instrumentalness: number;
      liveness: number;
      valence: number;
      tempo: number;
    };
  };
}

async function getMistralEmbedding(text: string) {
  if (!TOGETHER_API_KEY) {
    throw new Error('TOGETHER_API_KEY is not set in .env.local');
  }

  try {
    const response = await fetch("https://api.together.xyz/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TOGETHER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "togethercomputer/m2-bert-80M-8k-base",
        input: text
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${await response.text()}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error("Error in getMistralEmbedding:", error);
    throw error;
  }
}

async function processAirbyteRecord(record: AirbyteRecord, index: any) {
  const { track, artist_genres, audio_features } = record.data;
  
  // Format the track data for embedding
  const trackText = `
name: ${track.name}
artists: ${track.artists.map(a => `name: ${a.name}`).join(', ')}
album: ${track.album.name}
genres: ${artist_genres?.join(', ') || 'unknown'}
audio_features: {
  tempo: ${audio_features?.tempo || 'unknown'}
  energy: ${audio_features?.energy || 'unknown'}
  valence: ${audio_features?.valence || 'unknown'}
  danceability: ${audio_features?.danceability || 'unknown'}
  acousticness: ${audio_features?.acousticness || 'unknown'}
  instrumentalness: ${audio_features?.instrumentalness || 'unknown'}
}
`.trim();

  try {
    // Get embedding for the track
    const embedding = await getMistralEmbedding(trackText);

    // Upsert to Pinecone
    await index.upsert([{
      id: track.uri,
      values: embedding,
      metadata: {
        text: trackText,
        name: track.name,
        artists: track.artists.map(a => a.name),
        album: track.album.name,
        genres: artist_genres || [],
        audio_features,
        added_at: record.data.added_at
      }
    }]);

    console.log(`Successfully ingested: ${track.name} by ${track.artists[0].name}`);
  } catch (error) {
    console.error(`Error ingesting ${track.name}:`, error);
  }
}

async function main() {
  if (!process.env.PINECONE_INDEX_NAME) {
    throw new Error('PINECONE_INDEX_NAME is not set in .env.local');
  }

  const pinecone = new Pinecone();
  const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);

  // Read Airbyte JSON records from stdin
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  for await (const line of rl) {
    try {
      const record: AirbyteRecord = JSON.parse(line);
      if (record.stream === 'saved_tracks') {
        await processAirbyteRecord(record, index);
      }
    } catch (error) {
      console.error('Error processing record:', error);
    }
  }
}

main().catch(console.error);