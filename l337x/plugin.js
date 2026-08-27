(function() {
    var manifest = {"packageName":"com.eternalnexus.l337x","name":"1337x","version":1,"description":"1337x torrent provider for movies and series.","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"anime","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};



class Provider {
    api = "https://1337x.to"

    getSettings(): AnimeProviderSettings {
        return {
            canSmartSearch,
            smartSearchFilters: ["batch", "episodeNumber", "resolution", "query"],
            supportsAdult,
            type: "main",
        }
    }

    // ------------------------------------------------------------------ utils

    isMovie(media): boolean {
        return media.format === "MOVIE" || media.episodeCount === 1
    }

    baseTitle(opts: { query: string; media: Media }): string {
        return opts.query || opts.media.englishTitle || opts.media.romajiTitle || ""
    }

    // Splits a per-season media title like "Breaking Bad — Season 2" into its
    // base title and season number. Returns season 0 when no marker is present.
    splitSeason(title): { base: string; season: number } {
        const m = title.match(/\s*[—–-]\s*season\s+(\d{1,2})\s*$/i)
        if (m) {
            return {
                base: title.slice(0, m.index).trim(),
                season: Number(m[1]),
            }
        }
        return { base: title.trim(), season: 0 }
    }

    extractResolution(name): string {
        const m = name.match(/(\b\d{3,4}p\b|\b[48]K\b)/i)
        return m ? m[1] : ""
    }

    episodeOf(name): number {
        const m = name.match(/\bS\d{1,2}E(\d{1,3})\b/i)
        if (m) return Number(m[1])
        const single = name.match(/(?:^|[.\s-])E(\d{1,3})(?:[.\s-]|$)/i)
        return single ? Number(single[1]) : -1
    }

    isBatchName(name): boolean {
        if (/(^|\b)(batch|complete|season pack)(\b|$)/i.test(name)) return true
        if (/(^|\b)S\d{1,2}(-|$)/i.test(name) && !/E\d/i.test(name)) return true
        return false
    }

    sizeToBytes(sizeStr): number {
        if (!sizeStr) return 0
        const m = sizeStr.match(/([\d.]+)\s*(B|KB|MB|GB|TB|KiB|MiB|GiB|TiB)/i)
        if (!m) return 0
        const val = parseFloat(m[1])
        const unit = m[2].toUpperCase()
        const mult, number> = {
            B,
            KB,
            MB: 1024 ** 2,
            GB: 1024 ** 3,
            TB: 1024 ** 4,
            KIB,
            MIB: 1024 ** 2,
            GIB: 1024 ** 3,
            TIB: 1024 ** 4,
        }
        return Math.round(val * (mult[unit] ?? 1))
    }

    // Parses a 1337x date cell into RFC3339. Cells show relative text like
    // "today", "yesterday", "3 hours ago" or an absolute "Aug-07-2026".
    parseDate(value): string {
        if (!value) return new Date().toISOString()
        const t = value.trim().toLowerCase()

        if (/^today$/.test(t)) return new Date(Date.now()).toISOString()
        if (/^yesterday$/.test(t)) return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

        const abs = t.match(/^([a-z]{3})-(\d{2})-(\d{4})$/)
        if (abs) {
            const months, number> = {
                jan, feb, mar, apr, may, jun,
                jul, aug, sep, oct, nov, dec,
            }
            const mon = months[abs[1]]
            if (mon !== undefined) {
                const d = new Date(Date.UTC(Number(abs[3]), mon, Number(abs[2])))
                if (!isNaN(d.getTime())) return d.toISOString()
            }
        }

        const rel = t.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/)
        if (rel) {
            const mult, number> = {
                second,
                minute: 60 * 1000,
                hour: 60 * 60 * 1000,
                day: 24 * 60 * 60 * 1000,
                week: 7 * 24 * 60 * 60 * 1000,
                month: 30 * 24 * 60 * 60 * 1000,
                year: 365 * 24 * 60 * 60 * 1000,
            }
            const ms = mult[rel[2]]
            if (ms) return new Date(Date.now() - Number(rel[1]) * ms).toISOString()
        }

        return new Date().toISOString()
    }

    toAnimeTorrent(el): AnimeTorrent | null {
        const links = el.find("td.coll-1.name a")
        if (links.length() < 2) return null

        const title = links.eq(1).text().trim()
        const href = links.eq(1).attr("href") || ""
        if (!title || !href) return null

        const seeders = parseInt(el.find("td.coll-2").text().trim(), 10) || 0
        const leechers = parseInt(el.find("td.coll-3").text().trim(), 10) || 0
        const size = this.sizeToBytes(el.find("td.coll-4").text().trim())
        const pageUrl = `${this.api}${href}`

        return {
            name,
            date: this.parseDate(el.find("td.coll-5").text().trim()),
            size,
            formattedSize: "",
            seeders,
            leechers,
            downloadCount,
            link,
            downloadUrl: "",
            magnetLink,
            infoHash,
            resolution: this.extractResolution(title),
            isBatch: this.isBatchName(title),
            episodeNumber: this.episodeOf(title),
            releaseGroup: "",
            isBestRelease,
            confirmed,
        }
    }

    async scrape(query, category): Promise<AnimeTorrent[]> {
        const path = category === "all"
            ? `/search/${encodeURIComponent(query)}/1/`
            : `/category-search/${encodeURIComponent(query)}/${category}/1/`
        try {
            const res = await fetch(`${this.api}${path}`, {
                headers: { Referer: `${this.api}/` },
            })
            if (!res.ok) return []
            const html = res.text()
            const $ = LoadDoc(html)
            const ret = []
            $("table tbody tr").each((_, el) => {
                const t = this.toAnimeTorrent(el)
                if (t) ret.push(t)
            })
            return ret
        } catch (err) {
            return []
        }
    }

    // ------------------------------------------------------------------ API

    async search(opts): Promise<AnimeTorrent[]> {
        const q = this.splitSeason(opts.query || opts.media.englishTitle || opts.media.romajiTitle || "").base
        if (q.trim() === "") return []
        return this.scrape(q, "all")
    }

    async smartSearch(opts): Promise<AnimeTorrent[]> {
        const split = this.splitSeason(this.baseTitle(opts))
        let q = split.base
        const category = this.isMovie(opts.media) ? "movies" : "tv"

        if (this.isMovie(opts.media)) {
            if (opts.media.seasonYear) q += ` ${opts.media.seasonYear}`
        } else if (opts.batch) {
            q += " complete"
        } else if (opts.episodeNumber > 0) {
            const s = split.season > 0 ? split.season : 1
            q += ` S${String(s).padStart(2, "0")}E${String(opts.episodeNumber).padStart(2, "0")}`
        }

        if (opts.resolution) q += ` ${opts.resolution}`
        if (q.trim() === "") return []

        return this.scrape(q, category)
    }

    // Scrapes the torrent page to get the magnet link.
    async getTorrentMagnetLink(torrent): Promise<string> {
        if (torrent.magnetLink) return torrent.magnetLink
        try {
            const res = await fetch(torrent.link, { headers: { Referer: `${this.api}/` } })
            if (!res.ok) return ""
            const $ = LoadDoc(res.text())
            const magnet = $("a[href^='magnet:']").first().attr("href")
            return magnet || ""
        } catch (err) {
            return ""
        }
    }

    // 1337x doesn't expose info hashes without scraping the torrent page.
    async getTorrentInfoHash(torrent): Promise<string> {
        return torrent.infoHash || ""
    }

    // Latest torrents from the recent page.
    async getLatest(): Promise<AnimeTorrent[]> {
        try {
            const res = await fetch(`${this.api}/recent/`, { headers: { Referer: `${this.api}/` } })
            if (!res.ok) return []
            const $ = LoadDoc(res.text())
            const ret = []
            $("table tbody tr").each((_, el) => {
                const t = this.toAnimeTorrent(el)
                if (t) ret.push(t)
            })
            return ret
        } catch (err) {
            return []
        }
    }
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "1337x", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "1337x", url, type: manifest.type }) });
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