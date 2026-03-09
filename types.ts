
export interface AudioAnalysis {
  tempo: number;
  key: string;
  energy: string;
  mood: string;
  genre: string;
  instruments: string[];
  vocalType: string;
  dynamicRange: string;
}

export interface TimestampHighlight {
  timestamp: string;
  description: string;
  category: 'hook' | 'switch' | 'emotional';
}

export interface SEOData {
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  slug: string;
}

export interface Source {
  title: string;
  uri: string;
}

export interface SemanticSynergy {
  score: number; // 1-100
  analysis: string; // How lyrics/bio match the music
  keyThematicMatches: string[];
}

export interface MarketScore {
  overallScore: number;
  marketStatus: string;
  releaseConfidence: string;
  microCopy: string;
  breakdown: {
    genreMomentum: { score: number; signal: string; insight: string };
    platformFit: { score: number; platforms: { name: string; stars: number }[]; insight: string };
    marketDifferentiation: { score: number; insight: string };
    longevityVsVirality: { profile: string; score: number; insight: string };
    releaseTiming: { score: number; signal: string; insight: string };
    audienceDiscovery: { primaryPath: string; insight: string };
    brandAlignment: { score: number; insight: string };
  };
  finalSummary: string;
  recommendations: { focus: string[]; avoid: string[] };
}

export interface Review {
  id: string;
  songTitle: string;
  artistName: string;
  imageUrl: string;
  headline: string;
  hook: string;
  isPublished?: boolean;
  breakdown: {
    production: string;
    instrumentation: string;
    vocals: string;
    lyrics: string;
    structure: string;
    emotionalImpact: string;
  };
  soundsLike: string[];
  bestMoment: {
    timestamp: string;
    description: string;
  };
  whoIsItFor: string;
  rating: number;
  analysis: AudioAnalysis;
  semanticSynergy: SemanticSynergy;
  timestampHighlights: TimestampHighlight[];
  pullQuotes: string[];
  seo: SEOData;
  marketScore: MarketScore;
  createdAt: string;
  similarSongs: { title: string; artist: string; reason: string }[];
  playlistIdeas: string[];
  sources: Source[];
  userId?: string; // Reference to the user who submitted it
  podcastAudio?: string; // Base64 encoded podcast audio
  hasPodcast?: boolean; // Whether a podcast has been generated
  songAudio?: string; // Base64 encoded original song audio for background
}

export interface MagazineArticle {
  id: string;
  title: string;
  subtitle: string;
  content: string;
  imageUrl: string;
  author: string;
  category: string;
  readTime: string;
  createdAt: string;
  slug: string;
  isFeatured?: boolean;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  description: string;
  audioUrl: string;
  imageUrl: string;
  duration: string;
  playCount: number;
  createdAt: string;
  guest?: string;
  tags: string[];
}

export interface SubmissionData {
  audioFile: File;
  featuredPhoto?: File;
  trackName: string;
  artistName: string;
  lyrics?: string;
  bio?: string;
  stylePreset?: 'dark' | 'minimal' | 'high-contrast';
}

export interface Invoice {
  id: string;
  date: string;
  amount: string;
  status: 'Paid' | 'Pending';
  plan: string;
}

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  credits: number;
  isSubscribed: boolean;
  history: Review[];
  invoices: Invoice[];
  password?: string; 
  role: 'admin' | 'user';
  mfaEnabled?: boolean;
}

export type AppView = 'landing' | 'review' | 'dashboard' | 'pricing' | 'magazine' | 'podcasts' | 'auth' | 'account' | 'admin' | 'privacy' | 'terms' | 'faq' | 'contact' | 'guide';
