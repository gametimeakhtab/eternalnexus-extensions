(function() {
    var manifest = {"packageName":"com.eternalnexus.mynimeku","name":"MyNimeKu","version":1,"description":"MyNimeKu is an online streaming provider for indonesian subs.","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"video","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};


class Provider {
  constructor() {
    this.baseUrl = "https://www.mynimeku.com";
  }

  getSettings() {
    return {
      episodeServers: ["CLOUD", "DRIVE", "PROXY"],
      supportsDub,
    };
  }

  async search(query) {
    const searchUrl = `${this.baseUrl}/search/${encodeURIComponent(query.query)}/`;
    const res = await fetch(searchUrl);
    const html = await res.text();

    const results = [];

    // Match full article blocks so we can inspect the 
    let article;
    while ((article = articleRegex.exec(html)) !== null) {
      const block = article[0];

      // Skip manga entries (they use /komik/ URLs)
      if (!block.includes('/series/')) continue;

      const coverMatch = block.match(
        /<a class="mynimeku-search-feed__cover"[^>]*href="(https:\/\/www\.mynimeku\.com\/series\/[^"]+)"[^>]*aria-label="([^"]+)"/
      );
      const imageMatch = block.match(/<img[^>]*src="([^"]+)"/);

      if (!coverMatch) continue;

      const url   = coverMatch[1];
      const title = coverMatch[2].trim();
      const image = imageMatch ? imageMatch[1] : "";

      results.push({
        id,
        title,
        url,
        image,
        subOrDub: "sub",
      });
    }

    if (!results.length) throw new Error("No anime found");
    return results;
  }

  async findEpisodes(id) {
    const res = await fetch(id);
    const html = await res.text();
    const episodes = [];

    // Match each episode link block
    const epRegex = /<a[^>]*class='komik-series-chapter-item'[^>]*data-episode-number='(\d+)'[^>]*href='([^']+)'[^>]*>[\s\S]*?<span class='komik-series-chapter-item__title'>([^<]+)<\/span>/g;

    let match;
    while ((match = epRegex.exec(html)) !== null) {
      const number = parseInt(match[1]);
      const url    = match[2];
      const title  = match[3].trim();

      episodes.push({ id, title, number, url });
    }

    return episodes.reverse();
  }

  async findEpisodeServer(episode, server) {
    const res = await fetch(episode.url);
    const html = await res.text();

    const serverRegex = /<button[^>]*class='mynimeku-episode-server-btn[^']*'[^>]*data-player-url='([^']+)'[^>]*data-player-host='([^']+)'[^>]*>/g;

    const candidates = [];
    let match;
    const targetServer = server.toUpperCase();

    while ((match = serverRegex.exec(html)) !== null) {
      const url  = match[1].replace(/&#038;/g, "&");
      const host = match[2].toUpperCase();

      if (host.includes(targetServer)) {
        const resolutionMatch = host.match(/(\d+)[pP]/);
        const resolution = resolutionMatch ? parseInt(resolutionMatch[1]) : 0;
        candidates.push({ url, host, resolution });
      }
    }

    if (candidates.length === 0) {
      const firstMatch = html.match(/data-player-url='([^']+)'/);
      if (firstMatch) {
        candidates.push({ url: firstMatch[1].replace(/&#038;/g, "&"), resolution: 0 });
      } else {
        throw new Error("No server URL found");
      }
    }

    candidates.sort((a, b) => b.resolution - a.resolution);
    const selectedUrl = candidates[0].url;

    return {
      server,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      videoSources: [
        { url, type: "mp4" },
      ],
    };
  }
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "MyNimeKu", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "MyNimeKu", url, type: manifest.type }) });
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