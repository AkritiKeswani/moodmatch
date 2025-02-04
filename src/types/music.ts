// src/types/music.ts
export interface SearchRequestBody {
    mood: string;
  }
  
  export interface SongMetadata {
    track_name: string;
    artist_name: string;
    spotify_id?: string;
    album?: string;
    preview_url?: string;
  }
  
  export interface Song {
    id: string;
    score: number;
    metadata: SongMetadata;
  }
  
  export interface SearchResponse {
    matches: Song[];
  }
  
  export type SearchError = {
    message: string;
    code?: string;
  }