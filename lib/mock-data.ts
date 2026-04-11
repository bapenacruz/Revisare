// Central mock data — replace with real API calls in later steps.

export const CATEGORIES = [
  { id: "politics",              label: "Politics",                emoji: "🏛️", description: "Power, policy, and the direction of society",            debateCount: 0 },
  { id: "science-tech",          label: "Science & Technology",    emoji: "🔬", description: "Innovation, discovery, and the future we're building",    debateCount: 0 },
  { id: "philosophy",            label: "Philosophy",              emoji: "🧠", description: "Ethics, logic, and life's biggest questions",             debateCount: 0 },
  { id: "religion",              label: "Religion",                emoji: "✝️", description: "Belief, faith, and the meaning of existence",             debateCount: 0 },
  { id: "economics",             label: "Economics",               emoji: "📈", description: "Money, markets, and how the world works",                 debateCount: 0 },
  { id: "society",               label: "Society",                 emoji: "🌍", description: "Culture, norms, and how we live together",                debateCount: 0 },
  { id: "sports",                label: "Sports",                  emoji: "⚽", description: "Competition, performance, and the games we love",         debateCount: 0 },
  { id: "history",               label: "History",                 emoji: "📜", description: "The past, its lessons, and its impact today",             debateCount: 0 },
  { id: "environment",           label: "Environment",             emoji: "🌿", description: "Climate, sustainability, and our planet's future",        debateCount: 0 },
  { id: "culture-entertainment", label: "Culture & Entertainment", emoji: "🎬", description: "Movies, music, games, and what we consume",              debateCount: 0 },
  { id: "law-justice",           label: "Law & Justice",           emoji: "⚖️", description: "Rights, rules, and what's fair",                         debateCount: 0 },
  { id: "health-lifestyle",      label: "Health & Lifestyle",      emoji: "🏃", description: "Well-being, habits, and how we live day to day",         debateCount: 0 },
];

export const LIVE_DEBATES = [
  {
    id: "d1",
    motion: "AI will cause more harm than good to employment by 2035",
    category: "Science & Tech",
    participants: [
      { username: "tekwolf", avatarInitial: "T", elo: 1842 },
      { username: "clarity_x", avatarInitial: "C", elo: 1798 },
    ],
    spectators: 284,
    startedAgo: "12m ago",
    round: "Rebuttal",
    ranked: true,
  },
  {
    id: "d2",
    motion: "Democracy is fundamentally incompatible with technocracy",
    category: "Politics",
    participants: [
      { username: "axiom_99", avatarInitial: "A", elo: 2010 },
      { username: "novabird", avatarInitial: "N", elo: 1955 },
    ],
    spectators: 512,
    startedAgo: "4m ago",
    round: "Opening",
    ranked: true,
  },
  {
    id: "d3",
    motion: "Universal Basic Income would reduce human creativity",
    category: "Economics",
    participants: [
      { username: "prestige", avatarInitial: "P", elo: 1670 },
      { username: "ironclad7", avatarInitial: "I", elo: 1710 },
    ],
    spectators: 93,
    startedAgo: "28m ago",
    round: "Closing",
    ranked: false,
  },
];

export const FEATURED_DEBATES = [
  {
    id: "f1",
    motion: "Open borders would be net positive for developed nations",
    category: "Politics",
    winner: { username: "meridian", avatarInitial: "M", elo: 1988 },
    loser: { username: "docent_k", avatarInitial: "D", elo: 1902 },
    audienceVote: "61% Meridian",
    completedAgo: "2h ago",
    ranked: true,
    spectatorCount: 1204,
  },
  {
    id: "f2",
    motion: "Consciousness is purely computational",
    category: "Philosophy",
    winner: { username: "graylux", avatarInitial: "G", elo: 2145 },
    loser: { username: "strider_y", avatarInitial: "S", elo: 2100 },
    audienceVote: "54% Graylux",
    completedAgo: "5h ago",
    ranked: true,
    spectatorCount: 876,
  },
  {
    id: "f3",
    motion: "Sports leagues should enforce salary caps globally",
    category: "Sports",
    winner: { username: "volta_m", avatarInitial: "V", elo: 1544 },
    loser: { username: "kestrel4", avatarInitial: "K", elo: 1510 },
    audienceVote: "49% Volta_m",
    completedAgo: "1d ago",
    ranked: false,
    spectatorCount: 411,
  },
];

export const LEADERBOARD = [
  { rank: 1, username: "graylux", avatarInitial: "G", elo: 2145, wins: 98, losses: 12, winRate: 89 },
  { rank: 2, username: "axiom_99", avatarInitial: "A", elo: 2010, wins: 121, losses: 28, winRate: 81 },
  { rank: 3, username: "meridian", avatarInitial: "M", elo: 1988, wins: 84, losses: 19, winRate: 82 },
  { rank: 4, username: "novabird", avatarInitial: "N", elo: 1955, wins: 76, losses: 22, winRate: 78 },
  { rank: 5, username: "docent_k", avatarInitial: "D", elo: 1902, wins: 67, losses: 21, winRate: 76 },
  { rank: 6, username: "tekwolf", avatarInitial: "T", elo: 1842, wins: 55, losses: 17, winRate: 76 },
  { rank: 7, username: "clarity_x", avatarInitial: "C", elo: 1798, wins: 49, losses: 18, winRate: 73 },
  { rank: 8, username: "ironclad7", avatarInitial: "I", elo: 1710, wins: 44, losses: 20, winRate: 69 },
];
