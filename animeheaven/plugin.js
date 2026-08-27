(function() {
    var manifest = {"packageName":"com.eternalnexus.animeheaven","name":"AnimeHeaven","version":1,"description":"AnimeHeaven is an online streaming provider for subbed anime in english","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"video","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};
/// <reference path="./online-streaming-provider.d.ts" />
class Provider {
  constructor() {
    this.base = "https://animeheaven.me";
  }

  getSettings() {
    return {
      episodeServers: ["Server 1"],
      supportsDub: false,
    };
  }

  async search(query) {
    const res = await fetch(`${this.base}/search.php?s=${encodeURIComponent(query.query)}`);
    const html = await res.text();
    const regex = /<div class='similarimg'>.*?<a href='(anime\.php\?.*?)'><img.*?alt='(.*?)'/gs;
    const results = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      const url = `${this.base}/${match[1]}`;
      const title = match[2].replace(/&#039;/g, "'");
      const id = match[1].replace("anime.php?", "");
      results.push({
        id,
        title,
        url,
        subOrDub: "sub",
      });
    }
    if (!results.length) throw new Error("No anime found");
    return results;
  }

  async findEpisodes(id) {
    const url = `${this.base}/anime.php?${id}`;
    console.log("findEpisodes fetching:", url);
    const res = await fetch(url);
    const html = await res.text();
    console.log("findEpisodes html length:", html.length);
    console.log("findEpisodes html snippet:", html.slice(0, 500));

    // Match gatea("HASH") and capture the episode number from the following watch2 div
    const regex = /onclick='gatea\("([a-f0-9]+)"\)'[^>]*>(?:[\s\S]*?)<div[^>]*\bwatch2\b[^>]*>\s*(\d+)\s*<\/div>/g;
    const episodes = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      const gateKey = match[1];
      const number = parseInt(match[2], 10);
      episodes.push({
        id: gateKey,
        title: `Episode ${number}`,
        number,
        url: `${this.base}/gate.php`,
      });
    }

    // Sort ascending since the page lists newest first
    episodes.sort((a, b) => a.number - b.number);
    return episodes;
  }

  async findEpisodeServer(episode, _server) {
    const gateKey = episode.id;
    const animeReferer = `${this.base}/anime.php`;
    const res = await fetch(`${this.base}/gate.php`, {
      headers: {
        "Cookie": `key=${gateKey}`,
        "Referer": animeReferer,
      },
    });
    const html = await res.text();

    // Try to grab the full video URL from a <source> tag
    let videoUrl = null;
    const sourceMatch = html.match(/<source[^>]+src=['"]([^'"]+\.mp4[^'"]*)['"]/i);
    if (sourceMatch) {
      videoUrl = sourceMatch[1];
    }

    // Fallback: grab from the download anchor
    if (!videoUrl) {
      const dlMatch = html.match(/href='(https?:\/\/ax\.animeheaven\.me\/video\.mp4\?[^']+)'/);
      if (dlMatch) videoUrl = dlMatch[1];
    }

    // Fallback: reconstruct from known pattern using tokens in the page
    if (!videoUrl) {
      const tokenMatch = html.match(/video\.mp4\?([a-f0-9]+)&([a-f0-9]+)/);
      if (tokenMatch) {
        videoUrl = `https://ax.animeheaven.me/video.mp4?${tokenMatch[1]}&${tokenMatch[2]}`;
      }
    }

    if (!videoUrl) throw new Error("Video URL not found in gate.php response");

    return {
      server: "AnimeHeaven",
      headers: {
        "Referer": "https://animeheaven.me/",
        "Origin": "https://animeheaven.me",
      },
      videoSources: [
        {
          url: videoUrl,
          quality: "auto",
          type: "mp4",
          subtitles: [],
        },
      ],
    };
  }
}
    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "AnimeHeaven", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "AnimeHeaven", url, type: manifest.type }) });
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