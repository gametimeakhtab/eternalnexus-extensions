(function() {
    var manifest = {"packageName":"com.eternalnexus.anidb","name":"AniDB","version":1,"description":"AniDB is an online streaming provider for subbed & dubbed anime in english","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"video","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};
/// <reference path="./online-streaming-provider.d.ts" />

class Provider {
  constructor() {
    this.base = "https://anidb.app";
  }

  getSettings() {
    return {
      episodeServers: ["SUB", "DUB"],
      supportsDub: true,
    };
  }

  async search(query) {
    const searchUrl = `${this.base}/browse?q=${encodeURIComponent(query.query)}`;
    const res = await fetch(searchUrl);
    const html = await res.text();

    const results = [];

    // Match each anime card anchor — href is a full URL, title is the anime name
    // e.g. <a href="https://anidb.app/anime/horimiya-2264" class="anime-card block group" title="Horimiya">
    const cardRegex = /<a href="(https?:\/\/anidb\.app\/anime\/[^"]+)" class="anime-card[^"]*" title="([^"]+)"/g;
    let match;

    while ((match = cardRegex.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].trim();

      results.push({
        id: url,
        title: title,
        url: url,
        subOrDub: "sub",
      });
    }

    if (!results.length) throw new Error("No anime found");
    return results;
  }

  async findEpisodes(id) {
    // Extract the numeric anime ID from the URL slug (e.g. /anime/horimiya-2264 → 2264)
    const animeIdMatch = id.match(/-(\d+)$/);
    if (!animeIdMatch) throw new Error("Could not extract anime ID from URL: " + id);
    const animeId = animeIdMatch[1];

    const apiUrl = `${this.base}/api/frontend/anime/${animeId}/episodes`;
    const res = await fetch(apiUrl);
    const data = await res.json();

    if (!data.episodes || !data.episodes.length) throw new Error("No episodes found");

    const episodes = data.episodes.map((ep, idx) => ({
      id: String(ep.id),
      title: `Episode ${idx + 1}`,
      number: idx + 1,
      url: `${this.base}/api/frontend/episode/${ep.id}/languages`,
    }));

    return episodes;
  }

  async findEpisodeServer(episode, server) {
    const res = await fetch(episode.url);
    const data = await res.json();

    if (!data.languages || !data.languages.length) throw new Error("No language streams found");

    // Map server name to language code
    const langCode = server === "DUB" ? "eng" : "jpn";

    const lang = data.languages.find((l) => l.code === langCode);
    if (!lang) throw new Error(`Language not available for server: ${server}`);

    // Fetch the embed page and extract the HLS source
    const embedRes = await fetch(lang.embed_url);
    const embedHtml = await embedRes.text();

    const srcMatch = embedHtml.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*'([^']+)'/i)
      || embedHtml.match(/file\s*:\s*'(https?:\/\/[^']+\.m3u8[^']*)'/i)
      || embedHtml.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)['"]/);

    if (!srcMatch) throw new Error("Could not extract HLS stream from embed");

    return {
      server: server,
      headers: {
        "Origin": "https://anidb.app",
        "Referer": "https://anidb.app/",
      },
      videoSources: [{
        url: srcMatch[1],
        quality: "auto",
        type: "hls",
      }],
    };
  }
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "AniDB", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "AniDB", url, type: manifest.type }) });
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