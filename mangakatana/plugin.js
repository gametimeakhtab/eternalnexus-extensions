(function() {
    var manifest = {"packageName":"com.eternalnexus.mangakatana","name":"MangaKatana","version":1,"description":"MangaKatana is a manga provider for Seanime","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"manga","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};
class Provider {
  constructor() {
    this.api = "https://mangakatana.com";
  }

  getSettings() {
    return {
      supportsMultiLanguage: false,
      supportsMultiScanlator: false,
    };
  }

  async search(opts) {
    const url = `${this.api}/?search=${encodeURIComponent(opts.query)}&search_by=m_name`;

    try {
      const response = await fetch(url, {
        headers: {
          Referer: `${this.api}/`,
        },
      });

      if (!response.ok) return [];

      const html = await response.text();

      if (response.redirected && /\/manga\//i.test(response.url)) {
        const idMatch = /\/manga\/([^/?#]+)/i.exec(response.url);
        const id = idMatch?.[1] ? String(idMatch[1]).trim() : "";
        if (!id) return [];

        const title =
          /<meta\s+property="og:title"\s+content="([^"]+)"\s*\/?>/i.exec(html)?.[1]?.trim() ||
          /<h1[^>]*>([^<]+)<\/h1>/i.exec(html)?.[1]?.trim() ||
          /<title>([^<]+)<\/title>/i.exec(html)?.[1]?.trim() ||
          "Untitled";

        const cover =
          /<img[^>]+alt="\[Cover\]"[^>]+src="([^"]+)"/i.exec(html)?.[1]?.trim() ||
          /<meta\s+property="og:image"\s+content="([^"]+)"\s*\/?>/i.exec(html)?.[1]?.trim();

        const image = cover
          ? cover.startsWith("http")
            ? cover
            : `${this.api}${cover}`
          : undefined;

        return [
          {
            id,
            title,
            image,
            synonyms: undefined,
            year: undefined,
          },
        ];
      }

      const mangas = [];
      const seen = new Set();

      const itemRegex = /<div\s+class="item"[^>]*>[\s\S]*?<a\s+href="https?:\/\/mangakatana\.com\/manga\/([^"]+)"[^>]*>[\s\S]*?<img\s+src="([^"]+)"[\s\S]*?<h3\s+class="title">[\s\S]*?<a\s+href="https?:\/\/mangakatana\.com\/manga\/[^"]+"[^>]*>([^<]+)<\/a>/gi;

      let match;
      while ((match = itemRegex.exec(html)) !== null) {
        const id = match[1]?.trim();
        const rawImage = match[2]?.trim();
        const title = match[3]?.trim();

        if (!id || seen.has(id)) continue;
        seen.add(id);

        const image = rawImage
          ? rawImage.startsWith("http")
            ? rawImage
            : `${this.api}${rawImage}`
          : undefined;

        mangas.push({
          id,
          title: title || "Untitled",
          image,
          synonyms: undefined,
          year: undefined,
        });
      }

      return mangas;
    } catch (e) {
      console.error("Search error:", e);
      return [];
    }
  }

  async findChapters(mangaId) {
    const url = `${this.api}/manga/${mangaId}`;

    try {
      const response = await fetch(url, {
        headers: {
          Referer: `${this.api}/`,
        },
      });

      if (!response.ok) return [];

      const html = await response.text();

      const chapters = [];
      const seen = new Set();

      const rowRegex = /<tr[^>]*>[\s\S]*?<div\s+class="chapter">\s*<a\s+href="https?:\/\/mangakatana\.com\/manga\/[^"]+\/c([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<div\s+class="update_time">([^<]+)<\/div>[\s\S]*?<\/tr>/gi;

      let match;
      while ((match = rowRegex.exec(html)) !== null) {
        const chapterId = match[1]?.trim();
        const rawTitle = match[2]?.trim();
        const updated = match[3]?.trim();

        if (!chapterId || seen.has(chapterId)) continue;
        seen.add(chapterId);

        const chapNum = rawTitle?.match(/Chapter\s+([\d.]+)/i)?.[1] || "0";

        chapters.push({
          id: `${mangaId}/c${chapterId}`,
          url: `${this.api}/manga/${mangaId}/c${chapterId}`,
          title: updated ? `${rawTitle} — ${updated}` : rawTitle,
          chapter: chapNum,
          index: 0,
        });
      }

      chapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));
      chapters.forEach((c, i) => {
        c.index = i;
      });

      return chapters;
    } catch (e) {
      console.error("findChapters error:", e);
      return [];
    }
  }

  async findChapterPages(chapterId) {
    const url = chapterId.startsWith("http") ? chapterId : `${this.api}/manga/${chapterId}`;

    try {
      const response = await fetch(url, {
        headers: {
          Referer: `${this.api}/`,
        },
      });

      if (!response.ok) return [];

      const html = await response.text();

      const varMatch = html.match(/var\s+thzq\s*=\s*(\[[\s\S]*?\]);/i);
      if (!varMatch || !varMatch[1]) return [];

      const arrText = varMatch[1];
      const urls = [];
      const urlRegex = /'([^']+)'/g;
      let m;
      while ((m = urlRegex.exec(arrText)) !== null) {
        if (m[1]) urls.push(m[1]);
      }

      return urls.map((u, index) => ({
        url: String(u),
        index,
        headers: {
          Referer: this.api,
        },
      }));
    } catch (e) {
      console.error("findChapterPages error:", e);
      return [];
    }
  }
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "MangaKatana", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "MangaKatana", url, type: manifest.type }) });
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