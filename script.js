const { useState, useEffect, useRef } = React;

// AVAILABLE GENRES LIST
const GENRES_LIST = [
  "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", 
  "Horror", "Mahou Shoujo", "Mecha", "Music", "Mystery", "Psychological", 
  "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"
];

// --- LEVENSHTEIN FUZZY SEARCH UTILITIES ---
function levenshteinDistance(a, b) {
  const matrix = [];
  const lenA = a.length;
  const lenB = b.length;

  for (let i = 0; i <= lenB; i++) matrix[i] = [i];
  for (let j = 0; j <= lenA; j++) matrix[0][j] = j;

  for (let i = 1; i <= lenB; i++) {
    for (let j = 1; j <= lenA; j++) {
      if (b.charAt(i - 1).toLowerCase() === a.charAt(j - 1).toLowerCase()) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[lenB][lenA];
}

const POPULAR_ANIME_DICT = [
  "Naruto", "Naruto Shippuden", "One Piece", "Bleach", "Attack on Titan",
  "Jujutsu Kaisen", "Demon Slayer", "Solo Leveling", "Chainsaw Man",
  "My Hero Academia", "Death Note", "Fullmetal Alchemist: Brotherhood",
  "Hunter x Hunter", "Tokyo Ghoul", "Dragon Ball Z", "Dragon Ball Super",
  "Cyberpunk: Edgerunners", "Spy x Family", "Vinland Saga", "Frieren: Beyond Journey's End",
  "Mob Psycho 100", "Steins;Gate", "Cowboy Bebop", "Neon Genesis Evangelion"
];

function getFuzzyCorrection(query) {
  if (!query || query.trim().length < 3) return null;
  const cleanQ = query.trim().toLowerCase();
  
  let bestMatch = null;
  let minDistance = Infinity;

  for (const title of POPULAR_ANIME_DICT) {
    const cleanTitle = title.toLowerCase();
    const words = cleanTitle.split(' ');
    for (const w of words) {
      const dist = levenshteinDistance(cleanQ, w);
      if (dist < minDistance && dist <= 2) {
        minDistance = dist;
        bestMatch = title;
      }
    }
    const fullDist = levenshteinDistance(cleanQ, cleanTitle);
    if (fullDist < minDistance && fullDist <= 4) {
      minDistance = fullDist;
      bestMatch = title;
    }
  }

  return (bestMatch && bestMatch.toLowerCase() !== cleanQ) ? bestMatch : null;
}

// --- MOCK INITIAL FORUM THREADS ---
const MOCK_FORUM_THREADS = [
  {
    id: 'f1',
    title: "Solo Leveling Season 2 Episode 5 Discussion - Peak Animation?",
    category: "Anime General",
    author: "ShadowMonarch",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
    repliesCount: 42,
    timeAgo: "12m ago",
    hot: true,
    comments: [
      { id: 'c1', author: 'ZenitsuFan', text: 'A-1 Pictures really went all out with the shadows visual effects.', timeAgo: '10m ago' },
      { id: 'c2', author: 'Guts', text: 'The pacing felt a bit fast compared to the manhwa, but the fights delivered.', timeAgo: '5m ago' }
    ]
  },
  {
    id: 'f2',
    title: "Chainsaw Man Reze Arc Movie - Final Prediction Thread",
    category: "Movies",
    author: "MakimaSimp",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80",
    repliesCount: 89,
    timeAgo: "1h ago",
    hot: true,
    comments: [
      { id: 'c3', author: 'Denji01', text: 'If MAPPA hits the sound design like S1 it is going to break cinema records.', timeAgo: '45m ago' }
    ]
  },
  {
    id: 'f3',
    title: "Which studio has had the best animation consistency in 2025/2026?",
    category: "Industry",
    author: "UfotableEnthusiast",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80",
    repliesCount: 15,
    timeAgo: "3h ago",
    hot: false,
    comments: []
  }
];

// --- ANILIST API GRAPHQL HELPER ---
async function fetchAniList(query, variables = {}) {
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables })
    });
    const json = await response.json();
    if (json.errors) console.warn('AniList API Warnings:', json.errors);
    return json.data;
  } catch (err) {
    console.error('AniList Fetch Error:', err);
    return null;
  }
}

// --- GRAPHQL QUERIES ---
const TRENDING_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage currentPage }
      media(type: ANIME, sort: TRENDING_DESC) {
        id
        title { romaji english native }
        coverImage { extraLarge large medium color }
        bannerImage
        description
        averageScore
        episodes
        format
        genres
        status
        startDate { year month day }
        studios(isMain: true) { nodes { name } }
      }
    }
  }
`;

const FILTERED_RANKINGS_QUERY = `
  query ($page: Int, $perPage: Int, $genreIn: [String], $genreNotIn: [String], $sort: [MediaSort]) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, genre_in: $genreIn, genre_not_in: $genreNotIn, sort: $sort) {
        id
        title { romaji english native }
        coverImage { extraLarge medium }
        averageScore
        episodes
        format
        genres
        startDate { year month day }
      }
    }
  }
`;

const SEARCH_QUERY = `
  query ($search: String, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title { romaji english native }
        coverImage { extraLarge medium }
        bannerImage
        description
        averageScore
        episodes
        format
        genres
        startDate { year month day }
      }
    }
  }
`;

const DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      title { romaji english native }
      coverImage { extraLarge large color }
      bannerImage
      description
      averageScore
      episodes
      duration
      format
      status
      season
      seasonYear
      startDate { year month day }
      endDate { year month day }
      genres
      synonyms
      externalLinks { id url site icon color }
      studios { nodes { id name } }
      staff(sort: RELEVANCE, perPage: 8) {
        edges {
          role
          node {
            id
            name { full native }
            image { medium large }
            primaryOccupations
          }
        }
      }
      characters(sort: ROLE, perPage: 6) {
        nodes {
          id
          name { full }
          image { medium }
        }
      }
      relations {
        edges {
          relationType
          node {
            id
            title { english romaji }
            type
            coverImage { medium }
          }
        }
      }
    }
  }
`;

const STAFF_QUERY = `
  query ($id: Int) {
    Staff(id: $id) {
      id
      name { full native }
      image { large }
      description
      primaryOccupations
      staffMedia(page: 1, perPage: 8, sort: POPULARITY_DESC) {
        nodes {
          id
          title { english romaji }
          type
          coverImage { medium }
          format
        }
      }
    }
  }
`;

// Isolated Icon Renderer
const Icon = ({ name, size = 18, className = "" }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (window.lucide && ref.current) {
      ref.current.innerHTML = `<i data-lucide="${name}"></i>`;
      window.lucide.createIcons({
        attrs: { width: size, height: size, class: className }
      });
    }
  }, [name, size, className]);
  return <span ref={ref} className="inline-flex items-center justify-center"></span>;
};

// --- MAIN APP COMPONENT ---
function App() {
  const [currentView, setCurrentView] = useState('home'); 
  const [selectedAnimeId, setSelectedAnimeId] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  
  const [trendingList, setTrendingList] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Multi-Genre Included & Excluded Selection State
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [excludedGenres, setExcludedGenres] = useState([]);
  const [selectedSort, setSelectedSort] = useState('SCORE_DESC');
  
  // Lifetime Ranking Source Mode: Default set to 'animichi'
  const [rankingSource, setRankingSource] = useState('animichi'); 

  const [rankingList, setRankingList] = useState([]);
  const [loadingRankings, setLoadingRankings] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [suggestedCorrection, setSuggestedCorrection] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  const [animeDetails, setAnimeDetails] = useState(null);
  const [staffDetails, setStaffDetails] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // --- BROWSER CACHE (LOCALSTORAGE) STATE INIT ---
  const [userRatings, setUserRatings] = useState(() => {
    try {
      const cached = localStorage.getItem('animichi_user_ratings');
      return cached ? JSON.parse(cached) : {};
    } catch { return {}; }
  });
  
  const [animichiRatings, setAnimichiRatings] = useState(() => {
    try {
      const cached = localStorage.getItem('animichi_community_ratings');
      return cached ? JSON.parse(cached) : {
        101922: { totalScore: 96, count: 10 },
        113415: { totalScore: 98, count: 10 },
        21: { totalScore: 92, count: 10 },
        16498: { totalScore: 95, count: 10 },
        108465: { totalScore: 89, count: 10 }
      };
    } catch {
      return {
        101922: { totalScore: 96, count: 10 },
        113415: { totalScore: 98, count: 10 },
        21: { totalScore: 92, count: 10 },
        16498: { totalScore: 95, count: 10 },
        108465: { totalScore: 89, count: 10 }
      };
    }
  });

  const [watchlist, setWatchlist] = useState(() => {
    try {
      const cached = localStorage.getItem('animichi_watchlist');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const cached = localStorage.getItem('animichi_user_profile');
      return cached ? JSON.parse(cached) : {
        username: 'Browser Guest',
        email: 'local@animichi.cache',
        avatar: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=200&q=80',
        bio: 'Browsing anime via local browser cache storage.'
      };
    } catch {
      return {
        username: 'Browser Guest',
        email: 'local@animichi.cache',
        avatar: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=200&q=80',
        bio: 'Browsing anime via local browser cache storage.'
      };
    }
  });

  // Browser Cache Sync State
  const [cacheSyncStatus, setCacheSyncStatus] = useState('saved'); // 'saved' | 'saving'
  const [lastSavedTime, setLastSavedTime] = useState('Just now');

  // Modals State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Forum State & Modal
  const [forumThreads, setForumThreads] = useState(MOCK_FORUM_THREADS);
  const [selectedThread, setSelectedThread] = useState(null);
  const [isCreateThreadOpen, setIsCreateThreadOpen] = useState(false);

  const searchContainerRef = useRef(null);

  const searchPrompts = [
    "Wanna watch Naruto?",
    "Wanna watch One Piece?",
    "Wanna watch Attack on Titan?",
    "Wanna watch Jujutsu Kaisen?",
    "Wanna watch Demon Slayer?",
    "Wanna watch Bleach?",
    "Wanna watch Solo Leveling?",
    "Wanna watch Chainsaw Man?"
  ];
  const [promptIndex, setPromptIndex] = useState(0);

  // --- PERSIST TO BROWSER LOCALSTORAGE CACHE ---
  useEffect(() => {
    try {
      localStorage.setItem('animichi_watchlist', JSON.stringify(watchlist));
      localStorage.setItem('animichi_user_ratings', JSON.stringify(userRatings));
      localStorage.setItem('animichi_community_ratings', JSON.stringify(animichiRatings));
      localStorage.setItem('animichi_user_profile', JSON.stringify(currentUser));
      
      setCacheSyncStatus('saving');
      const timer = setTimeout(() => {
        setCacheSyncStatus('saved');
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }, 400);
      return () => clearTimeout(timer);
    } catch (e) {
      console.error("Browser Cache Storage Error:", e);
    }
  }, [watchlist, userRatings, animichiRatings, currentUser]);

  // Export Backup JSON
  const handleExportData = () => {
    const backupData = {
      user: currentUser,
      watchlist,
      userRatings,
      animichiRatings,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `animichi-browser-cache-${currentUser.username.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
  };

  // Import Backup JSON
  const handleImportData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.watchlist) setWatchlist(data.watchlist);
        if (data.userRatings) setUserRatings(data.userRatings);
        if (data.animichiRatings) setAnimichiRatings(data.animichiRatings);
        if (data.user) setCurrentUser(data.user);
        alert('Browser cache successfully restored from backup file!');
      } catch (err) {
        alert('Invalid backup file format.');
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state && event.state.view) {
        setCurrentView(event.state.view);
        if (event.state.id) {
          setSelectedAnimeId(event.state.id);
        }
      } else {
        setCurrentView('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const changeView = (newView, id = null, genrePreset = null) => {
    if (genrePreset) {
      setSelectedGenres([genrePreset]);
      setExcludedGenres([]);
    }
    setCurrentView(newView);
    window.history.pushState({ view: newView, id }, '', `#${newView}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setPromptIndex((prev) => (prev + 1) % searchPrompts.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadInitial() {
      const data = await fetchAniList(TRENDING_QUERY, { page: 1, perPage: 12 });
      if (data && data.Page) {
        setTrendingList(data.Page.media);
        setHasNextPage(data.Page.pageInfo.hasNextPage);
      }
    }
    loadInitial();
  }, []);

  const getAnimichiAvgRating = (id, fallbackScore = 80) => {
    const record = animichiRatings[id];
    if (!record || record.count === 0) {
      return (fallbackScore / 10).toFixed(1);
    }
    return (record.totalScore / record.count).toFixed(1);
  };

  const loadRankings = async () => {
    setLoadingRankings(true);
    const vars = {
      perPage: 50,
      sort: [selectedSort]
    };

    if (selectedGenres.length > 0) vars.genreIn = selectedGenres;
    if (excludedGenres.length > 0) vars.genreNotIn = excludedGenres;

    const data = await fetchAniList(FILTERED_RANKINGS_QUERY, vars);
    if (data && data.Page) {
      let list = [...data.Page.media];
      if (rankingSource === 'animichi') {
        list.sort((a, b) => {
          const avgA = parseFloat(getAnimichiAvgRating(a.id, a.averageScore || 80));
          const avgB = parseFloat(getAnimichiAvgRating(b.id, b.averageScore || 80));
          return avgB - avgA;
        });
      }
      setRankingList(list);
    }
    setLoadingRankings(false);
  };

  useEffect(() => {
    if (currentView === 'ranking') {
      loadRankings();
    }
  }, [currentView, selectedGenres, excludedGenres, selectedSort, rankingSource, animichiRatings]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasNextPage) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const data = await fetchAniList(TRENDING_QUERY, { page: nextPage, perPage: 12 });
    if (data && data.Page) {
      setTrendingList(prev => [...prev, ...data.Page.media]);
      setPage(nextPage);
      setHasNextPage(data.Page.pageInfo.hasNextPage);
    }
    setLoadingMore(false);
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSuggestedCorrection(null);
      setShowAutocomplete(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const data = await fetchAniList(SEARCH_QUERY, { search: searchQuery, page: 1, perPage: 6 });
      if (data && data.Page) {
        setSearchResults(data.Page.media);
        setShowAutocomplete(true);
      }
      const correction = getFuzzyCorrection(searchQuery);
      setSuggestedCorrection(correction);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const triggerFullSearch = async (queryToUse) => {
    const q = queryToUse || searchQuery;
    if (!q.trim()) return;
    setSearchQuery(q);
    setShowAutocomplete(false);
    setIsSearching(true);
    const data = await fetchAniList(SEARCH_QUERY, { search: q, page: 1, perPage: 24 });
    if (data && data.Page) {
      setSearchResults(data.Page.media);
    }
    setIsSearching(false);
    changeView('search');
  };

  const openAnimeDetails = async (id) => {
    setShowAutocomplete(false);
    setSelectedAnimeId(id);
    setLoadingDetail(true);
    changeView('detail', id);
    const data = await fetchAniList(DETAIL_QUERY, { id });
    if (data && data.Media) {
      setAnimeDetails(data.Media);
    }
    setLoadingDetail(false);
  };

  const openStaffDetails = async (id) => {
    setSelectedStaffId(id);
    const data = await fetchAniList(STAFF_QUERY, { id });
    if (data && data.Staff) {
      setStaffDetails(data.Staff);
    }
  };

  const openThread = (thread) => {
    setSelectedThread(thread);
    changeView('thread', thread.id);
  };

  const handleCreateNewThread = (newThreadObj) => {
    setForumThreads(prev => [newThreadObj, ...prev]);
    setIsCreateThreadOpen(false);
  };

  const handleAddComment = (threadId, commentText) => {
    if (!commentText.trim()) return;
    setForumThreads(prev => prev.map(t => {
      if (t.id === threadId) {
        const newComment = {
          id: 'c_' + Date.now(),
          author: currentUser.username,
          text: commentText,
          timeAgo: 'Just now'
        };
        return {
          ...t,
          repliesCount: t.repliesCount + 1,
          comments: [...t.comments, newComment]
        };
      }
      return t;
    }));

    if (selectedThread && selectedThread.id === threadId) {
      setSelectedThread(prev => ({
        ...prev,
        repliesCount: prev.repliesCount + 1,
        comments: [...prev.comments, {
          id: 'c_' + Date.now(),
          author: currentUser.username,
          text: commentText,
          timeAgo: 'Just now'
        }]
      }));
    }
  };

  const toggleWatchlist = (anime) => {
    setWatchlist(prev => {
      const exists = prev.some(item => item.id === anime.id);
      return exists ? prev.filter(item => item.id !== anime.id) : [...prev, anime];
    });
  };

  const handleRateAnime = (id, rating) => {
    const oldRating = userRatings[id];
    setUserRatings(prev => ({ ...prev, [id]: rating }));

    setAnimichiRatings(prev => {
      const existing = prev[id] || { totalScore: 80, count: 10 };
      if (oldRating) {
        return {
          ...prev,
          [id]: {
            totalScore: existing.totalScore - oldRating + rating,
            count: existing.count
          }
        };
      } else {
        return {
          ...prev,
          [id]: {
            totalScore: existing.totalScore + rating,
            count: existing.count + 1
          }
        };
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      
      {/* HEADER BAR */}
      <header className="sticky top-0 z-40 glass-panel border-b border-slate-800 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Brand Logo */}
          <div 
            onClick={() => { changeView('home'); setSearchQuery(''); setShowAutocomplete(false); }}
            className="flex items-center gap-3 cursor-pointer group shrink-0"
          >
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-rose-500 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-all duration-300">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-brand-400 bg-clip-text text-transparent">
                AniMichi<span className="text-brand-500">.</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Browser Cache Edition</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-full border border-slate-800/80">
            <button 
              onClick={() => changeView('home')}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${currentView === 'home' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Explore
            </button>
            <button 
              onClick={() => changeView('ranking')}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${currentView === 'ranking' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Icon name="trophy" size={14} className="text-amber-400" />
              Lifetime Ranking
            </button>
            <button 
              onClick={() => changeView('watchlist')}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${currentView === 'watchlist' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Watchlist
              {watchlist.length > 0 && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">{watchlist.length}</span>
              )}
            </button>
            <button 
              onClick={() => changeView('forums')}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${currentView === 'forums' || currentView === 'thread' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Icon name="message-square" size={14} />
              Community Forum
            </button>
          </nav>

          {/* Dynamic Search Box */}
          <div ref={searchContainerRef} className="relative flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.trim() && setShowAutocomplete(true)}
                onKeyDown={(e) => { if (e.key === 'Enter') triggerFullSearch(); }}
                placeholder={searchPrompts[promptIndex]}
                className="w-full bg-slate-900/90 text-sm text-slate-100 placeholder-slate-500 pl-10 pr-10 py-2.5 rounded-2xl border border-slate-800 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all shadow-inner"
              />
              <div className="absolute left-3.5 top-3 text-slate-500"><Icon name="search" size={16} /></div>
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setShowAutocomplete(false); }} className="absolute right-3 top-3 text-slate-500 hover:text-slate-300">
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>

            {suggestedCorrection && searchQuery.length > 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-brand-900/90 border border-brand-500/40 rounded-xl p-2 text-xs text-brand-100 shadow-xl flex items-center justify-between z-50 backdrop-blur-md">
                <div className="flex items-center gap-1.5">
                  <Icon name="sparkles" size={14} className="text-amber-400" />
                  <span>Did you mean <strong className="text-white underline cursor-pointer" onClick={() => triggerFullSearch(suggestedCorrection)}>{suggestedCorrection}</strong>?</span>
                </div>
                <button onClick={() => setSuggestedCorrection(null)} className="text-slate-400 hover:text-white"><Icon name="x" size={12} /></button>
              </div>
            )}

            {showAutocomplete && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto divide-y divide-slate-800/50">
                <div className="p-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950/50 flex justify-between items-center">
                  <span>Live Suggestions</span>
                  <span className="text-[10px] text-brand-400 font-normal">Press Enter for full results</span>
                </div>
                {searchResults.map(anime => (
                  <div
                    key={anime.id}
                    onClick={() => openAnimeDetails(anime.id)}
                    className="p-2.5 flex items-center gap-3 hover:bg-slate-800/80 cursor-pointer transition-colors"
                  >
                    <img src={anime.coverImage.medium} alt={anime.title.english || anime.title.romaji} className="w-10 h-14 object-cover rounded-md flex-shrink-0 shadow" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{anime.title.english || anime.title.romaji}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                        <span className="text-amber-400 font-medium flex items-center gap-0.5">★ {anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A'}</span>
                        <span>•</span><span>{anime.format || 'TV'}</span><span>•</span><span>{anime.startDate?.year || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={() => triggerFullSearch()} className="w-full py-2.5 text-center text-xs font-bold text-brand-400 hover:bg-slate-800/60 border-t border-slate-800 transition-colors">
                  View All Results for "{searchQuery}"
                </button>
              </div>
            )}
          </div>

          {/* Header Right Actions */}
          <div className="flex items-center gap-2">
            {/* Ask Otaku-Kun Bot Button with Shine Effect */}
            <button
              onClick={() => setIsChatOpen(true)}
              className="otaku-shine-btn flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-brand-500/50 transition-all relative group"
              title="Ask Otaku-Kun"
            >
              <Icon name="bot" size={18} className="text-brand-400" />
              <span className="text-xs font-bold hidden sm:inline bg-gradient-to-r from-brand-400 via-rose-400 to-amber-400 bg-clip-text text-transparent">
                Ask Otaku-Kun
              </span>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-brand-500 rounded-full animate-ping"></span>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-brand-500 rounded-full"></span>
            </button>
            
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-brand-500/50 transition-all"
              title="Browser Cache Settings & Storage"
            >
              <img src={currentUser.avatar} alt="User Avatar" className="w-7 h-7 rounded-lg object-cover" />
              <span className="hidden sm:inline text-xs font-semibold pr-1">{currentUser.username}</span>
              <span className={`w-2 h-2 rounded-full ${cacheSyncStatus === 'saving' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} title={`Cache Status: ${cacheSyncStatus}`}></span>
            </button>
          </div>

        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        
        {/* VIEW 1: HOME EXPLORE PAGE */}
        {currentView === 'home' && (
          <div className="space-y-8">
            <HeroBanner items={trendingList.slice(0, 5)} onSelect={openAnimeDetails} />

            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Icon name="flame" className="text-rose-500" size={22} />
                  Trending Right Now
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Most watched anime in the community this week</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
              {trendingList.map(anime => (
                <AnimeCard 
                  key={anime.id} 
                  anime={anime} 
                  onSelect={openAnimeDetails} 
                  onSelectGenre={(g) => changeView('ranking', null, g)}
                  isInWatchlist={watchlist.some(w => w.id === anime.id)}
                  onToggleWatchlist={toggleWatchlist}
                  userRating={userRatings[anime.id]}
                />
              ))}
            </div>

            {hasNextPage && (
              <div className="text-center pt-6">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-8 py-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-brand-500 text-slate-200 hover:text-white font-bold text-sm shadow-xl transition-all disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"></div>
                      Fetching Next Page...
                    </>
                  ) : (
                    <>
                      Explore More Anime
                      <Icon name="arrow-down" size={18} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: LIFETIME RANKINGS */}
        {currentView === 'ranking' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div>
                <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
                  <Icon name="trophy" className="text-amber-400" size={26} />
                  Lifetime Rankings
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">All-time top rated & popular anime releases</p>
              </div>

              <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setRankingSource('animichi')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${rankingSource === 'animichi' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                >
                  AniMichi Ranking
                </button>
                <button
                  onClick={() => setRankingSource('anilist')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${rankingSource === 'anilist' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                >
                  AniList Ranking
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <GenreMultiSelectDropdown 
                  selectedGenres={selectedGenres} 
                  setSelectedGenres={setSelectedGenres}
                  excludedGenres={excludedGenres}
                  setExcludedGenres={setExcludedGenres}
                />

                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                  <label className="text-xs font-semibold text-slate-400">Sort By:</label>
                  <select 
                    value={selectedSort} 
                    onChange={(e) => setSelectedSort(e.target.value)}
                    className="bg-transparent text-xs text-slate-100 font-bold focus:outline-none"
                  >
                    <option value="SCORE_DESC" className="bg-slate-900">Highest Rated</option>
                    <option value="POPULARITY_DESC" className="bg-slate-900">Most Popular</option>
                    <option value="START_DATE_DESC" className="bg-slate-900">Newest First</option>
                    <option value="TRENDING_DESC" className="bg-slate-900">Trending Now</option>
                  </select>
                </div>
              </div>
            </div>

            {loadingRankings ? (
              <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-semibold">Fetching Top Anime Rankings...</p>
              </div>
            ) : rankingList.length === 0 ? (
              <div className="p-16 text-center bg-slate-900/40 rounded-3xl border border-slate-800">
                <Icon name="filter-x" size={48} className="mx-auto text-slate-600 mb-3" />
                <p className="text-slate-300 font-bold">No anime matches selected genre filters.</p>
                <button onClick={() => { setSelectedGenres([]); setExcludedGenres([]); }} className="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl">
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-w-4xl mx-auto">
                {rankingList.map((anime, index) => {
                  const rank = index + 1;
                  const title = anime.title.english || anime.title.romaji;
                  const score = rankingSource === 'animichi' 
                    ? getAnimichiAvgRating(anime.id, anime.averageScore || 80)
                    : (anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A');

                  return (
                    <div 
                      key={anime.id}
                      onClick={() => openAnimeDetails(anime.id)}
                      className="bg-slate-900 border border-slate-800/90 hover:border-brand-500/60 p-3.5 rounded-2xl flex items-center justify-between cursor-pointer transition-all duration-200 hover:scale-[1.01] shadow-lg"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span className={`w-8 text-center text-base font-extrabold flex-shrink-0 ${rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-amber-600' : 'text-slate-500'}`}>
                          #{rank}
                        </span>
                        <img src={anime.coverImage.medium} alt={title} className="w-12 h-16 object-cover rounded-xl shadow flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-slate-100 hover:text-brand-400 transition-colors truncate">{title}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{anime.format || 'TV'}</p>
                          
                          <div className="flex flex-wrap gap-1 mt-1">
                            {anime.genres?.slice(0, 3).map((g) => (
                              <span key={g} onClick={(e) => { e.stopPropagation(); changeView('ranking', null, g); }} className="text-[9px] font-semibold bg-slate-800 hover:bg-brand-600 text-slate-300 hover:text-white px-2 py-0.5 rounded-full transition-colors">
                                {g}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="bg-brand-950/80 border border-brand-800/60 text-brand-300 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow-inner flex-shrink-0">
                        <span className="text-amber-400">★</span>
                        <span>{score} / 10</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: ANIME DETAIL PAGE */}
        {currentView === 'detail' && (
          <AnimeDetailView 
            anime={animeDetails} 
            loading={loadingDetail} 
            onBack={() => changeView('home')} 
            userRating={userRatings[selectedAnimeId]}
            animichiAvgRating={getAnimichiAvgRating(selectedAnimeId, animeDetails?.averageScore || 80)}
            onRate={(rating) => handleRateAnime(selectedAnimeId, rating)}
            isInWatchlist={watchlist.some(w => w.id === selectedAnimeId)}
            onToggleWatchlist={() => animeDetails && toggleWatchlist(animeDetails)}
            onOpenStaff={openStaffDetails}
            onSelectRelatedAnime={openAnimeDetails}
            onSelectGenre={(g) => changeView('ranking', null, g)}
          />
        )}

        {/* VIEW 4: SEARCH RESULTS PAGE */}
        {currentView === 'search' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Search Results for "{searchQuery}"</h2>
                <p className="text-xs text-slate-400">Found {searchResults.length} matching entries</p>
              </div>
              <button onClick={() => changeView('home')} className="text-xs font-semibold text-brand-400 hover:underline flex items-center gap-1">
                <Icon name="arrow-left" size={14} /> Back to Home
              </button>
            </div>

            {isSearching ? (
              <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-semibold">Searching titles...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/50 rounded-2xl border border-slate-800">
                <Icon name="search-x" size={48} className="mx-auto text-slate-600 mb-3" />
                <p className="text-slate-300 font-semibold">No direct anime matches found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
                {searchResults.map(anime => (
                  <AnimeCard 
                    key={anime.id} 
                    anime={anime} 
                    onSelect={openAnimeDetails}
                    onSelectGenre={(g) => changeView('ranking', null, g)}
                    isInWatchlist={watchlist.some(w => w.id === anime.id)}
                    onToggleWatchlist={toggleWatchlist}
                    userRating={userRatings[anime.id]}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: WATCHLIST */}
        {currentView === 'watchlist' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Icon name="bookmark" className="text-brand-500" size={24} />
                My Anime Watchlist
              </h2>
              <p className="text-xs text-slate-400 mt-1">Saved shows stored in your browser cache</p>
            </div>

            {watchlist.length === 0 ? (
              <div className="p-16 text-center bg-slate-900/40 rounded-3xl border border-slate-800/80">
                <Icon name="film" size={56} className="mx-auto text-slate-700 mb-4" />
                <h3 className="text-lg font-bold text-slate-300">Your Watchlist is Empty</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Click the bookmark icon on any anime card to save it here.</p>
                <button onClick={() => changeView('home')} className="mt-6 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold text-xs shadow-lg transition-all">
                  Discover Anime
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
                {watchlist.map(anime => (
                  <AnimeCard 
                    key={anime.id} 
                    anime={anime} 
                    onSelect={openAnimeDetails} 
                    onSelectGenre={(g) => changeView('ranking', null, g)}
                    isInWatchlist={true}
                    onToggleWatchlist={toggleWatchlist}
                    userRating={userRatings[anime.id]}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 6: COMMUNITY FORUMS */}
        {currentView === 'forums' && (
          <ForumMainView 
            threads={forumThreads} 
            onSelectThread={openThread} 
            onOpenCreateModal={() => setIsCreateThreadOpen(true)}
          />
        )}

        {/* VIEW 7: FORUM THREAD DISCUSSION */}
        {currentView === 'thread' && selectedThread && (
          <ForumThreadView 
            thread={selectedThread} 
            onBack={() => changeView('forums')}
            onAddComment={(text) => handleAddComment(selectedThread.id, text)}
          />
        )}

      </main>

      {/* NEW THREAD CREATION MODAL */}
      {isCreateThreadOpen && (
        <CreateThreadModal 
          onClose={() => setIsCreateThreadOpen(false)} 
          onCreate={handleCreateNewThread} 
        />
      )}

      {/* STAFF / AUTHOR DETAIL MODAL */}
      {staffDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 relative shadow-2xl">
            <button onClick={() => setStaffDetails(null)} className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"><Icon name="x" size={18} /></button>
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <img src={staffDetails.image.large} alt={staffDetails.name.full} className="w-32 h-44 object-cover rounded-2xl shadow-xl flex-shrink-0" />
              <div>
                <h3 className="text-2xl font-bold text-white">{staffDetails.name.full}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{staffDetails.name.native}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {staffDetails.primaryOccupations?.map((occ, i) => (
                    <span key={i} className="text-[10px] font-bold bg-brand-950 text-brand-300 border border-brand-800/50 px-2 py-0.5 rounded-full">{occ}</span>
                  ))}
                </div>
                <p className="text-xs text-slate-300 mt-4 leading-relaxed line-clamp-4">{staffDetails.description?.replace(/<[^>]*>?/gm, '') || "No biography available."}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BROWSER CACHE & STORAGE SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 relative shadow-2xl space-y-6">
            <button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"><Icon name="x" size={18} /></button>

            <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
              <img src={currentUser.avatar} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-brand-500 shadow-xl" />
              <div>
                <h3 className="text-lg font-bold text-white">{currentUser.username}</h3>
                <p className="text-xs text-slate-400">{currentUser.email}</p>
                <span className="inline-flex items-center gap-1.5 mt-1.5 text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Browser Cache Active ({lastSavedTime})
                </span>
              </div>
            </div>

            {/* Browser Cache Management Section */}
            <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="hard-drive" size={18} className="text-brand-400" />
                  <h4 className="text-xs font-bold text-white">Local Storage & Cache Manager</h4>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">Your watchlist items ({watchlist.length}), ratings, and profile settings are saved locally in your browser cache.</p>
              
              <div className="flex gap-2 pt-2 border-t border-slate-900">
                <button onClick={handleExportData} className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-800 flex items-center justify-center gap-1.5">
                  <Icon name="download" size={14} /> Export Backup (.JSON)
                </button>
                <label className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-800 flex items-center justify-center gap-1.5 cursor-pointer">
                  <Icon name="upload" size={14} /> Import Backup
                  <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
                </label>
              </div>
            </div>

            {/* Profile Settings Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Profile Settings</h4>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Display Username</label>
                <input 
                  type="text" 
                  value={currentUser.username}
                  onChange={(e) => setCurrentUser({...currentUser, username: e.target.value})}
                  className="w-full bg-slate-950 text-xs text-white p-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Avatar Image URL</label>
                <input 
                  type="text" 
                  value={currentUser.avatar}
                  onChange={(e) => setCurrentUser({...currentUser, avatar: e.target.value})}
                  className="w-full bg-slate-950 text-xs text-white p-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button 
                onClick={() => {
                  if (confirm("Clear all browser cache data (watchlist & ratings)?")) {
                    localStorage.clear();
                    setWatchlist([]);
                    setUserRatings({});
                    setIsSettingsOpen(false);
                  }
                }}
                className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all"
              >
                Clear Cache Data
              </button>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow transition-all"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASK OTAKU-KUN AI ASSISTANT CHATBOT DRAWER */}
      <AiChatbotDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>© 2026 AniMichi Portal. Powered by AniList GraphQL & Browser LocalStorage Cache.</p>
      </footer>

    </div>
  );
}

// --- MULTI-SELECT & EXCLUDE GENRE FILTER DROPDOWN COMPONENT ---
function GenreMultiSelectDropdown({ selectedGenres, setSelectedGenres, excludedGenres, setExcludedGenres }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleInclude = (genre) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
      setExcludedGenres(excludedGenres.filter(g => g !== genre));
    }
  };

  const toggleExclude = (genre) => {
    if (excludedGenres.includes(genre)) {
      setExcludedGenres(excludedGenres.filter(g => g !== genre));
    } else {
      setExcludedGenres([...excludedGenres, genre]);
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    }
  };

  const totalActive = selectedGenres.length + excludedGenres.length;

  return (
    <div ref={dropdownRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 px-3 py-2 rounded-xl flex items-center gap-2 shadow-sm"
      >
        <Icon name="filter" size={14} className="text-brand-400" />
        <span>{totalActive === 0 ? "Filter Genres" : `${selectedGenres.length} Incl. / ${excludedGenres.length} Excl.`}</span>
        <Icon name="chevron-down" size={14} className="text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 z-50 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-white">Filter Genres</span>
            {(selectedGenres.length > 0 || excludedGenres.length > 0) && (
              <button onClick={() => { setSelectedGenres([]); setExcludedGenres([]); }} className="text-[10px] text-rose-400 hover:underline font-semibold">
                Clear All
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
            {GENRES_LIST.map((genre) => {
              const isInc = selectedGenres.includes(genre);
              const isExc = excludedGenres.includes(genre);

              return (
                <div key={genre} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors">
                  <span className={`text-xs font-medium ${isInc ? 'text-emerald-400 font-bold' : isExc ? 'text-rose-400 line-through' : 'text-slate-300'}`}>{genre}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => toggleInclude(genre)} className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${isInc ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-emerald-400'}`}>Include</button>
                    <button type="button" onClick={() => toggleExclude(genre)} className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${isExc ? 'bg-rose-600 text-white border-rose-500' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-rose-400'}`}>Exclude</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function HeroBanner({ items, onSelect }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!items || items.length === 0) return null;
  const current = items[currentIndex];

  return (
    <div 
      className="relative h-[340px] sm:h-[400px] rounded-3xl overflow-hidden shadow-2xl border border-slate-800 group select-none cursor-pointer"
      onClick={() => onSelect(current.id)}
    >
      <img src={current.bannerImage || current.coverImage?.extraLarge} alt={current.title?.english || current.title?.romaji} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/40 to-transparent"></div>

      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 flex flex-col justify-end max-w-2xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-rose-500 text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow">Featured Spotlight</span>
          <span className="text-amber-400 font-bold text-xs flex items-center gap-1">★ {current.averageScore ? (current.averageScore / 10).toFixed(1) : 'N/A'} Rating</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight line-clamp-2">{current.title?.english || current.title?.romaji}</h2>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 line-clamp-2 font-medium">{current.description?.replace(/<[^>]*>?/gm, '')}</p>
      </div>

      <div className="absolute bottom-4 right-6 flex items-center gap-1.5 z-10">
        {items.map((_, idx) => (
          <button key={idx} onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }} className={`h-2 rounded-full transition-all ${idx === currentIndex ? 'w-6 bg-brand-400' : 'w-2 bg-slate-600/70'}`} />
        ))}
      </div>
    </div>
  );
}

function AnimeCard({ anime, onSelect, onSelectGenre, isInWatchlist, onToggleWatchlist, userRating }) {
  return (
    <div 
      onClick={() => onSelect(anime.id)}
      className="group relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800/80 hover:border-brand-500/50 transition-all duration-300 hover:-translate-y-1 shadow-lg cursor-pointer flex flex-col"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-slate-950">
        <img src={anime.coverImage?.extraLarge || anime.coverImage?.large} alt={anime.title?.english || anime.title?.romaji} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        
        <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-lg border border-slate-800 text-[11px] font-bold text-amber-400 flex items-center gap-0.5">
          ★ {anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A'}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onToggleWatchlist(anime); }}
          className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-md transition-all ${isInWatchlist ? 'bg-rose-500 text-white shadow-md' : 'bg-slate-950/80 text-slate-300 hover:text-white border border-slate-800'}`}
          title={isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
        >
          <Icon name="bookmark" size={14} />
        </button>

        {userRating && (
          <div className="absolute bottom-2 left-2 bg-brand-600/90 backdrop-blur-md text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md">
            Your Rating: {userRating}/10
          </div>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-xs text-slate-100 line-clamp-2 group-hover:text-brand-400 transition-colors">{anime.title?.english || anime.title?.romaji}</h3>
          {anime.genres?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {anime.genres.slice(0, 2).map((genre) => (
                <span key={genre} onClick={(e) => { e.stopPropagation(); onSelectGenre(genre); }} className="text-[9px] font-semibold bg-slate-800/80 hover:bg-brand-600 text-slate-300 hover:text-white px-2 py-0.5 rounded-full transition-colors">
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mt-2 pt-2 border-t border-slate-800/60">
          <span>{anime.format || 'TV'}</span>
          <span>{anime.episodes ? `${anime.episodes} eps` : 'Ongoing'}</span>
        </div>
      </div>
    </div>
  );
}

function AnimeDetailView({ anime, loading, onBack, userRating, animichiAvgRating, onRate, isInWatchlist, onToggleWatchlist, onOpenStaff, onSelectRelatedAnime, onSelectGenre }) {
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(userRating || 0);

  useEffect(() => { setSelectedRating(userRating || 0); }, [userRating]);

  if (loading || !anime) {
    return (
      <div className="p-20 text-center text-slate-400 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold">Loading Detailed Metadata...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <button onClick={onBack} className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
        <Icon name="arrow-left" size={16} /> Back to Dashboard
      </button>

      <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
        {anime.bannerImage && (
          <div className="h-64 sm:h-80 w-full overflow-hidden relative">
            <img src={anime.bannerImage} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
          </div>
        )}

        <div className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6 relative z-10 -mt-16 sm:-mt-24">
          <img src={anime.coverImage.extraLarge} className="w-40 sm:w-52 h-60 sm:h-76 object-cover rounded-2xl shadow-2xl border-2 border-slate-700/80 flex-shrink-0" />

          <div className="flex-1 space-y-4">
            <div>
              <div className="flex flex-wrap gap-2 mb-2">
                {anime.genres?.map((g, i) => (
                  <button key={i} onClick={() => onSelectGenre(g)} className="text-[10px] font-bold uppercase bg-brand-950 hover:bg-brand-600 text-brand-300 hover:text-white border border-brand-800/50 px-2.5 py-0.5 rounded-full transition-colors">{g}</button>
                ))}
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white">{anime.title.english || anime.title.romaji}</h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-amber-500/20 to-brand-500/20 border border-amber-500/30 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
                <span className="text-amber-400 font-bold text-sm">★ {animichiAvgRating} / 10</span>
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">AniMichi Avg Rating</span>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 p-3.5 rounded-2xl inline-block">
              <p className="text-xs font-bold text-slate-300 mb-1">Your Personal Rating (1 - 10 Stars)</p>
              <div className="flex items-center gap-1 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(star => {
                  const isActive = star <= (hoverRating || selectedRating);
                  return (
                    <button
                      key={star}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setSelectedRating(star)}
                      className={`p-1 hover:scale-125 transition-transform ${isActive ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}`}
                    >
                      <Icon name="star" size={18} />
                    </button>
                  );
                })}
                <span className="ml-2 text-xs font-extrabold text-white">{selectedRating ? `${selectedRating} / 10` : 'Not Rated'}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800/60 pt-2.5">
                <p className="text-[10px] text-slate-400">Select stars and click submit to save</p>
                <button onClick={() => selectedRating > 0 && onRate(selectedRating)} disabled={selectedRating === 0} className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-bold shadow transition-all">
                  Submit Rating
                </button>
              </div>
            </div>

            <button onClick={onToggleWatchlist} className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all ${isInWatchlist ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-brand-600 hover:bg-brand-500 text-white'}`}>
              <Icon name="bookmark" size={16} />
              {isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Icon name="file-text" size={20} className="text-brand-400" /> Synopsis</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{anime.description?.replace(/<[^>]*>?/gm, '') || "No synopsis available."}</p>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-3 text-xs">
            <h3 className="text-md font-bold text-white mb-3">Anime Information</h3>
            <div className="flex justify-between py-1.5 border-b border-slate-800"><span className="text-slate-400">Format</span><span className="font-bold text-slate-200">{anime.format || 'N/A'}</span></div>
            <div className="flex justify-between py-1.5 border-b border-slate-800"><span className="text-slate-400">Episodes</span><span className="font-bold text-slate-200">{anime.episodes || 'Unknown'}</span></div>
            <div className="flex justify-between py-1.5"><span className="text-slate-400">Status</span><span className="font-bold text-emerald-400">{anime.status}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ForumMainView({ threads, onSelectThread, onOpenCreateModal }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Icon name="message-square" className="text-brand-500" size={24} /> Community Forums</h2>
          <p className="text-xs text-slate-400 mt-1">Discussions, episode threads, and hot takes</p>
        </div>
        <button onClick={onOpenCreateModal} className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all">
          <Icon name="plus" size={16} /> Create Thread
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl divide-y divide-slate-800/60">
        {threads.map(t => (
          <div key={t.id} onClick={() => onSelectThread(t)} className="grid grid-cols-12 px-4 py-3.5 items-center hover:bg-slate-800/50 cursor-pointer transition-colors">
            <div className="col-span-8 sm:col-span-7 flex items-center gap-3">
              <img src={t.avatar} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-100 truncate hover:text-brand-400">{t.title}</p>
                <p className="text-[11px] text-slate-400">by {t.author}</p>
              </div>
            </div>
            <div className="col-span-4 sm:col-span-5 text-right">
              <span className="text-xs font-bold text-white">{t.repliesCount} replies</span>
              <p className="text-[10px] text-slate-500">{t.timeAgo}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateThreadModal({ onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Anime General');

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"><Icon name="x" size={18} /></button>
        <h3 className="text-xl font-bold text-white mb-4">Start New Forum Thread</h3>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onCreate({
            id: 'f_' + Date.now(),
            title: title.trim(),
            category,
            author: 'Browser Guest',
            avatar: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=120&q=80",
            repliesCount: 0,
            timeAgo: 'Just now',
            hot: false,
            comments: []
          });
        }} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Thread Title</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Favorite Studio?" className="w-full bg-slate-950 text-xs text-white p-3 rounded-xl border border-slate-800" />
          </div>
          <button type="submit" className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl shadow">Publish Thread</button>
        </form>
      </div>
    </div>
  );
}

function ForumThreadView({ thread, onBack, onAddComment }) {
  const [newComment, setNewComment] = useState('');
  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
        <Icon name="arrow-left" size={16} /> Back to Forums
      </button>
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
        <h1 className="text-xl font-extrabold text-white">{thread.title}</h1>
      </div>
      <div className="space-y-3">
        {thread.comments.map(c => (
          <div key={c.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <p className="text-xs font-bold text-slate-200">{c.author}</p>
            <p className="text-xs text-slate-300 mt-1">{c.text}</p>
          </div>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (newComment.trim()) { onAddComment(newComment); setNewComment(''); } }} className="flex gap-2">
        <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Write comment..." className="flex-1 bg-slate-900 text-xs text-white p-3 rounded-xl border border-slate-800" />
        <button type="submit" className="px-5 py-3 bg-brand-600 text-white font-bold text-xs rounded-xl">Post</button>
      </form>
    </div>
  );
}

function AiChatbotDrawer({ isOpen, onClose }) {
  const [messages, setMessages] = useState([{ role: 'model', text: "Konnichiwa! I am Ask Otaku-Kun. Ask me anything about anime!" }]);
  const [inputMsg, setInputMsg] = useState('');
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse"></div>
          <h3 className="font-bold text-sm text-white tracking-wide">Ask Otaku-Kun</h3>
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white"><Icon name="x" size={18} /></button>
      </div>
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {messages.map((m, idx) => (
          <div key={idx} className={`p-3 rounded-2xl text-xs ${m.role === 'user' ? 'bg-brand-600 text-white ml-auto max-w-[85%]' : 'bg-slate-800 text-slate-200 mr-auto max-w-[85%]'}`}>{m.text}</div>
        ))}
      </div>
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!inputMsg.trim()) return;
        setMessages(prev => [...prev, { role: 'user', text: inputMsg }, { role: 'model', text: "That sounds like an amazing title to check out on AniMichi!" }]);
        setInputMsg('');
      }} className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2">
        <input type="text" value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} placeholder="Ask Otaku-Kun..." className="flex-1 bg-slate-900 text-xs text-white p-2.5 rounded-xl border border-slate-800" />
        <button type="submit" className="p-2.5 bg-brand-600 text-white rounded-xl"><Icon name="send" size={16} /></button>
      </form>
    </div>
  );
}

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
