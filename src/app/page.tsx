"use client";

import React, { useState, ChangeEvent, KeyboardEvent } from 'react';

interface Song {
  id: string;
  metadata: {
    track_name: string;
    artist_name: string;
    genres: string[];  // Added genres array
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
    if (e.key === 'Enter' && !loading) {
      void searchSongs();
    }
  };

  const searchSongs = async (): Promise<void> => {
    const trimmedMood = mood.trim();
    if (!trimmedMood) return;
    
    setLoading(true);
    setError('');
    setSongs([]);
    
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mood: trimmedMood }),
      });

      if (!response.ok) {
        throw new Error('Failed to find matching songs');
      }

      const data = await response.json();
      
      if (!data.matches?.length) {
        throw new Error('No songs found for this mood');
      }

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
            disabled={loading}
            className="flex-1 px-0 py-2 bg-transparent border-b border-neutral-200 focus:outline-none focus:border-neutral-800 transition-all placeholder:text-neutral-400 disabled:opacity-50"
            aria-label="Mood input"
          />
          <button
            onClick={() => void searchSongs()}
            disabled={loading || !mood.trim()}
            className="px-4 py-2 text-sm border border-current hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors disabled:opacity-50"
          >
            {loading ? 'Finding matches...' : 'Find matches'}
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 border border-red-200 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {songs.length > 0 && (
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-sm uppercase tracking-widest">
                Songs matching your mood
              </h2>
              <p className="text-sm text-neutral-600">
                Based on your music taste, here are some fresh recommendations that match how you're feeling:
              </p>
            </div>
            <div className="space-y-2">
              {songs.map((song) => (
                <div
                  key={song.id}
                  className="py-4 px-4 border border-neutral-100 rounded-lg hover:border-neutral-200 transition-colors"
                >
                  <h3 className="font-medium mb-1">{song.metadata.track_name}</h3>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm text-neutral-600">
                      {song.metadata.artist_name}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {song.metadata.genres.map((genre, index) => (
                        <span
                          key={`${song.id}-genre-${index}`}
                          className="px-2 py-1 text-xs bg-neutral-100 text-neutral-600 rounded-full"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
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