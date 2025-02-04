"use client";

import React, { useState, ChangeEvent, KeyboardEvent } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Song {
  id: string;
  score: number;
  metadata: {
    track_name: string;
    artist_name: string;
  };
}

export default function Home() {
  const [mood, setMood] = useState<string>('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleMoodChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setMood(e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      void searchSongs();
    }
  };

  const searchSongs = async (): Promise<void> => {
    if (!mood.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mood }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch songs');
      }

      const data = await response.json();
      setSongs(data.matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-center">MOODMATCH</h1>
      
      <div className="space-y-6">
        <div className="flex gap-4">
          <input
            type="text"
            value={mood}
            onChange={handleMoodChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter your mood (e.g., energetic, mellow, peaceful)"
            className="flex-1 p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Mood input"
          />
          <button
            onClick={() => void searchSongs()}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Find Songs'}
          </button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {songs.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Recommended Songs</h2>
            <div className="grid gap-4">
              {songs.map((song) => (
                <div
                  key={song.id}
                  className="p-4 rounded-lg border border-gray-200 hover:border-blue-500 transition-colors"
                >
                  <h3 className="font-medium">{song.metadata.track_name}</h3>
                  <p className="text-gray-600">{song.metadata.artist_name}</p>
                  <p className="text-sm text-gray-500">
                    Match score: {(song.score * 100).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}