(function() {
    var manifest = {"packageName":"com.eternalnexus.tmdbv2","name":"TMDB V2","version":1,"description":"Implements TMDb as a custom source with per-season media entries.","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"video","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};



// TMDB custom source (ported from eepyboba's community source), reworked so
// that each TV season is its own media entry with relative episode numbering.
//
// ID scheme:
//   movie -> 1000000000 + tmdbId
//   tv    -> 2000000000 + tmdbId * 1000 + seasonNumber
//
// Per-season entries make metadata episodes relative (1..N) within the
// season, so per-episode torrent search and streaming work with providers
// that build queries like "S02E05".

// Bump to invalidate cached media (e.g. when status computation changes).
const MEDIA_CACHE_VERSION = 3

function errMsg(e): string {
    return e instanceof Error ? e.message : String(e)
}

class Provider implements CustomSource {
    api_key = "{{api-key}}"

    language = "en-US"
    include_adult = "false"

    getSettings(): Settings {
        return {
            supportsAnime,
            supportsManga,
        }
    }

    // ---------------------------------------------------------------- CustomSource

    async getAnime(ids): Promise<$app.AL_BaseAnime[]> {
        const ret: $app.AL_BaseAnime[] = []
        const mediaCache = this._getMediaCache()

        for (const id of ids) {
            const cached = mediaCache[id]

            if (cached?.media) {
                ret.push(cached.media)
                continue
            }

            const decoded = this._decodeId(id)
            if (!decoded) continue

            if (decoded.mediaType === "movie") {
                const details = await this._getDetails("movie", decoded.tmdbId)
                if (!details) continue
                const stored = this._movieDetailsToStoredMedia(details)
                mediaCache[stored.media.id] = stored
                ret.push(stored.media)
                continue
            }

            const details = await this._getDetails("tv", decoded.tmdbId)
            if (!details) continue

            const season = this._detailsToSeasonCards(details)
                .find(s => s.season === decoded.season)

            if (season) {
                mediaCache[season.media.id] = season
                ret.push(season.media)
            }
        }

        this._setMediaCache(mediaCache)

        return ret
    }

    async getAnimeDetails(id): Promise<$app.AL_AnimeDetailsById_Media | null> {
        return null
    }

    async getAnimeMetadata(id): Promise<$app.Metadata_AnimeMetadata | null> {
        const mediaCache = this._getMediaCache()
        const cached = mediaCache[id]

        // Only trust cached metadata that was genuinely built (per-episode
        // overviews/stills for TV, or real movie metadata). The eager fallback
        // metadata from listing is never valid to return here because it only
        // contains a single placeholder episode.
        if (cached?.metadata && cached.realMetadata) {
            return cached.metadata
        }

        const decoded = cached
            ? { mediaType: cached.mediaType, tmdbId: cached.tmdbId, season: cached.season }
            : this._decodeId(id)

        if (!decoded) {
            return null
        }

        let metadata: $app.Metadata_AnimeMetadata | null = null
        let builtReal = false

        try {
            if (decoded.mediaType === "movie") {
                const details = await this._getDetails("movie", decoded.tmdbId)
                if (details) {
                    metadata = this._movieDetailsToMetadata(details)
                    builtReal = true
                }
            } else {
                metadata = await this._tvSeasonToMetadata(decoded.tmdbId, decoded.season)
                if (metadata) {
                    builtReal = true
                }
            }
        } catch (e) {
            console.error("TMDB: metadata build failed: " + errMsg(e))
        }

        // Last resort: if the real metadata could not be built, use the media
        // card's fallback so the episode list still has something to show.
        if (!metadata && cached?.media) {
            metadata = this._fallbackMetadata(cached.media, cached.mediaType, cached.media)
        }

        if (!metadata) {
            return null
        }

        const stored = cached || null
        if (stored) {
            stored.metadata = metadata
            stored.realMetadata = builtReal
            mediaCache[stored.media.id] = stored
            this._setMediaCache(mediaCache)
        }

        return metadata
    }

    async getAnimeWithRelations(id): Promise<$app.AL_CompleteAnime> {
        const mediaCache = this._getMediaCache()
        let cached = mediaCache[id]

        if (!cached) {
            const media = await this.getAnime([id])
            if (!media || media.length === 0) {
                throw new Error("not found.")
            }

            cached = this._getMediaCache()[id]
        }

        if (!cached?.media) {
            throw new Error("not found.")
        }

        return {
            ...(cached.media as any),
            relations: { edges: [] },
        } as $app.AL_CompleteAnime
    }

    async listAnime(search, page, perPage): Promise<ListResponse<$app.AL_BaseAnime>> {
        const query = String(search || "").trim()
        const currentPage = page && page > 0 ? page : 1
        const limit = Math.max(1, Math.min(perPage || 20, 20))

        if (!this._hasApiKey()) {
            const media = [this._makeConfigRequiredCard()]
            return {
                media,
                total: media.length,
                page,
                totalPages,
            }
        }

        let response: TMDBListResponse<TMDBSearchItem> | null = null

        if (query.length > 0) {
            response = await this._tmdbGet<TMDBListResponse<TMDBSearchItem>>("/search/multi", {
                query,
                page: String(currentPage),
                include_adult: this._includeAdult() ? "true" : "false",
            })
        } else {
            response = await this._tmdbGet<TMDBListResponse<TMDBSearchItem>>("/trending/all/day", {
                page: String(currentPage),
            })
        }

        const results = (response?.results || [])
            .filter(item => item && (item.media_ resolve in parallel.
        const jobs = results.map(async (item) => {
            return (await this._searchItemToStoredMedia(item)) || []
        })

        const allStored = await Promise.all(jobs)

        for (const stored of allStored) {
            for (const s of stored) {
                mediaCache[s.media.id] = s
                media.push(s.media)
            }
        }

        this._setMediaCache(mediaCache)

        return {
            media,
            total: response?.total_results || media.length,
            page,
            totalPages: response?.total_pages || Math.max(1, Math.ceil(media.length / limit)),
        }
    }

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

    // ---------------------------------------------------------------- TMDB helpers

    async _getDetails(mediaType, tmdbId): Promise<TMDBDetails | null> {
        if (!this._hasApiKey()) return null

        const path = mediaType === "movie"
            ? `/movie/${tmdbId}`
            : `/tv/${tmdbId}`

        return await this._tmdbGet<TMDBDetails>(path, {
            append_to_response: "videos,external_ids",
        })
    }

    async _tmdbGet<T>(path, params?, string>): Promise<T | null> {
        const key = this._apiKey()
        if (!key) return null

        const query, string> = {
            api_key,
            language: this._language(),
            ...(params || {}),
        }

        const parts = []

        for (const k of Object.keys(query)) {
            const value = query[k]
            if (value === undefined || value === null || value === "") continue
            parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(value)}`)
        }

        const url = `https://api.themoviedb.org/3${path}?${parts.join("&")}`

        try {
            const res = await fetch(url, {
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
            })

            if (!res.ok) {
                console.error("TMDB error:", res.status, url)
                return null
            }

            return await res.json()
        } catch (err) {
            console.error("TMDB fetch failed:", err)
            return null
        }
    }

    // Turns a search result into stored media. Movies produce one entry; TV
    // shows produce one entry per season.
    async _searchItemToStoredMedia(item): Promise<StoredTMDBMedia[] | null> {
        const mediaType = item.media_ i < seasonEpisodes.length; i++) {
            const ep = seasonEpisodes[i]
            const n = i + 1
            const image = this._still(ep.still_path)
            const epTitle = ep.name || `Episode ${n}`

            episodes[String(n)] = {
                anidbId,
                tvdbId,
                anidbEid,
                title,
                image,
                airDate: ep.air_date || "",
                length: ep.runtime || fallbackRuntime || 0,
                summary: ep.overview || "",
                overview: ep.overview || "",
                episodeNumber,
                episode: String(n),
                seasonNumber,
                absoluteEpisodeNumber,
                hasImage: !!image,
            }
        }

        // Fallback: the season endpoint returned no episodes, but the show
        // details know the season exists. Emit placeholder episodes.
        if (Object.keys(episodes).length === 0) {
            const season = Array.isArray(details?.seasons)
                ? details!.seasons.find(s => Number(s.season_number) === seasonNumber)
                : undefined

            const count = Number(season?.episode_count) || 1
            const poster = this._poster(season?.poster_path || details?.poster_path)
            const description = this._truncate(season?.overview || details?.overview || "", 4000)

            for (let i = 1; i <= count; i++) {
                episodes[String(i)] = {
                    anidbId,
                    tvdbId,
                    anidbEid,
                    title: `Episode ${i}`,
                    image,
                    airDate: "",
                    length,
                    summary,
                    overview,
                    episodeNumber,
                    episode: String(i),
                    seasonNumber,
                    absoluteEpisodeNumber,
                    hasImage: !!poster,
                }
            }
        }

        return {
            titles: {
                en,
            },
            episodes,
            episodeCount: Object.keys(episodes).length,
            specialCount,
        }
    }

    _fallbackMetadata(media: $app.AL_BaseAnime, mediaType, source): $app.Metadata_AnimeMetadata {
        const title = media.title?.english || media.title?.romaji || media.title?.userPreferred || "TMDB Title"
        const image = media.coverImage?.large || ""
        const date = media.startDate?.year
            ? `${media.startDate.year}-${this._pad(media.startDate.month || 1)}-${this._pad(media.startDate.day || 1)}`
            : ""

        const description = this._truncate(media.description || source?.overview || "", 4000)

        return {
            titles: {
                en,
            },
            episodes: {
                "1": {
                    anidbId,
                    tvdbId,
                    anidbEid,
                    title,
                    image,
                    airDate,
                    length === "movie" ? source?.runtime || 0 ,
                    summary,
                    overview,
                    episodeNumber,
                    episode: "1",
                    seasonNumber,
                    absoluteEpisodeNumber,
                    hasImage: !!image,
                },
            },
            episodeCount === "movie" ? 1 : media.episodes || 1,
            specialCount,
        }
    }

    _makeConfigRequiredCard(): $app.AL_BaseAnime {
        const title = "TMDB API key required"
        const now = new Date()

        return {
            id,
            siteUrl: "https://www.themoviedb.org/settings/api",
            title: {
                userPreferred,
                romaji,
                english,
                native,
            },
            coverImage: {
                large: "",
                medium: "",
                extraLarge: "",
                color: "",
            },
            bannerImage: "",
            description: "Add your TMDB v3 API key in this extension's settings.",
            genres: ["TMDB"],
            meanScore,
            synonyms,
            status: "FINISHED",
            episodes,
            type: "ANIME",
            format: "TV",
            seasonYear: now.getUTCFullYear(),
            isAdult,
            startDate: {
                year: now.getUTCFullYear(),
                month: now.getUTCMonth() + 1,
                day: now.getUTCDate(),
            },
            endDate,
        }
    }

    // ---------------------------------------------------------------- ID encoding

    _encodeId(mediaType, tmdbId, season = 0): number {
        if (mediaType === "movie") {
            return 1000000000 + Number(tmdbId)
        }

        return 2000000000 + Number(tmdbId) * 1000 + (season || 0)
    }

    _decodeId(id): { mediaType, tmdbId, season: number } | null {
        const numericId = Number(id)

        if (!numericId || isNaN(numericId)) {
            return null
        }

        if (numericId >= 2000000000) {
            const rest = numericId - 2000000000
            return {
                mediaType: "tv",
                tmdbId: Math.floor(rest / 1000),
                season: rest % 1000,
            }
        }

        if (numericId >= 1000000000) {
            return {
                mediaType: "movie",
                tmdbId: numericId - 1000000000,
                season,
            }
        }

        return null
    }

    // ---------------------------------------------------------------- utils

    _titleFromItem(item): string {
        return item.title || item.name || item.original_title || item.original_name || "TMDB Title"
    }

    _originalTitleFromItem(item): string {
        return item.original_title || item.original_name || this._titleFromItem(item)
    }

    _siteUrl(mediaType, tmdbId): string {
        return mediaType === "movie"
            ? `https://www.themoviedb.org/movie/${tmdbId}`
            : `https://www.themoviedb.org/tv/${tmdbId}`
    }

    _poster(path?): string {
        if (!path) return ""
        if (path.startsWith("http")) return path
        return `https://image.tmdb.org/t/p/w500${path}`
    }

    _backdrop(path?): string {
        if (!path) return ""
        if (path.startsWith("http")) return path
        return `https://image.tmdb.org/t/p/w1280${path}`
    }

    _still(path?): string {
        if (!path) return ""
        if (path.startsWith("http")) return path
        return `https://image.tmdb.org/t/p/w500${path}`
    }

    _parseDate(dateStr?): { year, month?, day?: number } | null {
        if (!dateStr) return null

        const d = new Date(dateStr)

        if (isNaN(d.getTime())) {
            return null
        }

        return {
            year: d.getUTCFullYear(),
            month: d.getUTCMonth() + 1,
            day: d.getUTCDate(),
        }
    }

    _toStatus(status?, firstDate?): $app.AL_MediaStatus {
        const first = firstDate ? new Date(firstDate).getTime() : 0

        if (first && !isNaN(first) && first > Date.now()) {
            return "NOT_YET_RELEASED"
        }

        const s = String(status || "").toLowerCase()

        if (
            s.includes("returning") ||
            s.includes("in production")
        ) {
            return "RELEASING"
        }

        if (
            s.includes("planned") ||
            s.includes("pilot") ||
            s.includes("post production") ||
            s.includes("rumored")
        ) {
            return "NOT_YET_RELEASED"
        }

        return "FINISHED"
    }

    _apiKey(): string {
        const key = String(this.api_key || "").trim()

        if (!key || key.includes("{{") || key.includes("}}")) {
            return ""
        }

        return key
    }

    _hasApiKey(): boolean {
        return this._apiKey().length > 0
    }

    _language(): string {
        const lang = String(this.language || "en-US").trim()

        if (!lang || lang.includes("{{") || lang.includes("}}")) {
            return "en-US"
        }

        return lang
    }

    _includeAdult(): boolean {
        const value = String(this.include_adult || "false").toLowerCase().trim()
        return value === "true" || value === "1" || value === "yes"
    }

    _truncate(input, max): string {
        if (!input) return ""
        if (input.length <= max) return input
        return input.slice(0, max - 3) + "..."
    }

    _pad(value): string {
        return value < 10 ? `0${value}` : `${value}`
    }

    // ---------------------------------------------------------------- cache

    _getMediaCache(), StoredTMDBMedia> {
        const raw = $store.get("tmdb.media") as { version?: number; media?, StoredTMDBMedia> } | undefined

        if (!raw || raw.version !== MEDIA_CACHE_VERSION || !raw.media) {
            return {}
        }

        return raw.media
    }

    _setMediaCache(cache, StoredTMDBMedia>) {
        $store.set("tmdb.media", {
            version,
            media,
        })
    }
}

type TMDBMediaType = "movie" | "tv"

type StoredTMDBMedia = {
    tmdbId: number
    mediaType: TMDBMediaType
    season: number
    media: $app.AL_BaseAnime
    metadata?: $app.Metadata_AnimeMetadata
    // True when the metadata was genuinely built (per-episode overviews/stills).
    // False/absent for the placeholder fallback that is not safe to return.
    realMetadata?: boolean
}

type TMDBListResponse<T> = {
    page: number
    results: T[]
    total_pages: number
    total_results: number
}

type TMDBGenre = {
    id: number
    name: string
}

type TMDBSearchItem = {
    id: number
    media_type: "movie" | "tv" | "person" | string
    title?: string
    name?: string
    original_title?: string
    original_name?: string
    overview?: string
    poster_path?: string
    backdrop_path?: string
    release_date?: string
    first_air_date?: string
    vote_average?: number
    vote_count?: number
    popularity?: number
    adult?: boolean
    genre_ids?: number[]
    original_language?: string
}

type TMDBDetails = {
    id: number

    title?: string
    original_title?: string
    name?: string
    original_name?: string

    overview?: string
    tagline?: string
    status?: string

    poster_path?: string
    backdrop_path?: string

    release_date?: string
    first_air_date?: string
    last_air_date?: string

    runtime?: number
    episode_run_time?: number[]

    vote_average?: number
    vote_count?: number
    popularity?: number

    adult?: boolean
    original_language?: string

    genres?: TMDBGenre[]

    number_of_episodes?: number
    number_of_seasons?: number
    seasons?: TMDBSeason[]

    next_episode_to_air?: TMDBEpisode
    last_episode_to_air?: TMDBEpisode
}

type TMDBSeason = {
    id?: number
    name?: string
    overview?: string
    poster_path?: string
    season_number: number
    episode_count?: number
    air_date?: string
}

type TMDBSeasonDetails = {
    id: number
    name?: string
    overview?: string
    poster_path?: string
    season_number: number
    air_date?: string
    episodes?: TMDBEpisode[]
}

type TMDBEpisode = {
    id?: number
    name?: string
    overview?: string
    air_date?: string
    episode_number?: number
    season_number?: number
    still_path?: string
    runtime?: number
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "TMDB V2", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "TMDB V2", url, type: manifest.type }) });
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