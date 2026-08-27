(function() {
    var manifest = {"packageName":"com.eternalnexus.mangacloud","name":"MangaCloud","version":1,"description":"MangaCloud is a manga provider for Seanime","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"manga","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};
class Provider {
  constructor() {
    this.api = "https://api.mangacloud.org";
    this.site = "https://mangacloud.org";
    this.cdn = "https://pika.mangacloud.org";
  }

  getSettings() {
    return {
      supportsMultiLanguage: false,
      supportsMultiScanlator: false,
    };
  }

  async search(opts) {
    const url = `${this.api}/comic/browse`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: this.site,
          referer: `${this.site}/`,
        },
        body: JSON.stringify({ title: opts.query }),
      });

      if (!response.ok) return [];

      const json = await response.json();
      const items = Array.isArray(json?.data) ? json.data : [];

      return items
        .map((item) => {
          const coverId = item?.cover?.id;
          const coverExt = item?.cover?.f;

          const image =
            item?.id && coverId && coverExt
              ? `${this.cdn}/${item.id}/${coverId}.${coverExt}`
              : undefined;

          return {
            id: String(item?.id ?? ""),
            title: item?.title ?? "Untitled",
            image,
            synonyms: undefined,
            year: undefined,
          };
        })
        .filter((m) => Boolean(m.id));
    } catch (e) {
      console.error("Search error:", e);
      return [];
    }
  }

  async findChapters(mangaId) {
    const url = `${this.api}/comic/${encodeURIComponent(mangaId)}`;

    try {
      const response = await fetch(url, {
        headers: {
          origin: this.site,
          referer: `${this.site}/`,
        },
      });

      if (!response.ok) return [];

      const json = await response.json();
      const chapters = Array.isArray(json?.data?.chapters) ? json.data.chapters : [];

      const mapped = chapters
        .map((ch) => {
          const number = ch?.number;

          return {
            id: String(ch?.id ?? ""),
            url: `${this.site}/comic/${encodeURIComponent(mangaId)}`,
            title: `Chapter ${number ?? "?"}`,
            chapter: number != null ? String(number) : "0",
            index: 0,
          };
        })
        .filter((c) => Boolean(c.id));

      mapped.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));
      mapped.forEach((c, i) => {
        c.index = i;
      });

      return mapped;
    } catch (e) {
      console.error("findChapters error:", e);
      return [];
    }
  }

  async findChapterPages(chapterId) {
    const url = `${this.api}/chapter/${encodeURIComponent(chapterId)}`;

    try {
      const response = await fetch(url, {
        headers: {
          origin: this.site,
          referer: `${this.site}/`,
        },
      });

      if (!response.ok) return [];

      const json = await response.json();
      const comicId = json?.data?.comic_id;
      const images = Array.isArray(json?.data?.images) ? json.data.images : [];

      if (!comicId) return [];

      return images
        .map((img, index) => {
          const ext = img?.f;
          const imgId = img?.id;

          if (!imgId || !ext) return null;

          return {
            url: `${this.cdn}/${comicId}/${chapterId}/${imgId}.${ext}`,
            index,
            headers: {
              Referer: `${this.site}/`,
            },
          };
        })
        .filter(Boolean);
    } catch (e) {
      console.error("findChapterPages error:", e);
      return [];
    }
  }
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "MangaCloud", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "MangaCloud", url, type: manifest.type }) });
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