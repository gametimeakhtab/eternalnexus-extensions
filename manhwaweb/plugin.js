(function() {
    var manifest = {"packageName":"com.eternalnexus.manhwaweb","name":"ManhwaWeb","version":1,"description":"Spanish manga and manhwa provider.","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"manga","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};


class Provider {
    api = "https://manhwawebbackend-production.up.railway.app"

    getSettings(): Settings {
        return {
            supportsMultiLanguage,
            supportsMultiScanlator,
        }
    }

    async search(opts): Promise<SearchResult[]> {
        const requestRes = await fetch(`${this.api}/manhwa/library?buscar=${encodeURIComponent(opts.query)}&estado=&tipo=&erotico=&demografia=&order_item=alfabetico&order_dir=desc&page=0&generes=`, {
            method: "get",
        });

        const json = await requestRes.json();

        if (!json?.data) return [];

        return json.data.map((item) => ({
            id: item._id || item.real_id,
            title: item.the_real_name || "Sin título",
            synonyms: [item.real_id].filter(Boolean),
            year, // No viene en los datos
            image: item._imagen || "",
        }));
    }


    async findChapters(mangaId): Promise<ChapterDetails[]> {
        const requestRes = await fetch(`${this.api}/manhwa/see/${mangaId}`, {
            method: "get",
        });

        const json = await requestRes.json();

        if (!json?.chapters) return [];

        return json.chapters.map((ch, index) => ({
            id: `${json._id || mangaId}-${ch.chapter}`,
            url: ch.link || "",
            title: `Capítulo ${ch.chapter}`,
            chapter: String(ch.chapter),
            index,
        }));
    }


    async findChapterPages(chapterId): Promise<ChapterPage[]> {
        console.log(chapterId)
        const requestRes = await fetch(`${this.api}/chapters/see/${chapterId}_01`, {
            method: "get",
        });

        const json = await requestRes.json();

        if (!json?.chapter?.img) return [];

        return json.chapter.img.map((url, index) => ({
            url,
            index,
            headers: {
                Referer: "https://manhwaweb.com/",
            },
        }));
    }

}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "ManhwaWeb", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "ManhwaWeb", url, type: manifest.type }) });
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