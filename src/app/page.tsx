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
    <main className="min-h-screen px-4 py-16 max-w-xl mx-auto">
      <h1 className="text-3xl font-normal tracking-tighter mb-16 text-center">
        MOODMATCH
      </h1>
      
      <div className="space-y-12">
        <div className="flex flex-col gap-4 sm:flex-row">
          <input
            type="text"
            value={mood}
            onChange={handleMoodChange}
            onKeyDown={handleKeyDown}
            placeholder="How are you feeling?"
            className="flex-1 px-0 py-2 bg-transparent border-b border-neutral-200 focus:outline-none focus:border-neutral-800 transition-all placeholder:text-neutral-400"
            aria-label="Mood input"
          />
          <button
            onClick={() => void searchSongs()}
            disabled={loading}
            className="px-4 py-2 text-sm border border-current hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 border border-neutral-200 text-sm">
            {error}
          </div>
        )}

        {songs.length > 0 && (
          <div className="space-y-8">
            <h2 className="text-sm uppercase tracking-widest">Matches</h2>
            <div className="space-y-2">
              {songs.map((song) => (
                <div
                  key={song.id}
                  className="py-4 border-b border-neutral-100 last:border-0"
                >
                  <h3 className="font-medium mb-1">{song.metadata.track_name}</h3>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-neutral-600">{song.metadata.artist_name}</span>
                    <span className="text-neutral-400">
                      {(song.score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}