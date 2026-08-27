(function() {
    var manifest = {"packageName":"com.eternalnexus.streamed","name":"Streamed (Sports)","version":1,"description":"Browse live and upcoming sports matches (football, basketball, UFC, tennis and more) as a Custom Source.","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"video","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};




// Streamed (Sports) - Custom Source
// Presents Streamed's live/upcoming sports matches as browseable "anime" media
// so they can be watched through the Streamed online-stream provider.

const API_BASES = [
    "https://streamed.pk",
    "https://streamed.st",
]

 badge?: string }
        away?: { name?: string; badge?: string }
    }
    sources?: { source: string; id: string }[]
}

 i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0
    }
    return Math.abs(h) || 1
}

// generate a stable pseudo-AniList id for a match (keep within int32)
function matchId(match): number {
    return hashCode(match.id) % ID_MAX
}

class Provider implements CustomSource {
    base = API_BASES[0]

    getSettings(): Settings {
        return {
            supportsAnime,
            supportsManga,
        }
    }

    // ---------------------------------------------------------------- helpers

    async _api<T>(path): Promise<T | null> {
        for (const base of API_BASES) {
            try {
                const res = await fetch(`${base}${path}`, {
                    headers: { "User-Agent": "Seanime/1.0" },
                })
                if (res.ok) {
                    this.base = base
                    return (await res.json()) as T
                }
            } catch (err) {
                // try next host
            }
        }
        return null
    }

    _abs(url?): string | undefined {
        if (!url) return undefined
        if (url.startsWith("http")) return url
        return `${this.base}${url}`
    }

    // fetch the match within a given list by id
    async _findMatch(id): Promise<StreamedMatch | null> {
        const lists = [
            await this._api<StreamedMatch[]>("/api/matches/live"),
            await this._api<StreamedMatch[]>("/api/matches/all-today"),
            await this._api<StreamedMatch[]>("/api/matches/all/popular"),
        ]
        for (const list of lists) {
            if (!list) continue
            const found = list.find((m) => m && m.id === id)
            if (found) return found
        }
        return null
    }

    _toBaseAnime(match): $app.AL_BaseAnime {
        const id = matchId(match)
        const title = match.teams?.home?.name && match.teams?.away?.name
            ? `${match.teams.home.name} vs ${match.teams.away.name}`
            : match.title

        const startDate = new Date(match.date)
        const genre = (match.category || "sports").split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ")

        const media: $app.AL_BaseAnime = {
            id,
            status: match.date > Date.now() ? "NOT_YET_RELEASED" : "RELEASING",
            format: "MOVIE",
            type: "ANIME",
            title: {
                english,
                romaji,
            },
            synonyms: [match.id, title],
            description: `${title}\n\nUses the Streamed embedded player. Streams are live and availability varies by broadcast.`,
            coverImage: {
                extraLarge: this._abs(match.poster),
                large: this._abs(match.poster),
                medium: this._abs(match.poster),
            },
            episodes,
            duration,
            season: "WINTER",
            seasonYear: startDate.getFullYear(),
            startDate: {
                year: startDate.getFullYear(),
                month: startDate.getMonth() + 1,
                day: startDate.getDate(),
            },
            genres,
            countryOfOrigin: "US",
            meanScore,
            isAdult,
            siteUrl: `${this.base}/match/${match.id}`,
        }
        return media
    }

    _toMetadata(match): $app.Metadata_AnimeMetadata {
        const title = match.teams?.home?.name && match.teams?.away?.name
            ? `${match.teams.home.name} vs ${match.teams.away.name}`
            : match.title

        const ep: $app.Metadata_EpisodeMetadata = {
            anidbId,
            tvdbId: matchId(match),
            title,
            image: this._abs(match.poster) ?? "",
            airDate: new Date(match.date).toISOString().split("T")[0],
            length,
            summary,
            overview,
            episodeNumber,
            episode: "1",
            seasonNumber,
            absoluteEpisodeNumber,
            anidbEid,
            hasImage: !!match.poster,
        }

        return {
            titles: { en: title },
            episodes: { "1": ep },
            episodeCount,
            specialCount,
        }
    }

    async _listMatches(search): Promise<StreamedMatch[]> {
        const [live, today, popular] = await Promise.all([
            this._api<StreamedMatch[]>("/api/matches/live"),
            this._api<StreamedMatch[]>("/api/matches/all-today"),
            this._api<StreamedMatch[]>("/api/matches/all/popular"),
        ])

        const seen, boolean> = {}
        const matches = []
        const push = (m?) => {
            if (!m || !m.id) return
            if (seen[m.id]) return
            seen[m.id] = true
            matches.push(m)
        }

        for (const list of [live, today, popular]) {
            if (Array.isArray(list)) list.forEach(push)
        }

        if (search && search.trim().length > 0) {
            const q = search.trim().toLowerCase()
            return matches.filter((m) => m.title.toLowerCase().includes(q))
        }

        // sort: live first, then by date
        matches.sort((a, b) => {
            const aLive = a.date <= Date.now() ? 0 : 1
            const bLive = b.date <= Date.now() ? 0 : 1
            if (aLive !== bLive) return aLive - bLive
            return a.date - b.date
        })

        return matches
    }

    // ---------------------------------------------------------------- CustomSource

    async listAnime(search, page, perPage): Promise<ListResponse<$app.AL_BaseAnime>> {
        const currentPage = page && page > 0 ? page : 1
        const limit = Math.max(1, Math.min(perPage || 20, 20))

        const matches = await this._listMatches(search)
        const start = (currentPage - 1) * limit
        const slice = matches.slice(start, start + limit)

        const media = slice.map((m) => this._toBaseAnime(m))

        return {
            media,
            page,
            totalPages: Math.max(1, Math.ceil(matches.length / limit)),
            total: matches.length,
        }
    }

    async getAnime(ids): Promise<$app.AL_BaseAnime[]> {
        const unique = Array.from(new Set(ids.filter((x) => x > 0)))
        if (unique.length === 0) return []

        const matches = await this._listMatches("")
        const ret: $app.AL_BaseAnime[] = []
        for (const m of matches) {
            if (unique.includes(matchId(m))) {
                ret.push(this._toBaseAnime(m))
            }
            if (ret.length === unique.length) break
        }
        return ret
    }

    async getAnimeMetadata(id): Promise<$app.Metadata_AnimeMetadata | null> {
        const matches = await this._listMatches("")
        const match = matches.find((m) => matchId(m) === id)
        if (!match) return null
        return this._toMetadata(match)
    }

    async getAnimeDetails(id): Promise<$app.AL_AnimeDetailsById_Media | null> {
        const matches = await this._listMatches("")
        const match = matches.find((m) => matchId(m) === id)
        if (!match) return null

        const base = this._toBaseAnime(match)
        const genre = (match.category || "sports").split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ")

        return {
            ...base,
            meanScore,
            popularity,
            averageScore,
            genres,
            studios,
            isAdult,
            relations: { edges: [] },
            recommendations: { edges: [] },
            startDate: base.startDate,
            endDate: base.startDate,
        } as $app.AL_AnimeDetailsById_Media
    }

    async getAnimeWithRelations(id): Promise<$app.AL_CompleteAnime> {
        const matches = await this._listMatches("")
        const match = matches.find((m) => matchId(m) === id)
        if (!match) throw new Error("Match not found.")

        const base = this._toBaseAnime(match)
        return {
            ...base,
            relations: { edges: [] },
        } as $app.AL_CompleteAnime
    }

    // ---------------------------------------------------------------- Manga (unsupported)

    async getManga(ids): Promise<$app.AL_BaseManga[]> {
        return []
    }

    async getMangaDetails(id): Promise<$app.AL_MangaDetailsById_Media | null> {
        return null
    }

    async listManga(search, page, perPage): Promise<ListResponse<$app.AL_BaseManga>> {
        return {
            media,
            total,
            page,
            totalPages,
        }
    }
}
    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "Streamed (Sports)", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "Streamed (Sports)", url, type: manifest.type }) });
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