(function() {
    var manifest = {"packageName":"com.eternalnexus.komikcast","name":"KomikCast","version":1,"description":"KomikCast is a manga provider for Seanime","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"manga","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};
/**
 * Komikcast Extension
 * Implements MangaProvider interface for 'https://be.komikcast.fit'.
 */
class Provider {

    constructor() {
        // Base URL for the JSON API
        this.api = 'https://be.komikcast.fit';
        // Base URL for headers
        this.baseUrl = 'https://v1.komikcast.fit';
    }

    getSettings() {
        return {
            supportsMultiLanguage: false,
            supportsMultiScanlator: false,
        };
    }

    /**
     * Helper to get headers for requests
     */
    getHeaders() {
        return {
            'Referer': this.baseUrl,
            'Origin': this.baseUrl
        };
    }

    /**
     * Searches for manga based on a query.
     */
    async search(opts) {
        const query = opts.query || "";
        
        // Filter format: title=like="query",nativeTitle=like="query"
        const filterValue = `title=like="${query}",nativeTitle=like="${query}"`;

        const params = new URLSearchParams({
            filter: filterValue,
            takeChapter: '2',
            includeMeta: 'true',
            sort: 'latest',
            sortOrder: 'desc',
            take: '12',
            page: '1'
        });

        const url = `${this.api}/series?${params.toString()}`;

        try {
            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            if (!response.ok) return [];

            const json = await response.json();

            if (!json.data || !Array.isArray(json.data)) {
                return [];
            }

            return json.data.map(item => {
                const d = item.data;
                return {
                    id: d.slug, 
                    title: d.title,
                    image: d.coverImage, 
                };
            });
        }
        catch (e) {
            console.error("Komikcast search failed:", e);
            return [];
        }
    }

    /**
     * Finds and parses all chapters for a given manga ID.
     */
    async findChapters(mangaId) {
        const url = `${this.api}/series/${mangaId}/chapters`;

        try {
            const response = await fetch(url, {
                headers: this.getHeaders()
            });
            
            if (!response.ok) return [];

            const json = await response.json();

            if (!json.data || !Array.isArray(json.data)) {
                return [];
            }

            const chapters = json.data.map(item => {
                const d = item.data;
                const chapterIndex = d.index;
                const compositeId = `${mangaId}/${chapterIndex}`;
                const title = d.title ? d.title : `Chapter ${chapterIndex}`;

                return {
                    id: compositeId,
                    title: title,
                    chapter: chapterIndex.toString(),
                    rawIndex: typeof chapterIndex === 'number' ? chapterIndex : parseFloat(chapterIndex)
                };
            });

            // Sort oldest to newest
            chapters.sort((a, b) => a.rawIndex - b.rawIndex);

            return chapters.map((chap, i) => ({
                id: chap.id,
                title: chap.title,
                chapter: chap.chapter,
                index: i
            }));
        }
        catch (e) {
            console.error("Komikcast findChapters failed:", e);
            return [];
        }
    }

    /**
     * Finds and parses the image pages for a given chapter ID.
     */
    async findChapterPages(chapterId) {
        const parts = chapterId.split('/');
        
        if (parts.length < 2) return [];

        const slug = parts[0];
        const index = parts[1];

        const url = `${this.api}/series/${slug}/chapters/${index}`;

        try {
            const response = await fetch(url, {
                headers: this.getHeaders()
            });

            if (!response.ok) return [];

            const json = await response.json();
            const images = json.data?.data?.images;

            if (!images || !Array.isArray(images)) {
                return [];
            }

            return images.map((imgUrl, i) => ({
                url: imgUrl,
                index: i,
                headers: this.getHeaders()
            }));
        }
        catch (e) {
            console.error("Komikcast findChapterPages failed:", e);
            return [];
        }
    }
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "KomikCast", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "KomikCast", url, type: manifest.type }) });
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