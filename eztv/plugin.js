(function() {
    var manifest = {"packageName":"com.eternalnexus.eztv","name":"EZTV","version":1,"description":"EZTV torrent provider for TV series episodes (SxxExx).","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"anime","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};



class Provider {
    api = "https://eztvx.to"

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
        return -1
    }

    sizeToBytes(sizeStr): number {
        if (!sizeStr) return 0
        const m = sizeStr.match(/([\d.,]+)\s*(B|KB|MB|GB|TB)/i)
        if (!m) return 0
        const val = parseFloat(m[1].replace(/,/g, ""))
        const unit = m[2].toUpperCase()
        const mult, number> = {
            B,
            KB,
            MB: 1024 ** 2,
            GB: 1024 ** 3,
            TB: 1024 ** 4,
        }
        return Math.round(val * (mult[unit] ?? 1))
    }

    // ------------------------------------------------------------------ parsing

    // Parses an EZTV date into RFC3339. Result rows show relative text like
    // "3 hours ago" or absolute forms such as "Aug-07-2026".
    parseDate(value): string {
        if (!value) return new Date().toISOString()
        const t = value.trim()

        const abs = t.match(/^([a-z]{3})[.\s-]+\s*(\d{1,2})[,.\s-]+\s*(\d{4})$/i)
        if (abs) {
            const months, number> = {
                jan, feb, mar, apr, may, jun,
                jul, aug, sep, oct, nov, dec,
            }
            const mon = months[abs[1].toLowerCase()]
            if (mon !== undefined) {
                const d = new Date(Date.UTC(Number(abs[3]), mon, Number(abs[2])))
                if (!isNaN(d.getTime())) return d.toISOString()
            }
        }

        if (/^today$/i.test(t)) return new Date(Date.now()).toISOString()
        if (/^yesterday$/i.test(t)) return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

        const rel = t.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i)
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
            const ms = mult[rel[2].toLowerCase()]
            if (ms) return new Date(Date.now() - Number(rel[1]) * ms).toISOString()
        }

        return new Date().toISOString()
    }

    parseBlock(html): AnimeTorrent | null {
        const magnetM = html.match(/href="(magnet:\?[^"]+)"/i)
        const titleM = html.match(/<a href="(\/ep\/[^"]+)">\s*([\s\S]*?)\s*<\/a>/i)
        if (!magnetM || !titleM || !magnetM[1]) return null

        const magnet = magnetM[1]

        const title = titleM[2].replace(/<[^>]+>/g, "").trim()
        const seedM = html.match(/Seeders<\/span><br>\s*<span[^>]*>([\d,.]+)<\/span>/i)
        const leechM = html.match(/Leechers<\/span><br>\s*<span[^>]*>([\d,.]+)<\/span>/i)
        const sizeM = html.match(/Size<\/span><br>\s*<span[^>]*>([^<]+)<\/span>/i)
        const dateM = html.match(/Date<\/span><br>\s*<span[^>]*>([^<]+)<\/span>/i)

        const infoHash = (magnet.match(/btih:([a-fA-F0-9]{40})/i) || [])[1] || null

        return {
            name,
            date: this.parseDate(dateM ? dateM[1] : ""),
            size: this.sizeToBytes(sizeM ? sizeM[1] : ""),
            formattedSize: sizeM ? sizeM[1].trim() : "",
            seeders: seedM ? parseInt(seedM[1].replace(/,/g, ""), 10) ,
            leechers: leechM ? parseInt(leechM[1].replace(/,/g, ""), 10) ,
            downloadCount,
            link: `${this.api}${titleM[1]}`,
            downloadUrl: "",
            magnetLink,
            infoHash,
            resolution: this.extractResolution(title),
            isBatch: /(^|\b)(batch|complete|season pack)(\b|$)/i.test(title) || /(^|\b)S\d{1,2}(-|$)/i.test(title) && !/E\d/i.test(title),
            episodeNumber: this.episodeOf(title),
            releaseGroup: "",
            isBestRelease,
            confirmed,
        }
    }

    async scrape(query): Promise<AnimeTorrent[]> {
        try {
            const res = await fetch(`${this.api}/search/${encodeURIComponent(query)}`, {
                headers: { Referer: `${this.api}/` },
            })
            if (!res.ok) return []
            const html = res.text()
            const $ = LoadDoc(html)
            const ret = []
            $(".result_item").each((_, el) => {
                // Only blocks that carry a magnet button are torrent results.
                if (el.find("div.result_magnet_button").length() === 0) return
                const html = el.html()
                if (!html) return
                const t = this.parseBlock(html)
                if (t && t.seeders > 0) ret.push(t)
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
        return this.scrape(q)
    }

    async smartSearch(opts): Promise<AnimeTorrent[]> {
        const split = this.splitSeason(this.baseTitle(opts))
        let q = split.base

        if (this.isMovie(opts.media)) {
            // EZTV is series-focused; for movies, add the year.
            if (opts.media.seasonYear) q += ` ${opts.media.seasonYear}`
        } else if (opts.batch) {
            q += " complete"
        } else if (opts.episodeNumber > 0) {
            const s = split.season > 0 ? split.season : 1
            q += ` S${String(s).padStart(2, "0")}E${String(opts.episodeNumber).padStart(2, "0")}`
        }

        if (opts.resolution) q += ` ${opts.resolution}`
        if (q.trim() === "") return []

        return this.scrape(q)
    }

    async getTorrentInfoHash(torrent): Promise<string> {
        return torrent.infoHash || ""
    }

    async getTorrentMagnetLink(torrent): Promise<string> {
        return torrent.magnetLink || ""
    }

    async getLatest(): Promise<AnimeTorrent[]> {
        try {
            const res = await fetch(`${this.api}/`, { headers: { Referer: `${this.api}/` } })
            if (!res.ok) return []
            const $ = LoadDoc(res.text())
            const ret = []
            $(".result_item").each((_, el) => {
                if (el.find("div.result_magnet_button").length() === 0) return
                const html = el.html()
                if (!html) return
                const t = this.parseBlock(html)
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
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "EZTV", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "EZTV", url, type: manifest.type }) });
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