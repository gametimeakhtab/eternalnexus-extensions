(function() {
    var manifest = {"packageName":"com.eternalnexus.mynimekumanga","name":"MyNimeKu (Manga)","version":1,"description":"MyNimeKu is a manga provider for Seanime","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"manga","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};
/// <reference path="./manga-provider.d.ts" />

class Provider {
  constructor() {
    this.baseUrl = "https://www.mynimeku.com";
  }

  async search(query) {
    const searchUrl = `${this.baseUrl}/search/${encodeURIComponent(query.query)}/`;
    const res = await fetch(searchUrl);
    const html = await res.text();

    const results = [];
    const regex = /<a class="mynimeku-search-feed__cover"[^>]*href="([^"]+)"[^>]*aria-label="([^"]+)"[^>]*>\s*<img[^>]*src="([^"]+)"/gs;

    let match;
    while ((match = regex.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].trim();
      const image = match[3];

      if (!url.includes("/komik/")) continue;

      results.push({
        id: url,
        title,
        url,
        image,
      });
    }

    if (!results.length) throw new Error("No manga found");
    return results;
  }

  async findChapters(id) {
    const res = await fetch(id);
    const html = await res.text();
    const chapters = [];

    const chapterRegex = /<div[^>]*data-chapter-number='([\d.]+)'[^>]*>[\s\S]*?<a[^>]*class='komik-series-chapter-item'[^>]*href='([^']+)'[^>]*>[\s\S]*?<span class='komik-series-chapter-item__title'>([^<]+)<\/span>/g;

    let match;
    while ((match = chapterRegex.exec(html)) !== null) {
      const number = match[1];
      const url = match[2];
      const title = match[3].trim();

      chapters.push({
        id: url,
        title,
        chapter: number,
      });
    }

    return chapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));
  }

  async findChapterPages(id) {
    const res = await fetch(id);
    const html = await res.text();
    const pages = [];

    const contentMatch = html.match(/<div[^>]*class="komik-reader-content"[^>]*>([\s\S]*?)<\/div>/);
    if (!contentMatch) throw new Error("Reader content not found");

    const imgRegex = /<img[^>]*src="(?:\/\/)?(image\.mydriveku\.my\.id\/api\/view-image\/[^"]+)"/g;

    let match;
    let index = 0;
    while ((match = imgRegex.exec(contentMatch[1])) !== null) {
      const url = `https://${match[1]}`;
      pages.push({
        index,
        url,
        headers: {
          "Referer": this.baseUrl + "/",
        },
      });
      index++;
    }

    if (!pages.length) throw new Error("No pages found");
    return pages;
  }
}
    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "MyNimeKu (Manga)", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "MyNimeKu (Manga)", url, type: manifest.type }) });
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