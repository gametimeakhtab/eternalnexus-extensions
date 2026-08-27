(function() {
    var manifest = {"packageName":"com.eternalnexus.yts","name":"YTS","version":1,"description":"YTS torrent provider for movies (720p/1080p/4K).","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"anime","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};



 Seanime requires RFC3339.
    parseDate(date): string {
        if (!date) return new Date().toISOString()
        const m = date.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/)
        if (m) return `${m[1]}T${m[2]}Z`
        return new Date().toISOString()
    }

    toAnimeTorrent(movie, t): AnimeTorrent {
        const name = `${movie.title} (${movie.year}) ${t.quality} [YTS.MX]`
        return {
            name,
            date: this.parseDate(movie.date_uploaded),
            size: Number(t.size_bytes) || 0,
            formattedSize: t.size || "",
            seeders: Number(t.seeds) || 0,
            leechers: Number(t.peers) || 0,
            downloadCount,
            link: movie.url || "",
            downloadUrl: "",
            magnetLink: t.hash ? this.buildMagnet(t.hash, name) ,
            infoHash: t.hash || null,
            resolution: t.quality || "",
            isBatch,
            episodeNumber: -1,
            releaseGroup: "YTS.MX",
            isBestRelease: /^(1080p|2160p)$/.test(t.quality),
            confirmed,
        }
    }

    async fetchMovies(q, quality?): Promise<YtsMovie[]> {
        try {
            let url = `${this.api}/list_movies.json?query_term=${encodeURIComponent(q)}&limit=50&sort_by=seeds&order_by=desc`
            if (quality) url += `&quality=${encodeURIComponent(quality)}`
            const res = await fetch(url)
            if (!res.ok) return []
            const json = res.json<{ data: { movies: YtsMovie[] } }>()
            if (!json || !json.data || !Array.isArray(json.data.movies)) return []
            return json.data.movies.filter((m) => m && Array.isArray(m.torrents))
        } catch (err) {
            return []
        }
    }

    // ------------------------------------------------------------------ API

    async search(opts): Promise<AnimeTorrent[]> {
        const q = opts.query || opts.media.englishTitle || opts.media.romajiTitle || ""
        if (q.trim() === "") return []
        const movies = await this.fetchMovies(q)
        const ret = []
        for (const m of movies) {
            for (const t of m.torrents) ret.push(this.toAnimeTorrent(m, t))
        }
        return ret
    }

    // YTS only provides movies; return nothing for series.
    async smartSearch(opts): Promise<AnimeTorrent[]> {
        if (!this.isMovie(opts.media)) return []

        let q = opts.query || opts.media.englishTitle || opts.media.romajiTitle || ""
        if (opts.media.seasonYear) q += ` ${opts.media.seasonYear}`
        if (q.trim() === "") return []

        const quality = opts.resolution ? opts.resolution.replace(/\D/g, "") : undefined
        const movies = await this.fetchMovies(q, quality)

        let ret = []
        for (const m of movies) {
            for (const t of m.torrents) ret.push(this.toAnimeTorrent(m, t))
        }

        // If bestReleases is enabled, keep the best (1080p/2160p) release of each title.
        if (opts.bestReleases) {
            const seen, AnimeTorrent> = {}
            for (const t of ret) {
                const key = t.name.replace(/\s+\d{3,4}p.*$/, "")
                const prev = seen[key]
                if (!prev || this.rank(t) > this.rank(prev)) seen[key] = t
            }
            ret = Object.values(seen)
        }

        return ret
    }

    rank(t): number {
        const r = t.resolution === "2160p" ? 3 : t.resolution === "1080p" ? 2 : 1
        return r * 100 + t.seeders
    }

    async getTorrentInfoHash(torrent): Promise<string> {
        return torrent.infoHash || ""
    }

    async getTorrentMagnetLink(torrent): Promise<string> {
        return torrent.magnetLink || ""
    }

    async getLatest(): Promise<AnimeTorrent[]> {
        try {
            const res = await fetch(`${this.api}/list_movies.json?limit=50&sort_by=date_added&order_by=desc`)
            if (!res.ok) return []
            const json = res.json<{ data: { movies: YtsMovie[] } }>()
            if (!json || !json.data || !Array.isArray(json.data.movies)) return []
            const ret = []
            for (const m of json.data.movies) {
                for (const t of m.torrents) ret.push(this.toAnimeTorrent(m, t))
            }
            return ret
        } catch (err) {
            return []
        }
    }
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "YTS", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "YTS", url, type: manifest.type }) });
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