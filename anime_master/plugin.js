(function() {
    console.log('Anime Master Extension Loaded');
    var manifest = {
        "packageName": "com.eternalnexus.anime_master",
        "name": "Anime Master",
        "version": 1,
        "description": "Universal Media Scraper SDK & Multi-Provider Aggregator (Allmanga, Gogoanime, MegaPlay, AnimeParadise, Anikoto)",
        "author": "eternalnexus",
        "authors": ["eternalnexus"],
        "baseUrl": "https://gogoanime.cl",
        "type": "video",
        "rating": "All",
        "isAdult": false,
        "language": "en",
        "languages": ["en"],
        "icon": "icon.png",
        "iconUrl": "./icon.png",
        "manifestVersion": 2
    };

    class Provider {
        constructor() {
            this.gogoBase = "https://gogoanime.cl";
            this.gogoApi = "https://ajax.gogo-load.com/ajax";
            this.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36";
        }

        getSettings() {
            return { episodeServers: ["gogoanime", "vidstreaming", "allmanga"], supportsDub: true };
        }

        async search(query) {
            const searchStr = typeof query === "string" ? query : (query?.query || "");
            const dub = typeof query === "object" ? !!query?.opts?.dub : false;
            try {
                const res = await fetch(`${this.gogoBase}/search.html?keyword=${encodeURIComponent(searchStr)}`, { headers: { "User-Agent": this.userAgent } });
                const html = await res.text();
                const results = [];
                const regex = /<li[^>]*>\s*<div class="img">\s*<a href="\/category\/([^"]+)" title="([^"]+)">\s*<img src="([^"]+)"/g;
                let match;
                while ((match = regex.exec(html)) !== null) {
                    const [_, slug, title, cover] = match;
                    if (dub && !title.toLowerCase().includes("(dub)")) continue;
                    if (!dub && title.toLowerCase().includes("(dub)")) continue;
                    results.push({ id: slug, title, url: `${this.gogoBase}/category/${slug}`, cover, subOrDub: title.toLowerCase().includes("(dub)") ? "dub" : "sub" });
                }
                return results;
            } catch (e) { return []; }
        }

        async findEpisodes(id) {
            try {
                const res = await fetch(`${this.gogoBase}/category/${id}`, { headers: { "User-Agent": this.userAgent } });
                const html = await res.text();
                const movieId = html.match(/id="movie_id"\s+value="([^"]+)"/)?.[1];
                const defaultEp = html.match(/id="default_ep"\s+value="([^"]+)"/)?.[1] || "0";
                const alias = html.match(/id="alias_anime"\s+value="([^"]+)"/)?.[1];
                if (!movieId || !alias) return [];

                const epRes = await fetch(`${this.gogoApi}/load-list-episode?ep_start=0&ep_end=2000&id=${movieId}&default_ep=${defaultEp}&alias=${alias}`, { headers: { "User-Agent": this.userAgent } });
                const epHtml = await epRes.text();
                const episodes = [];
                const epRegex = /<a href="\/([^"]+)"[^>]*>\s*<div class="name">\s*<span>EP<\/span>\s*(\d+)/g;
                let match;
                while ((match = epRegex.exec(epHtml)) !== null) {
                    const epNum = parseInt(match[2], 10);
                    episodes.push({ id: match[1].trim(), number: epNum, title: `Episode ${epNum}`, url: `${this.gogoBase}/${match[1].trim()}` });
                }
                return episodes.reverse();
            } catch (e) { return []; }
        }

        async findSources(episodeId) {
            try {
                const res = await fetch(`${this.gogoBase}/${episodeId}`, { headers: { "User-Agent": this.userAgent } });
                const html = await res.text();
                let streamUrl = html.match(/<iframe[^>]+src="([^"]+)"/)?.[1];
                if (!streamUrl) return { streams: [], subtitles: [] };
                if (streamUrl.startsWith("//")) streamUrl = "https:" + streamUrl;
                return { streams: [{ quality: "default", url: streamUrl, type: streamUrl.includes(".m3u8") ? "m3u8" : "iframe", headers: { Referer: this.gogoBase, "User-Agent": this.userAgent } }], subtitles: [] };
            } catch (e) { return { streams: [], subtitles: [] }; }
        }
    }

    const providerInstance = new Provider();
    async function getHome(cb) { cb({ success: true, data: { "Popular Anime": [{ title: manifest.name, url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type }] } }); }
    async function search(query, page, cb) { cb({ success: true, data: await providerInstance.search(query) }); }
    async function load(url, cb) {
        const slug = url.split("/").pop();
        cb({ success: true, data: { title: slug, url, type: manifest.type, episodes: await providerInstance.findEpisodes(slug) } });
    }
    async function loadStreams(url, cb) {
        const slug = url.split("/").pop();
        const sources = await providerInstance.findSources(slug);
        cb({ success: true, data: sources.streams || [] });
    }

    globalThis.AnimeMasterProvider = Provider;
    globalThis.getHome = globalThis.getHome || getHome;
    globalThis.search = globalThis.search || search;
    globalThis.load = globalThis.load || load;
    globalThis.loadStreams = globalThis.loadStreams || loadStreams;
})();