(function() {
    var manifest = {"packageName":"com.eternalnexus.thepiratebayv2","name":"ThePirateBay V2","version":1,"description":"The Pirate Bay torrent provider for movies and series, with smart search.","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"anime","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};



 media: Media }): string {
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

    // apibay tokenizes queries and treats a standalone hyphen (surrounded by
    // whitespace) as a negation operator: "Show - The Movie" excludes "The
    // Movie" from results. AniList titles routinely contain " - " (e.g. "BLEACH:
    // Thousand-Year Blood War - The Calamity"), so normalize it away. Hyphens
    // inside words ("Thousand-Year") are left untouched.
    sanitize(q): string {
        // apibay returns "No results returned" when a token contains punctuation
        // (e.g. "man's" or "caribbean:") or when the query is not all-lowercase,
        // so normalize the query before sending it.
        return q
            .toLowerCase()
            .replace(/[''":]/g, "")
            .replace(/\s+-\s+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
    }

    isVideoCategory(cat): boolean {
        return [...this.SERIES_CATS, ...this.MOVIE_CATS].includes(Number(cat))
    }

    isBatchName(name): boolean {
        if (/(^|\b)(batch|complete)(\b|$)/i.test(name)) return true
        if (/\bS\d{1,2}(?![\dE])/i.test(name)) return true
        // Full-season packs written out as "Season 2" (e.g. "Silo - Season 2 - Mp4"),
        // but only when no episode marker follows ("Season 2 Episode 5" is not a batch).
        if (/\bseason\s+\d{1,2}\b/i.test(name) && !this.hasEpisodeMarker(name)) return true
        // Episode-range batches like "1-64" or "001-008"
        return /\b\d{1,3}\s*-\s*\d{1,3}\b/.test(name)
    }

    // True when the name carries a single-episode marker (SxxEyy, "EP n", "E n").
    hasEpisodeMarker(name): boolean {
        if (/\bS\d{1,2}E\d{1,3}\b/i.test(name)) return true
        if (/\b(?)\s*#?\s*\d{1,3}\b/i.test(name)) return true
        return /(?:^|[.\s-])E\d{1,3}(?:[.\s-]|$)/i.test(name)
    }

    // Tokens that describe the file (codec, quality, site tags) rather than the
    // media itself. Used so they don't count as "foreign" title tokens.
    isTechToken(t): boolean {
        if (/^(s\d{1,2}e\d{1,3}|s\d{1,2}|e\d{1,3}|ep\d{1,3})$/i.test(t)) return true
        if (/^\d{3,4}p$/.test(t) || /^[248]k$/i.test(t)) return true
        if (/^(web|webrip|webdl|hdtv|hdrip|dvdrip|bluray|blu|bdrip|remux|x264|x265|h264|h265|hevc|avc|hdr|hdr10|dolby|vision|atmos|dts|truehd|aac|ac3|eac3|multi|dual|dualaudio|sub|subs|subbed|eng|en|fr|french|truefrench|esp|spa|ger|deu|ita|kor|jpn|jap|chi|pol|por|rus|tur|10bit)$/i.test(t)) return true
        if (/^(complete|collection|boxset|series|season|pack|batch|mini|miniseries|part|parts|vol|volume|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|final|full|remaster|restored|extended|uncut|director|directors|cut|theatrical|proper|repack|internal|criterion|anniversary|edition|atvp|appletv|amzn|amazon|nf|netflix|dsnp|disney|hbo|hulu|hmax|max|peacock|paramount|showtime)$/i.test(t)) return true
        return false
    }

    isYearToken(t): boolean {
        return /^(19|20)\d{2}$/.test(t)
    }

    // Tokens that separate the title from the episode/season/batch metadata.
    isBoundaryToken(t): boolean {
        if (/^(s\d{1,2}e\d{0,3}|s\d{1,2}|e\d{1,3}|ep\d{1,3})$/i.test(t)) return true
        if (/^(season|series|complete|collection|pack|batch|volume|vol|boxset)$/i.test(t)) return true
        return /^(19|20)\d{2}$/.test(t)
    }

    // Builds the set of tokens that may legitimately appear in a torrent title
    // for this media. Uses seanime's own normalizer so "the/an" noise and
    // " — Season 2" suffixes don't pollute the comparison.
    buildAliasTokens(...titles: Array<string | undefined>): Set<string> {
        const set = new Set<string>()
        for (const title of titles) {
            if (!title) continue
            const base = this.splitSeason(title).base
            const norm = $scannerUtils.normalizeTitle(base)
            for (const t of norm?.tokens ?? []) set.add(t)
            // Release names often drop the apostrophe/possessive ("Man's" ->
            // "Mans"), so also add tokens from the sanitized form to keep those
            // results passing belongsTo.
            const san = this.sanitize(base)
            if (san !== base) {
                const sanNorm = $scannerUtils.normalizeTitle(san)
                for (const t of sanNorm?.tokens ?? []) set.add(t)
            }
        }
        return set
    }

    // Returns significant tokens (seanime strips noise words and 1-char tokens).
    significantTokens(tokens): string[] {
        return $scannerUtils.getSignificantTokens(tokens.join(" "))
    }

    // True when the torrent name actually belongs to the searched media.
    // Single-word titles ("From", "Silo") are handled by only considering the
    // title stem (everything before the first SxxE/season/batch/year marker), so
    // "From the New World" or "From Dusk Till Dawn" are rejected while
    // "From S03E05 1080p" passes.
    belongsTo(name, aliases, isMovie, expectedSeason, mediaYear): boolean {
        const norm = $scannerUtils.normalizeTitle(name)
        const toks = norm?.tokens ?? []
        const nameYear = norm?.year ?? -1

        if (isMovie) {
            // A movie search shouldn't return episode torrents
            if (this.hasEpisodeMarker(name)) return false
            // Only evaluate the title stem (up to the first year/resolution/tech
            // token) so release groups and audio/container tags like "RBG",
            // "UHD" or "BDRemux" don't cause false drops.
            const boundaryIdx = toks.findIndex((t) => this.isYearToken(t) || this.isTechToken(t))
            const stem = boundaryIdx === -1 ? toks : toks.slice(0, boundaryIdx)
            const foreign = this.significantTokens(stem).filter(
                (t) => !aliases.has(t) && !this.isTechToken(t) && !this.isYearToken(t),
            )
            if (foreign.length > 0) return false
            if (nameYear > 0 && mediaYear > 0 && Math.abs(nameYear - mediaYear) > 1) return false
            return true
        }

        // Series results must structurally be series items
        if (!this.isBatchName(name) && !this.hasEpisodeMarker(name)) return false

        // Only evaluate the title stem (up to the first marker) so appended
        // episode titles like "From.S01E01.The.Longer.Day" don't cause false drops
        const boundaryIdx = toks.findIndex((t) => this.isBoundaryToken(t))
        const stem = boundaryIdx === -1 ? toks : toks.slice(0, boundaryIdx)
        const foreign = this.significantTokens(stem).filter((t) => !aliases.has(t) && !this.isTechToken(t))
        if (foreign.length > 0) return false

        // If the media is a specific season, reject torrents carrying a different one
        if (expectedSeason > 0) {
            const s = this.seasonOf(name)
            if (s > 0 && s !== expectedSeason) return false
        }

        if (nameYear > 0 && mediaYear > 0 && Math.abs(nameYear - mediaYear) > 1) return false

        return true
    }

    toAnimeTorrent(t, confirmed = true): AnimeTorrent {
        const infoHash = (t.info_hash || "").toLowerCase() || null
        return {
            name: t.name,
            date: new Date(Number(t.added) * 1000).toISOString(),
            size: Number(t.size),
            formattedSize: Number(t.size) > 0 ? this.formatBytes(Number(t.size)) : "",
            seeders: Number(t.seeders),
            leechers: Number(t.leechers),
            downloadCount,
            link: `${this.api}/torrent/${t.id}`,
            downloadUrl: "",
            magnetLink: infoHash ? this.buildMagnet(infoHash, t.name) ,
            infoHash,
            resolution: this.extractResolution(t.name),
            isBatch: this.isBatchName(t.name),
            episodeNumber: this.episodeOf(t.name),
            releaseGroup: "",
            isBestRelease,
            confirmed,
        }
    }

    // Parses the episode number from a torrent name ("S05E08" -> 8). Returns -1 if none.
    episodeOf(name): number {
        const m = name.match(/\bS\d{1,2}E(\d{1,3})\b/i)
        if (m) return Number(m[1])
        const ep = name.match(/\b(?)\s*#?\s*(\d{1,3})\b/i)
        if (ep) return Number(ep[1])
        const single = name.match(/(?:^|[.\s-])E(\d{1,3})(?:[.\s-]|$)/i)
        return single ? Number(single[1]) : -1
    }

    // Parses the season from a torrent name ("S05E08" -> 5). Returns 0 if none.
    seasonOf(name): number {
        const m = name.match(/\bS(\d{1,2})E\d{1,3}\b/i)
        return m ? Number(m[1]) : 0
    }

    // True when the torrent name matches the requested episode number for the
    // given season. The requested number may be an absolute episode number
    // (continuous numbering across seasons), in which case the seasonal offset
    // is subtracted before comparing against the SxxEyy marker. A torrent with
    // an explicit season marker must match that season; torrents without one
    // (absolute numbering, etc.) only need to match the episode number.
    matchesEpisode(name, episodeNumber, season, offset): boolean {
        const ep = this.episodeOf(name)
        if (ep !== episodeNumber) {
            if (!(offset > 0 && episodeNumber > offset && ep === episodeNumber - offset)) return false
        }
        if (season <= 0) return true
        const s = this.seasonOf(name)
        return s === 0 || s === season
    }

    async searchQuery(q): Promise<TpbTorrent[]> {
        try {
            // NB: apibay returns "No results" for any query that includes a
            // `cat=` parameter, so categories are filtered in-app via belongsTo.
            const res = await fetch(`${this.api}/q.php?q=${encodeURIComponent(q)}`)
            if (!res.ok) return []
            const json = await res.json<TpbTorrent[]>()
            if (!Array.isArray(json)) return []
            return json.filter((t) => Number(t.seeders) > 0)
        } catch (err) {
            return []
        }
    }

    // ------------------------------------------------------------------ API

    async search(opts): Promise<AnimeTorrent[]> {
        const split = this.splitSeason(opts.query || opts.media.englishTitle || opts.media.romajiTitle || "")
        const q = this.sanitize(split.base)
        if (q.trim() === "") return []
        const aliases = this.buildAliasTokens(opts.query, opts.media.englishTitle, opts.media.romajiTitle, ...(opts.media.synonyms ?? []))
        const isMovie = this.isMovie(opts.media)
        const mediaYear = opts.media.seasonYear || opts.media.startDate?.year || 0
        const season = split.season
        const torrents = await this.searchQuery(q)
        return torrents
            .filter((t) => this.belongsTo(t.name, aliases, isMovie, season, mediaYear))
            .map((t) => this.toAnimeTorrent(t))
    }

    // apibay tokenizes queries and requires every token to appear in the torrent
    // name. Resolution values come in as "1080"/"720" (no "p"), which can't match
    // the "1080p" token in torrent names, so append the "p".
    resolutionToken(res): string {
        if (/^\d{3,4}$/.test(res)) return `${res}p`
        return res
    }

    async smartSearch(opts): Promise<AnimeTorrent[]> {
        const split = this.splitSeason(this.sanitize(this.baseTitle(opts)))
        const base = split.base
        const season = split.season
        const isMovie = this.isMovie(opts.media)
        const mediaYear = opts.media.seasonYear || opts.media.startDate?.year || 0
        const aliases = this.buildAliasTokens(opts.query, opts.media.englishTitle, opts.media.romajiTitle, ...(opts.media.synonyms ?? []))
        const offset = opts.media.absoluteSeasonOffset || 0
        let q = base

        if (isMovie) {
            // NB: apibay returns "No results" when a year is appended to the
            // query (e.g. "Interstellar 2014"), so don't send one here. Year
            // matching is handled later by belongsTo.
        } else if (opts.batch) {
            q += " complete"
        } else if (opts.episodeNumber > 0) {
            const s = season > 0 ? season : 1
            q += ` S${String(s).padStart(2, "0")}E${String(opts.episodeNumber).padStart(2, "0")}`
        }

        const resToken = opts.resolution ? this.resolutionToken(opts.resolution) : ""
        if (resToken) q += ` ${resToken}`
        q = this.sanitize(q)
        if (q === "") return []

        const query = async (searchQuery) => {
            return this.searchQuery(searchQuery)
        }

        // Title-only fallback query (optionally constrained by resolution), used
        // whenever the precise query comes back empty or is fully filtered out.
        const fallback = async () => {
            let fb = base
            if (resToken) fb += ` ${resToken}`
            return query(this.sanitize(fb))
        }

        // Batch search: apibay rarely has a "complete" or "season" token, so the
        // precise query often comes back empty. Fall back to a title-only query
        // and keep anything that looks like a batch. If the provider has no
        // batch torrents for this media, fall through to the single-episode
        // search below so the user never sees an empty result set.
        if (!isMovie && opts.batch) {
            let torrents = await query(q)
            if (torrents.length === 0) {
                torrents = (await fallback()).filter((t) => this.isBatchName(t.name))
            }
            const batches = torrents
                .filter((t) => this.isBatchName(t.name) && this.belongsTo(t.name, aliases, false, season, mediaYear))
                .map((t) => this.toAnimeTorrent(t, true))
            if (batches.length > 0) return batches
            // No batches found: continue into single-episode search.
        }

        // Single-episode search: apibay requires all query tokens to match, so a
        // "SxxEyy" suffix rarely matches real torrent names (season offsets,
        // absolute episode numbers, etc.). Whenever the final filtered set is
        // empty - either because the precise query returned nothing or because
        // every result was filtered out - retry with a title-only query and
        // keep batches + torrents that parse to the requested season/episode.
        // Movies always arrive with episodeNumber=1 from the frontend, so skip
        // this branch entirely for them.
        if (!isMovie && opts.episodeNumber > 0) {
            const keep = (t) =>
                this.isBatchName(t.name) || this.matchesEpisode(t.name, opts.episodeNumber, season, offset)

            let torrents = opts.batch ? await fallback() : await query(q)
            let filtered = torrents.filter((t) => this.belongsTo(t.name, aliases, isMovie, season, mediaYear) && keep(t))
            if (filtered.length === 0) {
                torrents = await fallback()
                filtered = torrents.filter((t) => this.belongsTo(t.name, aliases, isMovie, season, mediaYear) && keep(t))
            }
            return filtered.map((t) => this.toAnimeTorrent(t, true))
        }

        // Generic path: plain (movie / no-episode) search, possibly following a
        // batch-mode fallthrough with no episode number.
        let torrents = await query(q)
        if (torrents.length === 0) {
            torrents = await fallback()
        }
        return torrents
            .filter((t) => this.belongsTo(t.name, aliases, isMovie, season, mediaYear))
            .map((t) => this.toAnimeTorrent(t, true))
    }

    async getTorrentInfoHash(torrent): Promise<string> {
        return torrent.infoHash || ""
    }

    async getTorrentMagnetLink(torrent): Promise<string> {
        return torrent.magnetLink || ""
    }

    async getLatest(): Promise<AnimeTorrent[]> {
        try {
            const res = await fetch(`${this.api}/precompiled/data_top100_recent.json`)
            if (!res.ok) return []
            const json = await res.json<TpbTorrent[]>()
            if (!Array.isArray(json)) return []
            return json
                .filter((t) => Number(t.seeders) > 0 && this.isVideoCategory(t.category))
                .map((t) => this.toAnimeTorrent(t))
        } catch (err) {
            return []
        }
    }
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "ThePirateBay V2", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "ThePirateBay V2", url, type: manifest.type }) });
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