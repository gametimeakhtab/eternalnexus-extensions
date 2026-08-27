(function() {
    var manifest = {"packageName":"com.eternalnexus.atsumaru","name":"Atsumaru","version":1,"description":"Atsumaru is a manga provider for Seanime","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"manga","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};
/**
 * Seanime Extension for Atsu.moe
 * Implements MangaProvider interface for 'https://atsu.moe'.
 */
class Provider {

    constructor() {
        this.api = 'https://atsu.moe';
        this.imgCdn = 'https://atsu.moe';
    }

    api = '';
    imgCdn = '';

    getSettings() {
        return {
            supportsMultiLanguage: false,
            supportsMultiScanlator: false,
        };
    }

    async search(opts) {
        const query = opts.query;
        const url = `${this.api}/collections/manga/documents/search?q=${encodeURIComponent(query)}&query_by=title%2CenglishTitle%2CotherNames`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Referer': `${this.api}/`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                },
            });

            if (!response.ok) return [];

            const data = await response.json();

            if (!data.hits || !Array.isArray(data.hits)) return [];

            return data.hits
                .filter(hit => hit.document && hit.document.type === 'Manga')
                .map(hit => ({
                    id: hit.document.id,
                    title: hit.document.title,
                    image: hit.document.posterMedium
                        ? `${this.imgCdn}${hit.document.posterMedium}`
                        : hit.document.poster
                            ? `${this.imgCdn}${hit.document.poster}`
                            : undefined,
                }));
        } catch (e) {
            return [];
        }
    }

    async findChapters(mangaId) {
        const url = `${this.api}/api/manga/allChapters?mangaId=${encodeURIComponent(mangaId)}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Referer': `${this.api}/`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                },
            });

            if (!response.ok) return [];

            const data = await response.json();

            if (!data.chapters || !Array.isArray(data.chapters)) return [];

            const chapters = data.chapters.map(chapter => ({
                // Encode both mangaId and chapterId so findChapterPages can reconstruct the request
                id: `${mangaId}|${chapter.id}`,
                url: `${this.api}/read/${mangaId}/${chapter.id}`,
                title: chapter.title || `Chapter ${chapter.number}`,
                chapter: String(chapter.number),
                index: chapter.index,
            }));

            // Sort numerically ascending by chapter number
            chapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));
            chapters.forEach((c, i) => { c.index = i; });

            return chapters;
        } catch (e) {
            return [];
        }
    }

    async findChapterPages(chapterId) {
        // chapterId is "mangaId|chapterId"
        const separatorIndex = chapterId.indexOf('|');
        const mangaId = chapterId.substring(0, separatorIndex);
        const chapId = chapterId.substring(separatorIndex + 1);

        const url = `${this.api}/api/read/chapter?mangaId=${encodeURIComponent(mangaId)}&chapterId=${encodeURIComponent(chapId)}`;
        const referer = `${this.api}/read/${mangaId}/${chapId}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Referer': referer,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                },
            });

            if (!response.ok) return [];

            const data = await response.json();

            if (!data.readChapter || !Array.isArray(data.readChapter.pages)) return [];

            return data.readChapter.pages.map(page => ({
                url: page.image.startsWith('http') ? page.image : `${this.api}${page.image}`,
                index: page.number,
                headers: { 'Referer': referer },
            }));
        } catch (e) {
            return [];
        }
    }
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "Atsumaru", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "Atsumaru", url, type: manifest.type }) });
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