(function() {
    var manifest = {"packageName":"com.eternalnexus.lelmanga","name":"LelManga","version":1,"description":"LelManga is a manga provider for Seanime","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"manga","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};
/**
 * Seanime Extension for LelManga
 * Implements MangaProvider interface for 'https://www.lelmanga.com'.
 */
class Provider {

    constructor() {
        this.api = 'https://www.lelmanga.com';
    }

    api = '';

    getSettings() {
        return {
            supportsMultiLanguage: false,
            supportsMultiScanlator: false,
        };
    }

    async search(opts) {
        const query = opts.query;
        const url = `${this.api}/?s=${encodeURIComponent(query)}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                    'Referer': this.api,
                },
            });

            if (!response.ok) return [];

            const html = await response.text();
            const results = [];

            // Match every manga anchor directly — avoids brittle nested-div counting
            const anchorRegex = /<a\s+href="(https?:\/\/www\.lelmanga\.com\/manga\/([^"]+))"\s+title="([^"]+)">([\s\S]*?)<\/a>/g;
            let match;

            while ((match = anchorRegex.exec(html)) !== null) {
                const href  = match[1];
                const slug  = match[2].replace(/\/$/, '');
                const title = match[3].trim();
                const inner = match[4];

                // Extract cover image
                const imgMatch = inner.match(/<img[^>]+src="([^"]+)"/);
                const image = imgMatch ? imgMatch[1] : undefined;

                results.push({
                    id: slug,
                    title: title,
                    image: image,
                });
            }

            return results;
        } catch (e) {
            return [];
        }
    }

    async findChapters(mangaId) {
        const url = `${this.api}/manga/${mangaId}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                    'Referer': this.api,
                },
            });

            if (!response.ok) return [];

            const html = await response.text();
            const chapters = [];

            // Match <li data-num="..."> directly — no outer-div extraction needed
            const liRegex = /<li\s+data-num="([^"]+)">([\s\S]*?)<\/li>/g;
            let liMatch;

            while ((liMatch = liRegex.exec(html)) !== null) {
                const chapNum = liMatch[1].trim();
                const liInner = liMatch[2];

                // Extract chapter URL
                const aMatch = liInner.match(/<a\s+href="([^"]+)"/);
                if (!aMatch) continue;
                const chapUrl = aMatch[1];

                // Extract chapter title label
                const titleMatch = liInner.match(/<span class="chapternum">([^<]+)<\/span>/);
                const title = titleMatch ? titleMatch[1].trim() : `Chapitre ${chapNum}`;

                chapters.push({
                    id: chapUrl,
                    url: chapUrl,
                    title: title,
                    chapter: chapNum,
                    index: 0,
                });
            }

            // Sort numerically ascending
            chapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));
            chapters.forEach((c, i) => { c.index = i; });

            return chapters;
        } catch (e) {
            return [];
        }
    }

    async findChapterPages(chapterId) {
        const url = chapterId;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                    'Referer': this.api,
                },
            });

            if (!response.ok) return [];

            const html = await response.text();

            // Extract #readerarea block
            const readerMatch = html.match(/<div[^>]+id="readerarea"[^>]*>([\s\S]*?)<\/div>/);
            if (!readerMatch) return [];

            const readerHtml = readerMatch[1];
            const pages = [];

            const imgRegex = /<img[^>]+src="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp|gif)[^"]*)"/gi;
            let imgMatch;
            let index = 0;

            while ((imgMatch = imgRegex.exec(readerHtml)) !== null) {
                const imgUrl = imgMatch[1];

                // Skip WordPress thumbnails (small resize hints)
                if (imgUrl.includes('resize=165') || imgUrl.includes('resize=130')) continue;

                pages.push({
                    url: imgUrl,
                    index: index++,
                    headers: { 'Referer': url },
                });
            }

            return pages;
        } catch (e) {
            return [];
        }
    }
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "LelManga", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "LelManga", url, type: manifest.type }) });
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