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

    console.log('Mood received:', mood);

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: mood,
    });

    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
    
    const queryResponse = await index.query({
      vector: embeddingResponse.data[0].embedding,
      topK: 5,
      includeMetadata: true,
    });

    // Parse matches with correct artist extraction
    const matches = queryResponse.matches.map((match) => {
      const metadata = match.metadata || {};
      const textContent = metadata.text || '';
      
      // Get song name from metadata
      const nameMatch = textContent.match(/^name: ([^\n]+)/);
      const trackName = nameMatch ? nameMatch[1] : metadata.name || 'Unknown Track';
      
      // Get artist name after "artists:" section
      const artistMatch = textContent.match(/artists:[\s\S]*?name: ([^\n]+)/);
      const artistName = artistMatch ? artistMatch[1] : 'Unknown Artist';

      return {
        id: match.id,
        score: match.score ?? 0,
        metadata: {
          track_name: trackName,
          artist_name: artistName
        }
      };
    });

    // Format songs for GPT context
    const songsContext = matches.map(match => 
      `"${match.metadata.track_name}" by ${match.metadata.artist_name}`
    ).join(', ');

    // Get AI explanation of mood matches
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a music recommendation expert. Analyze the songs and explain why they match the user's mood."
        },
        {
          role: "user",
          content: `I'm feeling ${mood}. You found these songs that might match: ${songsContext}. 
          Explain why these songs match my mood and rank them from best to worst match. Keep it concise but insightful.`
        }
      ],
      temperature: 0.7,
    });

    return NextResponse.json({ 
      matches,
      explanation: completion.choices[0].message.content 
    });

  } catch (error) {
    console.error('Detailed error:', error);
    return NextResponse.json(
      { message: 'An unexpected error occurred', error: String(error) },
      { status: 500 }
    );
  }
}