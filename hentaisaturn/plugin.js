(function() {
    var manifest = {"packageName":"com.eternalnexus.hentaisaturn","name":"HentaiSaturn","version":1,"description":"HentaiSaturn is an online streaming provider for subbed/dubbed Hentai in Italian","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"video","rating":"18","isAdult":true,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};



class Provider {

  baseUrl = "https://www.hentaisaturn.tv";
  playUrl = "https://play.hentaisaturn.tv";
  threshold = 0.7;

  getSettings(): Settings {
    return {
      episodeServers: ["Server 1"],
      supportsDub,
    };
  }

  async search(query): Promise<SearchResult[]> {
    const normalizedQuery = normalizeQuery(query.query);

    const aniListData = await getAniListAnimeDetails(query.query);
    const aniListTitlesAndSynonyms = [...aniListData.title, ...aniListData.synonyms];

    const url = `${this.baseUrl}/filter?key=${encodeURIComponent(normalizedQuery)}`;
    const html = await _makeRequest(url);

    const results = [];
    const validTitles: { title: string; url: string; score: number }[] = [];

    // Match each card: <a href="/hentai/..." class="hs-card group">
    const cardRegex = /<a\s+href="(\/hentai\/[^"]+)"\s+class="hs-card[^"]*"[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/g;
    let match;

    while ((match = cardRegex.exec(html)) !== null) {
      const path  = match[1];
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      const fullUrl = `${this.baseUrl}${path}`;

      const score = filterBySimilarity(title, aniListTitlesAndSynonyms, this.threshold);
      if (score !== null) {
        validTitles.push({ title, url, score });
      }

      results.push({
        id,
        title,
        url,
        subOrDub: "sub",
      });
    }

    if (validTitles.length > 0) {
      const best = validTitles.reduce((a, b) => a.score > b.score ? a );
      const match = results.find(r => r.title === best.title);
      if (match) return [match];
    }

    if (results.length > 0) return [results[0]];

    throw new Error("No results found for: " + query.query);
  }

  async findEpisodes(id): Promise<EpisodeDetails[]> {
    const url = `${this.baseUrl}${id}`;
    const html = await _makeRequest(url);
    const episodes = [];

    // <a href="/episode/overflow-D9vBY/ep-1" class="ep-tile" title="Episodio 1">1
    const epRegex = /<a\s+href="(\/episode\/[^"]+)"\s+class="ep-tile"\s+title="([^"]+)"[^>]*>(\d+)/g;
    let match;

    while ((match = epRegex.exec(html)) !== null) {
      const path   = match[1];
      const title  = match[2].trim();
      const number = parseInt(match[3]);

      episodes.push({
        id,
        title,
        number,
        url: `${this.baseUrl}${path}`,
      });
    }

    return episodes;
  }

  async findEpisodeServer(episode, _server): Promise<EpisodeServer> {
    // 1. Fetch the watch page (iframe lives under /hentai/, not /episode/)
    const watchUrl = episode.url.replace("/episode/", "/hentai/");
    const html = await _makeRequest(watchUrl);

    const iframeMatch = html.match(/<iframe[^>]+id="watch-iframe"[^>]+src="([^"]+)"/);
    if (!iframeMatch) throw new Error("Could not find player iframe");

    const iframeSrc = iframeMatch[1].replace(/&amp;/g, "&");

    // iframeSrc: https://play.hentaisaturn.tv/embed/2013?token=...&expires=...
    const embedUrl  = new URL(iframeSrc);
    const token     = embedUrl.searchParams.get("token") || "";
    const expires   = embedUrl.searchParams.get("expires") || "";
    const embedId   = embedUrl.pathname.split("/embed/")[1];

    // 2. Call the playlist endpoint with the iframe as referer
    const playlistUrl = `${this.playUrl}/embed/${embedId}/playlist?token=${token}&expires=${expires}`;
    const playlistRes = await fetch(playlistUrl, {
      headers: {
        "Referer",
        "Origin": this.playUrl,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      },
    });

    if (!playlistRes.ok) throw new Error(`Playlist request failed: ${playlistRes.status} ${playlistRes.statusText}`);

    const raw = await playlistRes.text();
    console.log("Playlist raw response:", raw);

    let json: { d: string; p: string; t: string };
    try {
      json = JSON.parse(raw);
    } catch (e) {
      throw new Error("Playlist response is not JSON: " + raw.slice(0, 200));
    }

    if (!json.d) throw new Error("Playlist JSON missing \'d\' field: " + raw.slice(0, 200));

    // 3. XOR-decrypt the base64-encoded URL using the token
    const videoUrl = decodeSaturn(json.d, token);
    console.log("Decoded video URL:", videoUrl);
    if (!videoUrl) throw new Error("Failed to decode video URL");

    return {
      server: "Server 1",
      headers: {
        "Referer": `${this.playUrl}/`,
      },
      videoSources: [
        { url, type: "mp4" },
      ],
    };
  }
}

// ── Decode helpers ────────────────────────────────────────────────────────────

function decodeSaturn(encoded, token): string {
  const data    = base64Decode(encoded);
  const decoded = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    decoded[i] = data[i] ^ token.charCodeAt(i % token.length);
  }
  // UTF-8 decode manually
  let result = "";
  let i = 0;
  while (i < decoded.length) {
    const b = decoded[i];
    if (b < 0x80) {
      result += String.fromCharCode(b); i++;
    } else if ((b & 0xE0) === 0xC0) {
      result += String.fromCharCode(((b & 0x1F) << 6) | (decoded[i+1] & 0x3F)); i += 2;
    } else if ((b & 0xF0) === 0xE0) {
      result += String.fromCharCode(((b & 0x0F) << 12) | ((decoded[i+1] & 0x3F) << 6) | (decoded[i+2] & 0x3F)); i += 3;
    } else {
      i++;
    }
  }
  return result;
}

function base64Decode(b64): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup, number> = {};
  for (let i = 0; i < chars.length; i++) lookup[chars[i]] = i;

  const clean = b64.replace(/=+$/, "");
  const bytes = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let out = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean[i]]     ?? 0;
    const b = lookup[clean[i + 1]] ?? 0;
    const c = lookup[clean[i + 2]] ?? 0;
    const d = lookup[clean[i + 3]] ?? 0;
    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    if (i + 1 < clean.length) bytes[out++] = (triple >> 16) & 0xFF;
    if (i + 2 < clean.length) bytes[out++] = (triple >> 8)  & 0xFF;
    if (i + 3 < clean.length) bytes[out++] =  triple        & 0xFF;
  }

  return bytes.slice(0, out);
}

// ── Shared utilities (kept from original) ────────────────────────────────────

function normalizeQuery(query): string {
  const extras = [
    'EXTRA PART', 'OVA', 'SPECIAL', 'RECAP', 'FINAL SEASON',
    'BONUS', 'SIDE STORY', 'PART\\s*\\d+', 'EPISODE\\s*\\d+',
  ];
  const pattern = new RegExp(`\\b(${extras.join('|')})\\b`, 'gi');

  let q = query
    .replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1')
    .replace(/(\d+)\s*Season/i, '$1')
    .replace(/Season\s*(\d+)/i, '$1')
    .replace(pattern, '')
    .replace(/-.*?-/g, '')
    .replace(/\bThe(?=\s+Movie\b)/gi, '')
    .replace(/~/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const m = q.match(/[^a-zA-Z0-9 ]/);
  if (m) q = q.slice(0, m.index).trim();
  return q;
}

async function _makeRequest(url): Promise<string> {
  try {
    let response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Referer': 'https://www.hentaisaturn.tv/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
        'Cookie': '__ddg1_=;__ddg2_=;',
      },
    });

    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
    let body = await response.text();

    const cookieMatch = body.match(/document\.cookie="([^"]+)"/);
    if (cookieMatch) {
      const cookie = cookieMatch[1].split(";")[0];
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Referer': 'https://www.hentaisaturn.tv/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
          'Cookie',
        },
      });
      if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
      body = await response.text();
    }

    return body;
  } catch (error) {
    console.error(error);
    return "";
  }
}

async function getAniListAnimeDetails(query, id = 0): Promise<AniListAnimeDetails> {
  const aniListAPI = 'https://graphql.anilist.co';
  const variables  = id === 0 ? { search: query } : { mediaId: id };
  const aniListQuery = id === 0
    ? `query($search) { Media(search: $search) { title { romaji english } synonyms } }`
    : `query($mediaId) { Media(id: $mediaId) { title { romaji english } synonyms } }`;

  const res  = await fetch(aniListAPI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) throw new Error(`AniList fetch failed: ${res.statusText}`);

  const data = await res.json();
  const titles = [];
  if (data.data.Media.title.english) titles.push(data.data.Media.title.english);
  if (data.data.Media.title.romaji)  titles.push(data.data.Media.title.romaji);

  return { title, synonyms: data.data.Media.synonyms ?? [], year: 0 };
}

function filterBySimilarity(input, candidates, threshold): number | null {
  if (!input.trim()) return null;
  const norm = normalizeStringBeforeLevenshtein(input);
  const matches = candidates
    .map(c => ({ score: similarityScore(norm, normalizeStringBeforeLevenshtein(c)) }))
    .filter(m => m.score >= threshold);
  if (!matches.length) return null;
  return matches.reduce((a, b) => a.score > b.score ? a ).score;
}

function similarityScore(a, b): number {
  const dist = levenshteinDistance(a, b);
  const max  = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - dist / max;
}

function levenshteinDistance(a, b): number {
  const matrix = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function normalizeStringBeforeLevenshtein(input): string {
  return input.replace(/Season/gi, '').replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1').replace(/\s+/g, ' ').trim().toLowerCase();
}

// ── Interfaces ────────────────────────────────────────────────────────────────



;
      synonyms: string[];
    };
  };
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "HentaiSaturn", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
      } catch (e) { cb({ success: false, message: String(e) }); }
    }
    async function search(query, page, cb) {
      try {
        if (typeof globalThis.searchImpl === 'function') return await globalThis.searchImpl(query, page, cb);
        cb({ success: true, data: [] });
      } catch (e) { cb({ success: false, message: String(e) }); }
    }
    async function load(url, cb) {
      try {
        if (typeof globalThis.loadImpl === 'function') return await globalThis.loadImpl(url, cb);
        cb({ success: true, data: new MultimediaItem({ title: "HentaiSaturn", url, type: manifest.type }) });
      } catch (e) { cb({ success: false, message: String(e) }); }
    }
    async function loadStreams(url, cb) {
      try {
        if (typeof globalThis.loadStreamsImpl === 'function') return await globalThis.loadStreamsImpl(url, cb);
        cb({ success: true, data: [] });
      } catch (e) { cb({ success: false, message: String(e) }); }
    }
    globalThis.getHome = globalThis.getHome || getHome;
    globalThis.search = globalThis.search || search;
    globalThis.load = globalThis.load || load;
    globalThis.loadStreams = globalThis.loadStreams || loadStreams;
})();