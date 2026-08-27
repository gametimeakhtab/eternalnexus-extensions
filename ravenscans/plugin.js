(function() {
    var manifest = {"packageName":"com.eternalnexus.ravenscans","name":"RavenScans","version":1,"description":"RavenScans is a manga provider for Seanime","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"manga","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};
class Provider {
  constructor() {
    this.api = "https://ravenscans.org";
  }

  getSettings() {
    return {
      supportsMultiLanguage: false,
      supportsMultiScanlator: false,
    };
  }

  async fetchWithHeaders(url) {
    return fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: this.api,
      },
    });
  }

  async search(opts) {
    const url = `${this.api}/?s=${encodeURIComponent(opts.query)}`;
    try {
      const response = await this.fetchWithHeaders(url);
      if (!response.ok) return [];
      const html = await response.text();

      const mangas = [];
      const seen = new Set();

      const bsxRegex = /<div class="bsx">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
      let bsxMatch;

      while ((bsxMatch = bsxRegex.exec(html)) !== null) {
        const block = bsxMatch[1];

        const aMatch = /href="([^"]+)"[^>]*title="([^"]+)"/.exec(block);
        if (!aMatch) continue;

        const href = aMatch[1];
        const title = aMatch[2];

        const imgMatch = /src="([^"]+\.(jpg|jpeg|png|webp)[^"]*)"/.exec(block);
        const image = imgMatch ? imgMatch[1] : "";

        const slugMatch = /\/(manga|series)\/([^/]+)\/?$/.exec(href);
        if (!slugMatch) continue;
        const slug = slugMatch[2];

        if (seen.has(slug)) continue;
        seen.add(slug);

        mangas.push({
          id: slug,
          title: title.trim(),
          image,
        });
      }

      return mangas;
    } catch (e) {
      console.error("Search error:", e);
      return [];
    }
  }

  async findChapters(mangaId) {
    for (const prefix of ["manga", "series"]) {
      const comicUrl = `${this.api}/${prefix}/${mangaId}/`;
      try {
        const response = await this.fetchWithHeaders(comicUrl);
        if (!response.ok) continue;
        const html = await response.text();

        const chapters = [];
        const seen = new Set();

        const liBlockRegex = /<li\s+data-num="([^"]+)"[^>]*>([\s\S]*?)<\/li>/gi;
        let liMatch;

        while ((liMatch = liBlockRegex.exec(html)) !== null) {
          const chapterNum = liMatch[1];
          const liContent = liMatch[2];

          if (seen.has(chapterNum)) continue;
          seen.add(chapterNum);

          const aMatch = /href="([^"]+)"/.exec(liContent);
          if (!aMatch) continue;

          chapters.push({
            id: aMatch[1],
            title: `Chapter ${chapterNum}`,
            chapter: chapterNum,
          });
        }

        if (chapters.length > 0) {
          return chapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));
        }
      } catch (e) {
        console.error("findChapters error:", e);
      }
    }
    return [];
  }

  async findChapterPages(chapterUrl) {
    try {
      const response = await this.fetchWithHeaders(chapterUrl);
      if (!response.ok) return [];
      const html = await response.text();

      const readerMatch = /<div\s+id="readerarea"[\s\S]*?<noscript>([\s\S]*?)<\/noscript>/i.exec(html);
      if (!readerMatch) {
        console.error("Could not find readerarea noscript block");
        return [];
      }

      const noscriptContent = readerMatch[1];
      const pages = [];
      const imgRegex = /<img[^>]+src="([^"]+)"/gi;
      let match;
      let index = 0;

      while ((match = imgRegex.exec(noscriptContent)) !== null) {
        pages.push({
          url: match[1],
          index: index++,
          headers: { Referer: this.api },
        });
      }

      return pages;
    } catch (e) {
      console.error("findChapterPages error:", e);
      return [];
    }
  }
}
    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "RavenScans", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "RavenScans", url, type: manifest.type }) });
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