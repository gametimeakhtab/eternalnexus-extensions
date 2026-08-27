(function() {
    var manifest = {"packageName":"com.eternalnexus.streamedprovider","name":"Streamed (Sports)","version":1,"description":"Online streaming provider for Streamed (sports). Resolves live sports streams from Streamed's embed player.","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"video","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};



// Streamed (Sports) - Online Streaming Provider
// Resolves Streamed's embed player into a raw HLS (.m3u8) URL that Seanime can
// play natively. Streams are live sports broadcasts; availability varies.

const API_BASES = [
    "https://streamed.pk",
    "https://streamed.st",
]

// All stream sources exposed by Streamed (per API docs)
const SOURCES = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "intel"]

const SERVER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
    "Referer": "https://exposestrat.com/",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
}

 away?: { name?: string } }
    sources?: { source: string; id: string }[]
}

class Provider {
    base = API_BASES[0]
    // Cache of the fetched match by id, so the embed chain isn't re-walked per server.
    matchCache, ProviderMatch> = {}

    getSettings(): Settings {
        return {
            episodeServers: ["streamed"],
            supportsDub,
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

    async _fetchText(url, referer?): Promise<string> {
        const headers, string> = {
            "User-Agent": SERVER_HEADERS["User-Agent"],
        }
        if (referer) headers["Referer"] = referer
        const res = await fetch(url, { headers })
        if (!res.ok) throw new Error(`Request failed: ${url} (${res.status})`)
        return await res.text()
    }

    _match(html, re): string | null {
        const m = html.match(re)
        return m ? m[1] : null
    }

    // find match by id within the cached lists
    async _getMatch(id): Promise<ProviderMatch | null> {
        if (this.matchCache[id]) return this.matchCache[id]

        const lists = [
            await this._api<ProviderMatch[]>("/api/matches/live"),
            await this._api<ProviderMatch[]>("/api/matches/all-today"),
            await this._api<ProviderMatch[]>("/api/matches/all/popular"),
        ]
        for (const list of lists) {
            if (!list) continue
            const found = list.find((m) => m && m.id === id)
            if (found) {
                this.matchCache[id] = found
                return found
            }
        }
        return null
    }

    _titleOf(match): string {
        if (match.teams?.home?.name && match.teams?.away?.name) {
            return `${match.teams.home.name} vs ${match.teams.away.name}`
        }
        return match.title
    }

    _normalize(s): string {
        return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "")
    }

    // ---------------------------------------------------------------- embed -> m3u8

    // Resolve the stream's embedUrl into a playable .m3u8 URL.
    async _resolveEmbed(embedUrl): Promise<string> {
        // 1. Fetch the embed page (embed.st/embed/...) and find the inner streamed.php iframe
        const embedHtml = await this._fetchText(embedUrl)
        const inner = this._match(embedHtml, /<iframe[^>]+src="([^"]*streamed\.php[^"]*)"[^>]*>/i)
        if (!inner) throw new Error("Could not locate streamed.php iframe.")

        let streamedUrl = inner
        if (streamedUrl.startsWith("//")) streamedUrl = "https:" + streamedUrl
        else if (streamedUrl.startsWith("/")) streamedUrl = "https://embed.st" + streamedUrl
        if (!streamedUrl.startsWith("http")) streamedUrl = "https://embed.st" + streamedUrl

        // 2. Fetch streamed.php to get the channel fid
        const phpHtml = await this._fetchText(streamedUrl, "https://embed.st/")
        const fid = this._match(phpHtml, /fid\s*=\s*"([^"]+)"/)
        if (!fid) throw new Error("Could not extract channel fid.")

        // 3. Fetch maestrohd1.php which embeds the real player with the HLS URL
        const maestroUrl = `https://exposestrat.com/maestrohd1.php?player=desktop&live=${encodeURIComponent(fid)}`
        const maestroHtml = await this._fetchText(maestroUrl, "https://embedhd.st/")

        // 4. Extract the obfuscated char-array URL (rpUltgetHt return)
        const m3u8 = this._extractM3U8(maestroHtml)
        if (!m3u8) throw new Error("Could not extract HLS URL from player.")
        return m3u8
    }

    // The player builds the m3u8 URL in rpUltgetHt() as a char array join:
    //   return(["h","t","t",...].join("") + ibrUatrSnergelayrusaA.join("") + ...)
    _extractM3U8(html): string | null {
        const arrayMatch = html.match(/return\(\s*(\[[\s\S]*?\])\s*\.join\(""\)/)
        if (!arrayMatch) return null

        let out = ""
        const arraySrc = arrayMatch[1]
        const parts = arraySrc.match(/"((?:[^"\\]|\\.)*)"/g) || []
        for (const part of parts) {
            const val = part.slice(1, -1).replace(/\\\//g, "/")
            out += val
        }
        if (!out || !out.startsWith("http")) return null

        // Optional suffix variables are almost always [""]; ignore them.
        return out
    }

    // Fetch all live streams for a match source and pick the best embed.
    async _getEmbedForSource(matchId, source): Promise<string> {
        const match = await this._getMatch(matchId)
        if (!match || !match.sources) throw new Error("Match not found.")

        const srcInfo = match.sources.find((s) => s.source === source)
        if (!srcInfo) throw new Error(`Source '${source}' not available for this match.`)

        const url = `/api/stream/${source}/${srcInfo.id}`
        const streams = await this._api<any[]>(url)
        if (!streams || streams.length === 0) throw new Error("No live streams for this source.")

        // Prefer HD English stream
        let best = streams[0]
        for (const s of streams) {
            if (s && s.hd && String(s.language || "").toLowerCase().startsWith("en")) {
                best = s
                break
            }
        }
        if (!best || !best.embedUrl) throw new Error("Stream has no embed URL.")
        return best.embedUrl
    }

    // ---------------------------------------------------------------- Provider

    async search(opts): Promise<SearchResult[]> {
        const query = String(opts.query || opts.media?.englishTitle || opts.media?.romajiTitle || "").trim()
        if (!query) return []

        const q = this._normalize(query)

        const lists = [
            await this._api<ProviderMatch[]>("/api/matches/live"),
            await this._api<ProviderMatch[]>("/api/matches/all-today"),
            await this._api<ProviderMatch[]>("/api/matches/all/popular"),
        ]

        const results = []
        const seen, boolean> = {}

        for (const list of lists) {
            if (!list) continue
            for (const m of list) {
                if (!m || !m.id) continue
                const title = this._titleOf(m)
                const nTitle = this._normalize(title)

                // exact normalized match, or a longer-title containment match
                const exact = nTitle === q
                const contains = nTitle.includes(q) && q.length >= 4
                if (!exact && !contains) continue
                if (seen[m.id]) continue
                seen[m.id] = true

                results.push({
                    id: m.id,
                    title,
                    url: "",
                    subOrDub: "sub",
                })
            }
        }

        return results
    }

    async findEpisodes(id): Promise<EpisodeDetails[]> {
        const match = await this._getMatch(id)
        if (!match) return []

        const title = this._titleOf(match)
        return [
            {
                id,
                number,
                url: "",
                title,
            },
        ]
    }

    async findEpisodeServer(episode, server): Promise<EpisodeServer> {
        // We advertise a single "streamed" server; walk the match's sources
        // in order and return the first resolvable HLS stream.
        const match = await this._getMatch(episode.id)
        if (!match || !match.sources || match.sources.length === 0) {
            throw new Error("Match not found or has no sources.")
        }

        let lastErr: Error | null = null

        for (const srcInfo of match.sources) {
            try {
                const embedUrl = await this._getEmbedForSource(episode.id, srcInfo.source)
                const m3u8 = await this._resolveEmbed(embedUrl)
                return {
                    server: "streamed",
                    headers,
                    videoSources: [
                        {
                            url,
                            type: "m3u8",
                            quality: "auto",
                            subtitles,
                        },
                    ],
                }
            } catch (err) {
                lastErr = err as Error
            }
        }

        throw new Error(lastErr?.message || "No playable source found.")
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