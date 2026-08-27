(function() {
    var manifest = {"packageName":"com.eternalnexus.simklv2","name":"Simkl V2","version":1,"description":"Implements SIMKL as a custom source with watchlist support.","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"video","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};









[]
    relations?: SimklRelation[]
    users_recommendations?: SimklRelation[]
    watching_details?: {
        watched_episodes?: number
        total_episodes?: number
    }
    adult?: boolean
}






}

[]
}







 month?: number; day?: number } {
        const y = this.num(year) ?? 0
        if (!dateStr) return { year: y }
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return { year: y }
        return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
    }

    siteUrlOf(item, type): string {
        if (item?.ids?.slug) {
            const seg =  simklId: number } | null {
        const m = String(url || "").match(/\/(movies|movie|shows|show|tv|anime)\/(\d+)/i)
        if (!m) return null
        const seg = m[1].toLowerCase()
        let type: SimklMediaType
        if (seg === "movies" || seg === "movie")  simklId: number; siteUrl: string } | null {
        if (rel?.url) {
            const parsed = this.parseSimklUrl(rel.url)
            if (parsed) return { type: parsed.type, simklId: parsed.simklId, siteUrl: rel.url }
        }

        const simklId = this.num(rel?.ids?.simkl ?? rel?.ids?.simkl_id)
        if (!simklId) return null

        const t = String(rel?. i < str.length; i++) {
            h = ((h << 5) - h + str.charCodeAt(i)) | 0
        }
        return Math.abs(h) || 1
    }

    // ---------------------------------------------------------------- ID scheme
    // movie  -> 10000000000 + simklId
    // tv     -> 20000000000 + simklId * 1000 + seasonNumber
    // anime  -> 30000000000 + simklId * 1000 + seasonNumber

    encodeId(type, simklId, season): number {
        const id = Number(simklId)
        if ( simklId: number; season: number } | null {
        const n = Number(id)
        if (!n || isNaN(n)) return null

        if (n >= ANIME_OFFSET) {
            const rest = n - ANIME_OFFSET
            return { type: "anime", simklId: Math.floor(rest / 1000), season: (rest % 1000) || 1 }
        }
        if (n >= TV_OFFSET) {
            const rest = n - TV_OFFSET
            return { type: "tv", simklId: Math.floor(rest / 1000), season: (rest % 1000) || 1 }
        }
        if (n >= MOVIE_OFFSET) {
            return { type: "movie", simklId: n - MOVIE_OFFSET, season: 1 }
        }

        return null
    }

    // ---------------------------------------------------------------- season info

    async seasonInfo(simklId, type: "tv" | "anime"): Promise<SimklSeasonInfo | null> {
        const cache = $store.get<Record<string, SimklSeasonInfo>>("simkl.seasons") ?? {}
        const key = `${type}:${simklId}`
        if (cache[key]) return cache[key]

        const path = (grouped[season] ||= []).push(ep)
        }
        if (Object.keys(grouped).length === 0) return null

        const counts, number> = {}
        const statuses, string> = {}
        for (const [seasonStr, seasonEps] of Object.entries(grouped)) {
            const season = Number(seasonStr)
            counts[season] = seasonEps.length
            let aired = 0
            for (const e of seasonEps) if (e.aired !== false) aired++
            if (aired === seasonEps.length) statuses[season] = "FINISHED"
            else if (aired > 0) statuses[season] = "RELEASING"
            else statuses[season] = "NOT_YET_RELEASED"
        }

        const info = { counts, statuses }
        cache[key] = info
        $store.set("simkl.seasons", cache)
        return info
    }

    // ---------------------------------------------------------------- media conversion

    toALBaseAnime(item, opts: { type: SimklMediaType; season: number; episodeCount: number; status?: string }): $app.AL_BaseAnime | null {
        const simklId = this.idOf(item)
        if (!simklId) return null

        const baseTitle = this.str(item.title)
        const season = opts.season
        const title = season > 1 ? `${baseTitle} — Season ${season}` : baseTitle
        const  if one side
    // is short, the head is padded from the other side. Remaining seasons follow
    // in ascending order. Movies have no seasons and yield no edges.
    buildSeasonRelations(item, type: "tv" | "anime", currentSeason, info): $app.AL_AnimeDetailsById_Media_Relations_Edges[] {
        if (!info) return []

        const prequels = []
        const sequels = []
        for (const rawSeason of Object.keys(info.counts)) {
            const s = Number(rawSeason)
            if (!Number.isFinite(s) || s <= 0 || s === currentSeason) continue
            if (s < currentSeason) prequels.push(s)
            else sequels.push(s)
        }
        prequels.sort((a, b) => a - b)
        sequels.sort((a, b) => a - b)

        let nPre = Math.min(2, prequels.length)
        let nSeq = Math.min(2, sequels.length)
        const deficit = 4 - nPre - nSeq
        if (deficit > 0) {
            const takePre = Math.min(deficit, prequels.length - nPre)
            nPre += takePre
            nSeq += deficit - takePre
        }

        const head = [...prequels.slice(-nPre), ...sequels.slice(0, nSeq)]
        const headSet = new Set(head)
        const order = [...head, ...[...prequels, ...sequels].filter(s => !headSet.has(s))]

        const edges: $app.AL_AnimeDetailsById_Media_Relations_Edges[] = []
        for (const season of order) {
            const node = this.toALBaseAnime(item, {
                type,
                season,
                episodeCount: info.counts[season],
                status: info.statuses?.[season],
            })
            if (!node) continue
            edges.push({
                node,
                relationType: season < currentSeason ? "PREQUEL" : "SEQUEL",
            })
        }
        return edges
    }

    // Merges two groups of relation edges, keeping the priority group first (so
    // sibling seasons stay visible within the UI's relation grid) and
    // respecting a shared cap. Duplicate node ids are dropped.
    mergeRelationEdges(priority: $app.AL_AnimeDetailsById_Media_Relations_Edges[], secondary: $app.AL_AnimeDetailsById_Media_Relations_Edges[], cap = 16): $app.AL_AnimeDetailsById_Media_Relations | undefined {
        const edges: $app.AL_AnimeDetailsById_Media_Relations_Edges[] = []
        const seen = new Set<number>()
        for (const edge of [...priority, ...secondary]) {
            if (edges.length >= cap) break
            const nodeId = edge?.node?.id
            if (nodeId === undefined || nodeId === null) continue
            if (seen.has(nodeId)) continue
            seen.add(nodeId)
            edges.push(edge)
        }
        if (edges.length === 0) return undefined
        return { edges }
    }

    async buildRecommendations(item, type): Promise<$app.AL_AnimeDetailsById_Media_Recommendations | undefined> {
        const recs = item.users_recommendations ?? []
        if (recs.length === 0) return undefined
        const edges: $app.AL_AnimeDetailsById_Media_Recommendations_Edges[] = []
        for (const rec of recs.slice(0, 10)) {
            const info = this.relInfo(rec)
            if (!info) continue
            const recId = this.encodeId(info.type, info.simklId, 1)
            const cover = this.posterUrl(rec.poster)
            edges.push({
                node: {
                    mediaRecommendation: {
                        id,
                        siteUrl: info.siteUrl,
                        title: {
                            userPreferred: this.str(rec.title),
                            romaji: this.str(rec.title),
                            english: this.str(rec.title),
                            native: this.str(rec.title),
                        },
                        coverImage: {
                            large,
                            medium,
                            extraLarge,
                            color: "",
                        },
                        format: this.format(info.type) as $app.AL_MediaFormat,
                        startDate: { year: this.num(rec.year) ?? 0 },
                        isAdult,
                        meanScore,
                        status: "FINISHED",
                        type: "ANIME",
                    },
                },
            })
        }
        if (edges.length === 0) return undefined
        return { edges }
    }

    parsePeople(data): $app.AL_AnimeDetailsById_Media_Characters_Edges[] | undefined {
        if (!data) return undefined
        let list = []
        if (Array.isArray(data)) {
            list = data
        } else if (Array.isArray(data.cast)) {
            list = data.cast
        } else if (Array.isArray(data.people)) {
            list = data.people
        } else if (Array.isArray(data.characters)) {
            list = data.characters
        }
        if (list.length === 0) return undefined

        const edges: $app.AL_AnimeDetailsById_Media_Characters_Edges[] = []
        for (const entry of list) {
            const actor = entry?.actor ?? entry
            const character = entry?.character ?? entry
            const img = actor?.image?.large ?? actor?.image ?? actor?.poster ?? character?.image?.large ?? character?.image
            const name = actor?.name ?? character?.name
            if (!img || !name) continue
            const id = this.hashCode(String(name) + String(img))
            edges.push({
                id,
                name: String(name),
                node: {
                    id,
                    isFavourite,
                    name: { full: String(name), native: String(name) },
                    image: { large: String(img) },
                },
                role: "SUPPORTING",
            })
        }
        return edges.length > 0 ? edges : undefined
    }

    hasTmdbKey(): boolean {
        const key = String(this.tmdbApiKey || "").trim()
        return key.length > 0 && !key.includes("{{")
    }

    tmdbImage(path: string | undefined): string {
        const p = this.str(path)
        if (!p) return ""
        if (p.startsWith("http")) return p
        return `https://image.tmdb.org/t/p/w185${p}`
    }

    async getCharactersFromTMDB(tmdbId, type): Promise<$app.AL_AnimeDetailsById_Media_Characters | undefined> {
        const cache = $store.get<Record<string, $app.AL_AnimeDetailsById_Media_Characters>>("simkl.tmdb") ?? {}
        const key = `tmdb:${type}:${tmdbId}`
        if (cache[key]) return cache[key]

        const base =  may fail, then we omit characters)
        try {
            const base =  fall back to cache on failure
            const item = await this.getDetail(decoded.type, decoded.simklId)
            if (item && item.ids) {
                let epCount = this.episodeCount(item)
                let info: SimklSeasonInfo | null = null
                if (decoded.type !== "movie") {
                    info = await this.seasonInfo(decoded.simklId, decoded.type)
                    epCount = info?.counts?.[decoded.season] ?? epCount
                }

                const base = this.toALBaseAnime(item, {
                    type: decoded.type,
                    season: decoded.season,
                    episodeCount: decoded.type === "movie" ? 1 ,
                    status: decoded.type === "movie" ? undefined : info?.statuses?.[decoded.season],
                })
                if (base) {
                    mediaCache[id] = base
                    return base
                }
            }

            return cached ?? null
        })

        const results = await Promise.all(promises)
        for (const r of results) {
            if (r) ret.push(r)
        }
        if (Object.keys(mediaCache).length > 0) {
            $store.set("simkl.media", mediaCache)
        }
        return ret
    }

    async getAnimeDetails(id): Promise<$app.AL_AnimeDetailsById_Media | null> {
        const decoded = this.decodeId(id)
        if (!decoded) return null
        if (this.hideAnime && decoded.type === "anime") return null

        const item = await this.getDetail(decoded.type, decoded.simklId)
        if (!item || !item.ids) return null

        const score = this.meanScore(item)
        let relations = await this.buildRelations(item, decoded.type)
        const recommendations = await this.buildRecommendations(item, decoded.type)

        if (decoded.type !== "movie") {
            const info = await this.seasonInfo(decoded.simklId, decoded.type)
            if (info) {
                relations = this.mergeRelationEdges(this.buildSeasonRelations(item, decoded.type, decoded.season, info), relations?.edges ?? [])
            }
        }

        const details: $app.AL_AnimeDetailsById_Media = {
            id,
            siteUrl: this.siteUrlOf(item, decoded.type),
            description: this.str(item.overview),
            genres: this.strArray(item.genres),
            meanScore,
            averageScore,
            popularity: this.num(item.ratings?.simkl?.votes),
            duration: this.num(item.runtime),
            startDate: this.parseDate(item.first_aired, item.year ?? 0),
            endDate: this.parseDate(item.last_aired, item.year ?? 0),
            trailer: this.trailerOf(item),
            rankings: this.buildRankings(item, decoded.type),
            studios: this.buildStudios(item, decoded.type),
            relations: relations ?? { edges: [] },
            recommendations: recommendations ?? { edges: [] },
        }

        const characters = await this.getCharacters(item, decoded.type)
        if (characters) details.characters = characters

        return details
    }

    async getAnimeMetadata(id): Promise<$app.Metadata_AnimeMetadata | null> {
        const metadataCache = $store.get<Record<number, $app.Metadata_AnimeMetadata>>("simkl.metadata") ?? {}
        const cached = metadataCache[id]
        if (cached) return cached

        const decoded = this.decodeId(id)
        if (!decoded) return null
        if (this.hideAnime && decoded.type === "anime") return null

        const title = this.titleOf(id)

        if (decoded.type === "movie") {
            const movie = await this.get<SimklItem>(`${this.detailEndpoint("movie")}/${decoded.simklId}`, { extended: "full" })
            if (movie && movie.ids) {
                const metadata = this.buildMovieMetadata(movie)
                metadataCache[id] = metadata
                $store.set("simkl.metadata", metadataCache)
                return metadata
            }
            return null
        }

        const path = decoded.type === "anime" ? "/anime/episodes/" : "/tv/episodes/"
        const params = decoded.type === "anime" ? { extended: "full_anime_seasons" } : { extended: "full" }
        const eps = await this.get<SimklEpisode[]>(`${path}${decoded.simklId}`, params)

        if (eps && Array.isArray(eps) && eps.length > 0) {
            const metadata = this.buildSeasonMetadata(eps, decoded.type, decoded.season, title)
            if (metadata.episodeCount > 0) {
                metadataCache[id] = metadata
                $store.set("simkl.metadata", metadataCache)
                return metadata
            }
        }

        return null
    }

    async getAnimeWithRelations(id): Promise<$app.AL_CompleteAnime> {
        const decoded = this.decodeId(id)
        if (!decoded) throw new Error("not found.")
        if (this.hideAnime && decoded.type === "anime") throw new Error("not found.")

        const item = await this.getDetail(decoded.type, decoded.simklId)
        if (!item || !item.ids) throw new Error("not found.")

        let epCount = this.episodeCount(item)
        let info: SimklSeasonInfo | null = null
        if (decoded.type !== "movie") {
            info = await this.seasonInfo(decoded.simklId, decoded.type)
            epCount = info?.counts?.[decoded.season] ?? epCount
        }

        const base = this.toALBaseAnime(item, {
            type: decoded.type,
            season: decoded.season,
            episodeCount: decoded.type === "movie" ? 1 ,
            status: decoded.type === "movie" ? undefined : info?.statuses?.[decoded.season],
        })
        if (!base) throw new Error("not found.")

        let relations = await this.buildRelations(item, decoded.type)
        if (info && decoded.type !== "movie") {
            relations = this.mergeRelationEdges(this.buildSeasonRelations(item, decoded.type, decoded.season, info), relations?.edges ?? [])
        }

        const mediaCache = $store.get<Record<number, $app.AL_BaseAnime>>("simkl.media") ?? {}
        mediaCache[id] = base
        $store.set("simkl.media", mediaCache)

        return {
            ...base,
            relations: relations ?? { edges: [] },
        } as $app.AL_CompleteAnime
    }

    async listAnime(search, page, perPage): Promise<ListResponse<$app.AL_BaseAnime>> {
        if (!this.hasClientId()) {
            const media = [this.makeConfigRequiredCard()]
            return { media, total: media.length, page, totalPages: 1 }
        }

        // Prefer the user's SIMKL watchlist when an access token is configured and no search is active
        if (this.accessToken && search.trim() === "") {
            const wl = await this.get<SimklWatchlist>("/sync/all-items/", { extended: "full" }, true)
            if (wl) {
                const media: $app.AL_BaseAnime[] = []
                const seen = new Set<number>()

                for (const entry of wl.movies ?? []) {
                    const item = entry?.movie ?? entry?.show
                    if (!item) continue
                    const m = this.toALBaseAnime(item, { type: "movie", season, episodeCount: 1 })
                    this.pushMedia(media, seen, m)
                }

                for (const entry of wl.shows ?? []) {
                    const item = entry?.show
                    if (!item) continue
                    const simklId = this.idOf(item)
                    if (!simklId) continue
                    if (this.hideAnime && this.typeOf(item) === "anime") continue

                    const seasons = entry?.seasons ?? []
                    if (seasons.length > 0) {
                        const info = await this.seasonInfo(simklId, "tv")
                        for (const s of seasons) {
                            const seasonNum = Number(s?.number)
                            if (!seasonNum || seasonNum <= 0) continue
                            const count = s?.episodes?.length || this.episodeCount(item)
                            const m = this.toALBaseAnime(item, {
                                type: "tv",
                                season,
                                episodeCount,
                                status: info?.statuses?.[seasonNum],
                            })
                            this.pushMedia(media, seen, m)
                        }
                    } else {
                        const cards = await this.itemToCards(item, "tv")
                        for (const m of cards) this.pushMedia(media, seen, m)
                    }
                }

                if (!this.hideAnime) {
                    for (const entry of wl.anime ?? []) {
                        const item = entry?.show
                        if (!item) continue
                        const cards = await this.itemToCards(item, "anime")
                        for (const m of cards) this.pushMedia(media, seen, m)
                    }
                }

                $store.set("simkl.media", this.toIdMap(media))
                return { media, total: media.length, page, totalPages: 1 }
            }
        }

        // Fallback: trending (anime unless hidden, else tv + movies)
        if (search.trim() === "") {
            const media = this.hideAnime
                ? await (async () => {
                    const [tv, movies] = await Promise.all([
                        this.get<SimklItem[]>("/tv/trending/", { extended: "overview,metadata,tmdb,genres,trailer" }),
                        this.get<SimklItem[]>("/movies/trending/", { extended: "overview,metadata,tmdb,genres,trailer" }),
                    ])
                    return this.itemsToMedia([...(tv ?? []), ...(movies ?? [])])
                })()
                : await this.itemsToMedia((await this.get<SimklItem[]>("/anime/trending/", { extended: "overview,metadata,tmdb,genres,trailer" })) ?? [], "anime")
            $store.set("simkl.media", this.toIdMap(media))
            return { media, total: media.length, page, totalPages: 1 }
        }

        // Search across anime (unless hidden), tv and movie
        const types = this.hideAnime ? ["tv", "movie"] : ["anime", "tv", "movie"]
        const queries: Promise<SimklItem[] | null>[] = types.map((t) =>
            this.get<SimklItem[]>(`/search/${t}`, {
                q,
                page: String(page),
                limit: String(perPage),
                extended: "full",
            }),
        )
        const results = await Promise.all(queries)
        const items = results
            .filter((r): r is SimklItem[] => Array.isArray(r) && r.length > 0)
            .reduce((acc, r) => acc.concat(r), [] as SimklItem[])
        const media = await this.itemsToMedia(items)
        $store.set("simkl.media", this.toIdMap(media))
        return {
            media,
            total: media.length,
            page,
            totalPages: Math.max(1, Math.ceil(media.length / perPage)),
        }
    }

    async getManga(ids): Promise<$app.AL_BaseManga[]> {
        return Promise.resolve([])
    }

    async getMangaDetails(id): Promise<$app.AL_MangaDetailsById_Media | null> {
        return null
    }

    async listManga(search, page, perPage): Promise<ListResponse<$app.AL_BaseManga>> {
        return { media, total, page, totalPages: 1 }
    }
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "Simkl V2", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "Simkl V2", url, type: manifest.type }) });
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