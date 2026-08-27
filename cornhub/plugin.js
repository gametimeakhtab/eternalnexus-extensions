(function() {
    var manifest = {"packageName":"com.eternalnexus.cornhub","name":"CornHub (18+)","version":1,"description":"Online streaming provider for PornHub (18+) videos.","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"video","rating":"18","isAdult":true,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};



// The repo's shared d.ts files declare colliding global types (Settings,
// SearchResult are also used by manga-provider/custom-source). Define the
// onlinestream shapes locally so this provider type-checks in isolation.
 Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
                "Referer": `${this._baseUrl()}/`,
                "Accept-Language": "en-US,en;q=0.9",
            },
            videoSources,
        }
    }

    // ------------------------------------------------------------------ stream extraction

    // Extracts the video page's flashvars JSON object (brace balanced).
    _extractFlashvars(html): any | null {
        const match = html.match(/var\s+flashvars_[\w]*\s*=\s*(\{)/)
        if (!match) return null

        const start = match.index! + match[0].length - 1
        let depth = 0
        let inStr = false
        let esc = false

        for (let i = start; i < html.length; i++) {
            const c = html[i]

            if (inStr) {
                if (esc) {
                    esc = false
                } else if (c === "\\") {
                    esc = true
                } else if (c === '"') {
                    inStr = false
                }
                continue
            }

            if (c === '"') {
                inStr = true
            } else if (c === "{") {
                depth++
            } else if (c === "}") {
                depth--
                if (depth === 0) {
                    try {
                        return JSON.parse(html.slice(start, i + 1))
                    } catch (err) {
                        return null
                    }
                }
            }
        }

        return null
    }

    _extractVideoSources(html): CornVideoSource[] {
        const ret = []
        const seen, boolean> = {}

        const push = (url, type: "mp4" | "m3u8", quality) => {
            if (!url || seen[url]) return
            seen[url] = true
            ret.push({
                url,
                type,
                quality: quality || "auto",
                subtitles,
            })
        }

        const flashvars = this._extractFlashvars(html)

        if (flashvars?.mediaDefinitions && Array.isArray(flashvars.mediaDefinitions)) {
            for (const def of flashvars.mediaDefinitions) {
                if (!def) continue

                const format = String(def.format || "").toLowerCase()
                const rawUrl = def.videoUrl || def.url || ""

                if (!rawUrl) continue

                const height = Number(def.height) || 0
                const width = Number(def.width) || 0
                let quality = this._decode(String(def.quality || ""))
                if (!quality) {
                    if (height > 0) quality = `${height}p`
                    else if (width > 0) quality = `${width}p`
                } else if (/^\d+$/.test(quality)) {
                    quality = `${quality}p`
                }

                if (format === "hls") {
                    push(rawUrl, "m3u8", quality)
                } else if (format === "mp4") {
                    // Direct mp4 URLs are served via a get_media endpoint that
                    // usually requires extra tokens/cookies; keep them as mp4
                    // only when they look like direct media files.
                    if (rawUrl.includes("/video/get_media")) continue
                    push(rawUrl, "mp4", quality)
                }
            }
        }

        // Fallback: quality items embedded as key/value URL maps.
        if (ret.length === 0 && flashvars?.qualityItems && Array.isArray(flashvars.qualityItems)) {
            for (const item of flashvars.qualityItems) {
                if (!item) continue
                const rawUrl = item.url || item.videoUrl || ""
                if (!rawUrl) continue
                push(rawUrl, "m3u8", this._decode(String(item.quality || item.id || "")))
            }
        }

        // Fallback: bare HLS URLs anywhere in the page.
        if (ret.length === 0) {
            const m3u8Pattern = /https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/gi
            let m: RegExpExecArray | null
            while ((m = m3u8Pattern.exec(html)) !== null) {
                const u = this._decode(m[0])
                if (u.includes("master.m3u8")) {
                    push(u, "m3u8", "auto")
                }
            }
        }

        // Sort highest quality first, keep default quality on top.
        const score = (q) => {
            const num = parseInt(q, 10)
            return isNaN(num) ? 0 : num
        }

        return ret.sort((a, b) => score(b.quality) - score(a.quality))
    }

    // ------------------------------------------------------------------ search parsing

    _parseSearchPage(html): CornhubVideo[] {
        const videos = []

        const jsonLdVideos = this._parseJsonLdList(html)
        videos.push(...jsonLdVideos)

        const patterns = [
            /<a[^>]+href=["']([^"']*view_video\.php\?viewkey=[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
            /<a[^>]+href=["']([^"']*\/view_video\.php\?viewkey=[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
        ]

        for (const pattern of patterns) {
            let match: RegExpExecArray | null

            while ((match = pattern.exec(html)) !== null) {
                const rawHref = this._decode(match[1] || "")
                const inner = match[2] || ""
                const videoId = this._getPornhubId(rawHref)

                if (!videoId) continue

                const title =
                    this._decode(this._match(inner, /title=["']([^"']+)["']/i)) ||
                    this._decode(this._match(inner, /alt=["']([^"']+)["']/i)) ||
                    this._decode(this._stripTags(inner)).trim()

                if (!title || title.length < 2) continue

                const thumb =
                    this._decode(this._match(inner, /data-mediumthumb=["']([^"']+)["']/i)) ||
                    this._decode(this._match(inner, /data-src=["']([^"']+)["']/i)) ||
                    this._decode(this._match(inner, /src=["']([^"']+)["']/i)) ||
                    ""

                videos.push({
                    videoId,
                    title,
                    url: this._normalizeUrl(rawHref),
                    thumbnail: this._normalizeUrl(thumb),
                })
            }
        }

        return this._dedupeVideos(videos)
    }

    _parseJsonLdList(html): CornhubVideo[] {
        const ret = []
        const scripts = this._extractScriptJsonLd(html)

        for (const raw of scripts) {
            try {
                const data = JSON.parse(raw)
                const items = this._flattenJsonLd(data)

                for (const item of items) {
                    const video = this._jsonLdToVideo(item, "")
                    if (video) ret.push(video)
                }
            } catch (err) {
            }
        }

        return ret
    }

    _parseJsonLdVideo(html, pageUrl): CornhubVideo | null {
        const scripts = this._extractScriptJsonLd(html)

        for (const raw of scripts) {
            try {
                const data = JSON.parse(raw)
                const items = this._flattenJsonLd(data)

                for (const item of items) {
                    const video = this._jsonLdToVideo(item, pageUrl)
                    if (video) return video
                }
            } catch (err) {
            }
        }

        return null
    }

    _jsonLdToVideo(item, fallbackUrl): CornhubVideo | null {
        if (!item) return null

        const q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        }

        let res = await fetch(url, { headers: headers })

        if (!res.ok) {
            // PornHub answers many long/symbol-heavy search queries with HTTP 404
            // while still serving a fully parseable results page. Allow the
            // caller to consume those bodies (used by search()) while watch-page
            // fetches keep failing cleanly on a real 404.
            if (!(allow404 && res.status === 404)) {
                throw new Error(`HTTP ${res.status} for ${url}`)
            }
        }

        let html = await res.text()

        // PornHub intermittently serves a JS anti-bot challenge page instead of
        // the real page. Retry once when the response looks like a challenge.
        if (html.length < 500 || html.includes("leastFactor")) {
            res = await fetch(url, { headers: headers })
            if (!res.ok) {
                if (!(allow404 && res.status === 404)) {
                    throw new Error(`HTTP ${res.status} for ${url}`)
                }
            }
            html = await res.text()
        }

        return html
    }

    _extractScriptJsonLd(html): string[] {
        const ret = []
        const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
        let match: RegExpExecArray | null

        while ((match = pattern.exec(html)) !== null) {
            const raw = (match[1] || "").trim()
            if (raw) ret.push(raw)
        }

        return ret
    }

    _flattenJsonLd(data): any[] {
        const ret = []

        const walk = (value) => {
            if (!value) return

            if (Array.isArray(value)) {
                for (const item of value) walk(item)
                return
            }

            if (typeof value === "object") {
                ret.push(value)

                if (Array.isArray(value["@graph"])) walk(value["@graph"])
                if (Array.isArray(value.itemListElement)) {
                    for (const el of value.itemListElement) {
                        if (el?.item) walk(el.item)
                        else walk(el)
                    }
                }
            }
        }

        walk(data)
        return ret
    }

    _getPornhubId(input): string {
        const text = String(input || "").trim()

        const patterns = [
            /viewkey=([a-zA-Z0-9_-]+)/i,
            /\/view_video\.php\?viewkey=([a-zA-Z0-9_-]+)/i,
        ]

        for (const pattern of patterns) {
            const match = text.match(pattern)
            if (match?.[1]) return match[1]
        }

        if (/^[a-zA-Z0-9_-]{8,}$/.test(text)) return text

        return ""
    }

    _watchUrl(videoId): string {
        return `${this._baseUrl()}/view_video.php?viewkey=${encodeURIComponent(videoId)}`
    }

    _baseUrl(): string {
        let url = this.base_url || "https://www.pornhub.com"

        if (url.includes("{{") || url.includes("}}")) {
            url = "https://www.pornhub.com"
        }

        return this._trimSlash(url)
    }

    _normalizeUrl(url): string {
        if (!url) return ""

        if (url.startsWith("//")) return "https:" + url
        if (url.startsWith("/")) return this._baseUrl() + url

        return url
    }

    _match(text, pattern): string {
        const match = String(text || "").match(pattern)
        return match?.[1] || ""
    }

    _stripTags(input): string {
        return String(input || "")
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
    }

    _decode(input): string {
        const named, string> = {
            "amp": "&",
            "quot": '"',
            "apos": "'",
            "lt": "<",
            "gt": ">",
            "nbsp": " ",
            "quest": "?",
            "excl": "!",
            "colon": ":",
            "period": ".",
            "comma": ",",
            "semi": ";",
            "sol": "/",
            "lpar": "(",
            "rpar": ")",
            "lsqb": "[",
            "rsqb": "]",
            "hellip": "…",
            "ndash": "–",
            "mdash": "—",
            "rsquo": "'",
            "lsquo": "'",
            "ldquo": '"',
            "rdquo": '"',
            "prime": "′",
            "deg": "°",
        }

        return String(input || "")
            .replace(/&(#x?[0-9a-fA-F]+);/g, (_, code) => {
                try {
                    const n = code[1].toLowerCase() === "x"
                        ? parseInt(code.slice(2), 16)
                        : parseInt(code.slice(1), 10)
                    return String.fromCharCode(n)
                } catch (err) {
                    return ""
                }
            })
            .replace(/&([a-zA-Z0-9]+);/g, (_, name) => named[name] ?? `&${name};`)
    }

    _trimSlash(input): string {
        let value = String(input || "").trim()

        while (value.endsWith("/")) {
            value = value.slice(0, -1)
        }

        return value
    }

    _dedupeVideos(videos): CornhubVideo[] {
        const seen, boolean> = {}
        const ret = []

        for (const video of videos) {
            if (!video?.videoId || seen[video.videoId]) continue
            seen[video.videoId] = true
            ret.push(video)
        }

        return ret
    }
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "CornHub (18+)", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "CornHub (18+)", url, type: manifest.type }) });
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