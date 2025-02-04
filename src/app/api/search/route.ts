import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mood } = body;

    if (!mood) {
      return NextResponse.json(
        { message: 'No mood provided' },
        { status: 400 }
      );
    }

    // Generate embedding for the mood
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: mood,
    });

    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
    
    // Query Pinecone with the embedding
    const queryResponse = await index.query({
      vector: embeddingResponse.data[0].embedding,
      topK: 5,
      includeMetadata: true,
    });

    const matches = queryResponse.matches.map((match) => {
      // Get name and artist from top-level metadata properties if they exist
      const name = match.metadata?.name || 'Unknown Track';
      let artist = 'Unknown Artist';

      // Parse the text field to find artist info
      const textContent = match.metadata?.text || '';
      if (textContent) {
        const artistMatch = textContent.match(/name: (Death Cab for Cutie)/);
        if (artistMatch) {
          artist = artistMatch[1];
        }
      }

      return {
        id: match.id,
        score: match.score ?? 0,
        metadata: {
          track_name: name,
          artist_name: artist
        }
      };
    });

    return NextResponse.json({ matches });
  } catch (error) {
    console.error('Detailed error:', error);
    return NextResponse.json(
      { message: 'An unexpected error occurred', error: String(error) },
      { status: 500 }
    );
  }
}