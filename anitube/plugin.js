(function() {
    var manifest = {"packageName":"com.eternalnexus.anitube","name":"AniTube","version":1,"description":"AniTube is an online streaming provider for portugese subs.","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"video","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};


class Provider {
  constructor() {
    this.base = "https://www.anitube.news";
  }

  getSettings() {
    return {
      episodeServers: ["Server 1"],
      supportsDub,
    };
  }

  async search(query) {
    const searchUrl = `${this.base}/?s=${encodeURIComponent(query.query)}`;
    const res = await fetch(searchUrl);
    const html = await res.text();

    const results = [];

    // Robust Regex: Captures the <a> tag attributes and inner content separately
    const regex = /<div class="aniItem">\s*<a([^>]+)>([\s\S]*?)<\/a>/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const attrString = match[1];
      const innerContent = match[2];

      const hrefMatch = attrString.match(/href="([^"]+)"/);
      if (!hrefMatch) continue;
      const url = hrefMatch[1];

      const titleMatch = attrString.match(/title="([^"]+)"/);
      let rawTitle = titleMatch ? titleMatch[1] : "";

      const isDub = /<div class="aniCC">\s*Dublado\s*<\/div>/i.test(innerContent);

      if (query.dub && !isDub) continue;
      if (!query.dub && isDub) continue;

      rawTitle = rawTitle.trim();
      if (rawTitle.includes(" – ")) {
        rawTitle = rawTitle.split(" – ")[0].trim();
      } else if (rawTitle.includes(" - ")) {
        rawTitle = rawTitle.split(" - ")[0].trim();
      }

      results.push({
        id,
        title,
        url,
        subOrDub: isDub ? "dub" : "sub",
      });
    }

    if (!results.length) throw new Error("No anime found");
    return results;
  }

  async findEpisodes(id) {
    const res = await fetch(id);
    const html = await res.text();
    const episodes = [];

    const containerRegex = /<div class="pagAniListaContainer[^"]*">([\s\S]*?)<\/div>/;
    const containerMatch = html.match(containerRegex);

    if (containerMatch) {
      const linkRegex = /<a href="([^"]+)" title="([^"]+)">([^<]+)<\/a>/g;
      let linkMatch;

      while ((linkMatch = linkRegex.exec(containerMatch[1])) !== null) {
        const epTitle = linkMatch[3];
        const numberMatch = epTitle.match(/Episódio\s+(\d+)/i);
        const number = numberMatch ? parseInt(numberMatch[1]) : 0;

        episodes.push({
          id,
          title,
          number,
          url,
        });
      }
    }

    return episodes;
  }

  async findEpisodeServer(episode, server) {
    const res = await fetch(episode.url);
    const html = await res.text();

    // Strategy 1: Blog2 (Preferred)
    const blog2Regex = /<div id="blog2"[^>]*>[\s\S]*?<iframe[^>]*src="([^"]+)"/i;
    const blog2Match = html.match(blog2Regex);

    if (blog2Match) {
      const embedUrl = blog2Match[1];
      const embedRes = await fetch(embedUrl);
      const embedHtml = await embedRes.text();
      const fileRegex = /file:\s*'([^']+)'/;
      const fileMatch = embedHtml.match(fileRegex);

      if (fileMatch) {
        return {
          server: "default",
          videoSources: [{ 
            url, 
            quality: "auto", 
            type: "hls",
            headers: { "Referer": embedRes.url } // Pass the player URL as Referer
          }],
        };
      }
    }

    // Strategy 2: Blog1 (Fallback)
    const blog1Regex = /<div id="blog1"[^>]*>[\s\S]*?<iframe[^>]*src="([^"]+)"/i;
    const blog1Match = html.match(blog1Regex);

    if (blog1Match) {
      const embedUrl = blog1Match[1];

      // Fetch with Referer header to handle the redirect correctly
      const embedRes = await fetch(embedUrl, {
        headers: { "Referer": this.base }
      });
      const embedHtml = await embedRes.text();

      const fixedReferer = "https://api.anivideo.net/";

      // Deobfuscate the packed script
      const unpacked = this.unPack(embedHtml);
      if (unpacked) {
        const sourcesRegex = /sources:\s*\[([\s\S]*?)\]/;
        const sourcesMatch = unpacked.match(sourcesRegex);

        if (sourcesMatch) {
          const sourcesContent = sourcesMatch[1];
          const videoSources = [];

          const fileObjRegex = /\{\s*["']?file["']?:\s*["']([^"']+)["'](?:,\s*[^}]+?)?,\s*["']?label["']?:\s*["']([^"']+)["']/g;

          let srcMatch;
          while ((srcMatch = fileObjRegex.exec(sourcesContent)) !== null) {
             videoSources.push({
               url,
               quality,
               type: "mp4",
               headers: { "Referer": fixedReferer } // Changed from finalReferer to fixedReferer
             });
          }

          if (videoSources.length > 0) {
            return {
              server: "default",
              videoSources: videoSources
            };
          }
        }
      }
    }

    throw new Error("No supported stream found (checked blog2 and blog1)");
  }

  // Helper to handle the packed script found in Blog1
  unPack(code) {
    const regex = /eval\(function\(p,a,c,k,e,d\).*?return p\}\('([\s\S]*?)',(\d+),(\d+),'(.*?)'\.split\('\|'\)/;
    const match = code.match(regex);
    if (!match) return null;

    let [_, p, a, c, k] = match;
    a = parseInt(a);
    c = parseInt(c);
    k = k.split('|');

    const e = (n) => {
      return (n < a ? '' : e(parseInt(n / a))) + ((n = n % a) > 35 ? String.fromCharCode(n + 29) : n.toString(36));
    };

    for (let i = c; i--; ) {
        if (k[i]) {
            p = p.replace(new RegExp('\\b' + e(i) + '\\b', 'g'), k[i]);
        }
    }
    return p;
  }
}
    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "AniTube", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "AniTube", url, type: manifest.type }) });
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