(function() {
    var manifest = {"packageName":"com.eternalnexus.vidsrc","name":"VidSrc","version":1,"description":"Streams anime, series and movies from vidsrc (https://vidsrc.mov/). Requires a SIMKL Client ID for title matching.","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"video","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};



const SIMKL_API = "https://api.simkl.com"
const VIDSRC_API = "https://data.vidsrcme.ru/api.php"








}



class Provider implements AnimeProvider {
    clientId = "{{simkl-client-id}}"

    getSettings(): Settings {
        return {
            episodeServers: ["vidsrc"],
            supportsDub,
        }
    }

    // ---------------------------------------------------------------- helpers

    hasClientId(): boolean {
        const key = String(this.clientId || "").trim()
        return key.length > 0 && !key.includes("{{")
    }

    async simklSearch(type: "anime" | "tv" | "movie", q): Promise<SimklItem[] | null> {
        try {
            const res = await fetch(
                `${SIMKL_API}/search/${type}?q=${encodeURIComponent(q)}&client_id=${encodeURIComponent(this.clientId)}&extended=full&limit=10`,
            )
            if (!res.ok) return null
            return res.json() as unknown as SimklItem[]
        } catch {
            return null
        }
    }

    async simklDetail(type: "anime" | "tv" | "movie", simklId): Promise<SimklItem | null> {
        try {
            const res = await fetch(
                `${SIMKL_API}/${type}/${simklId}?client_id=${encodeURIComponent(this.clientId)}&extended=full`,
            )
            if (!res.ok) return null
            return res.json() as unknown as SimklItem
        } catch {
            return null
        }
    }

    tmdbOf(item, type: "anime" | "tv" | "movie"): string {
        const t = item?.ids?.tmdb
        if (t && t !== "0") return String(t)
        return ""
    }

    str(v): string {
        return v === null || v === undefined ? "" : String(v)
    }

    // Resolve a vidsrc  real movies live
        // under "movie". Try the primary endpoint, fall back to the other.
        const endpoints: ("anime" | "tv" | "movie")[] = vType === "movie"
            ? ["movie", "anime"]
            : ["anime", "tv"]

        // Merge results from all applicable endpoints. The SIMKL "anime"
        // endpoint can return false positives for live-action titles (e.g. "The
        // Boys"), so we must also consult "tv"/"movie" and pick the best overall
        // match instead of stopping at the first non-empty result set.
        const seen = new Set<string>()
        const items = []
        for (const ep of endpoints) {
            const res = await this.simklSearch(ep, query)
            if (!res || res.length === 0) continue
            for (const item of res) {
                const key = String(item?.ids?.simkl_id ?? item?.ids?.simkl ?? item?.ids?.tmdb ?? "")
                if (!key || seen.has(key)) continue
                seen.add(key)
                items.push(item)
            }
        }
        if (items.length === 0) return []

        const best = this.pickBest(items, opts)
        if (!best) return []
        const bestSimklId = best?.ids?.simkl_id ?? best?.ids?.simkl
        if (!bestSimklId && !this.tmdbOf(best, "anime")) return []

        // Resolve a tmdb id (search results sometimes omit it for season splits).
        let tmdb = this.tmdbOf(best, "anime")
        if (!tmdb && bestSimklId) {
            const detail = await this.simklDetail("anime", bestSimklId)
            tmdb = detail ? this.tmdbOf(detail, "anime") : ""
        }
        if (!tmdb) return []

        const isMovie = this.isMovieItem(best)
        if (isMovie) {
            return [{
                id: `movie:${tmdb}`,
                title: this.str(best.title_en || best.title),
                url: `movie:${tmdb}`,
                subOrDub: "sub",
            }]
        }

        // TV/anime: determine which season this AniList entry corresponds to.
        const season = await this.determineSeason(tmdb, best, opts)
        const id = season > 0 ? `tv:${tmdb}:${season}` : `tv:${tmdb}`
        return [{
            id,
            title: this.str(best.title_en || best.title),
            url,
            subOrDub: "sub",
        }]
    }

    // Picks the SIMKL item that best matches the query/media. Candidates are
    // ranked by title similarity to the query first, then refined by exact year
    // and episode count when known.
    pickBest(items, opts): SimklItem {
        let ranked = [...items]
        const q = String(opts.query || "").trim().toLowerCase()
        if (q) {
            ranked.sort((a, b) => {
                const ta = String(a.title_en || a.title || "").toLowerCase()
                const tb = String(b.title_en || b.title || "").toLowerCase()
                return this.levenshtein(ta, q) - this.levenshtein(tb, q)
            })
        }
        const year = opts.year
        if (year) {
            const byYear = ranked.filter((i) => i.year === year)
            if (byYear.length > 0) ranked = byYear
        }
        const ec = opts.media?.episodeCount
        if (ec && ec > 0) {
            const byCount = ranked.filter((i) => i.ep_count === ec)
            if (byCount.length > 0) ranked = byCount
        }
        return ranked[0]
    }

    levenshtein(a, b): number {
        const m = a.length
        const n = b.length
        if (m === 0) return n
        if (n === 0) return m
        const dp = new Array<number>(n + 1)
        for (let j = 0; j <= n; j++) dp[j] = j
        for (let i = 1; i <= m; i++) {
            let prev = dp[0]
            dp[0] = i
            for (let j = 1; j <= n; j++) {
                const cur = dp[j]
                dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 ))
                prev = cur
            }
        }
        return dp[n]
    }

    isMovieItem(item): boolean {
        const t = String(item?. i < epNums.length; i++) {
                episodes.push({
                    id: `tv:${parsed.tmdb}:${parsed.season}:${epNums[i]}`,
                    number: i + 1,
                    url: `${parsed.season}:${epNums[i]}`,
                    title: `Episode ${i + 1}`,
                })
            }
            return episodes
        }

        // Unknown season: flatten all seasons into continuous absolute numbers.
        let number = 0
        for (const season of seasonKeys) {
            const epNums = (eps[String(season)] || [])
                .map(Number)
                .filter((n) => Number.isFinite(n) && n > 0)
                .sort((a, b) => a - b)
            for (const epNum of epNums) {
                number++
                episodes.push({
                    id: `tv:${parsed.tmdb}:${season}:${epNum}`,
                    number,
                    url: `${season}:${epNum}`,
                    title: `Episode ${number}`,
                })
            }
        }

        return episodes
    }

    // ---------------------------------------------------------------- findEpisodeServer

    async findEpisodeServer(episode, server): Promise<EpisodeServer> {
        // Recover the search-result id from the episode id (first segment = vidsrc type).
        const meta = this.metaFromEpisode(episode)
        if (!meta) {
            throw new Error("vidsrc: could not determine media from episode")
        }

        const { type, tmdb, season, epNum } = meta
        const full = await this.vidsrcRequestFull(type, tmdb, season, epNum)
        const data = full?.data
        const blobB64 = data?.stream_urls

        if (!blobB64) {
            throw new Error("vidsrc: no stream_urls returned")
        }

        // Fetch the wasm whose data-section bytes form the XOR key.
        const wasmUrl = full?.vs?.wasm_url
        const wasm = wasmUrl ? await this.fetchBytes(wasmUrl) : null
        if (!wasm || wasm.length === 0) {
            throw new Error("vidsrc: failed to fetch wasm")
        }

        const urls = this.decryptUrls(wasm, blobB64)
        if (!urls || urls.length === 0) {
            throw new Error("vidsrc: failed to decrypt stream urls")
        }

        const master = urls[0]
        const token = await this.fetchToken(master)
        const finalUrl = token ? `${master}?token=${encodeURIComponent(token)}` : master

        // The API returns subtitle tracks (top-level "default_subs") as SRT
        // files. Ship them as provider subtitle tracks; the player converts
        // SRT to ASS and proxies the URLs alongside the stream.
        const subtitles = this.mapSubtitles(full)

        return {
            server: "vidsrc",
            // Non-empty headers route playback through seanime's /api/v1/proxy
            // (which fetches upstream server-side). The vidsrc segment CDN
            // rejects requests carrying an Origin or Referer header, so direct
            // browser playback fails with 403; proxying avoids both.
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36" },
            videoSources: [{
                url,
                type: "m3u8",
                quality: "auto",
                subtitles,
            }],
        }
    }

    mapSubtitles(full: VidsrcResponse | null): VideoSubtitle[] {
        const subs = full?.default_subs
        if (!subs || subs.length === 0) return []
        const out = []
        for (let i = 0; i < subs.length; i++) {
            const s = subs[i]
            const url = this.str(s?.url)
            if (!url) continue
            out.push({
                id: `sub-${i}`,
                url,
                language: this.str(s?.lang),
                isDefault === 0,
            })
        }
        return out
    }

    metaFromEpisode(episode): { type: "tv" | "movie"; tmdb: string; season: number; epNum: number } | null {
        // Episode ids are:
        //   movie: `${tmdb}:1`        -> movie:<tmdb>:1
        //   tv:    `${tmdb}:${season}:${epNum}` -> tv:<tmdb>:<season>:<epNum>
        const idParts = String(episode?.id || "").split(":")
        if (idParts[0] === "movie" && idParts[1]) {
            return { type: "movie", tmdb, season, epNum: 1 }
        }
        if (idParts[0] === "tv" && idParts[1]) {
            const season = Number(idParts[2])
            const epNum = Number(idParts[3])
            return {
                type: "tv",
                tmdb,
                season: Number.isFinite(season) && season > 0 ? season ,
                epNum: Number.isFinite(epNum) && epNum > 0 ? epNum ,
            }
        }
        // Fallback: parse from url `${season}:${epNum}` with tmdb from id.
        const urlParts = String(episode?.url || "").split(":")
        const season = Number(urlParts[0])
        const epNum = Number(urlParts[1])
        return {
            type: "tv",
            tmdb,
            season: Number.isFinite(season) && season > 0 ? season ,
            epNum: Number.isFinite(epNum) && epNum > 0 ? epNum ,
        }
    }

    parseId(id): { type: "tv" | "movie"; tmdb: string; season: number } | null {
        const m = String(id || "").match(/^(tv|movie):(\d+)(?::(\d+))?$/)
        if (!m) return null
        const season = m[3] ? Number(m[3]) : 0
        return { type === "movie" ? "movie" : "tv", tmdb, season: Number.isFinite(season) && season > 0 ? season : 0 }
    }

    async vidsrcRequestFull(type: "tv" | "movie", tmdb, s, e): Promise<VidsrcResponse | null> {
        const params = 
        // retry a few times with a small delay.
        for (let attempt = 0; attempt < 4; attempt++) {
            try {
                const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
                if (!res.ok) continue
                // Response body is a Go []byte exposed as an array-like object.
                const arr = Uint8Array.from(res.body as any)
                if (arr.length > 0) return arr
            } catch {
                // fall through to retry
            }
            if (attempt < 3) {
                await this.sleep(500)
            }
        }
        return null
    }

    async sleep(ms): Promise<void> {
        return new Promise((resolve) => {
            const timer = setTimeout(() => resolve(), ms)
            // Timer kept reachable for environments that need it.
            void timer
        })
    }

    // ---------------------------------------------------------------- decryption

    // Decrypts a vidsrc stream_urls blob (base64 ChaCha20 IETF) into a list of
    // plaintext URLs by brute-forcing the 32-byte key across all data-segment
    // pairs. The wasm data section is not strictly required (the blob key is
    // derived by XOR of two 32-byte data segments inside the wasm), so we accept
    // the wasm bytes optionally; if unavailable we return null.
    decryptUrls(wasm: Uint8Array | null, blobB64): string[] | null {
        let segs: { offset: number; bytes: Uint8Array }[]
        if (wasm && wasm.length > 8) {
            segs = this.parseDataSegments(wasm)
        } else {
            // If we couldn't fetch wasm, there's nothing to derive the key from.
            return null
        }

        const blob = this.base64ToBytes(blobB64)
        const nonce = blob.subarray(0, 12)
        const ct = blob.subarray(12)

        for (let i = 0; i < segs.length; i++) {
            for (let j = i + 1; j < segs.length; j++) {
                const a = segs[i].bytes
                const b = segs[j].bytes
                if (a.length < 32 || b.length < 32) continue
                const key = new Uint8Array(32)
                for (let k = 0; k < 32; k++) key[k] = a[k] ^ b[k]
                const plain = this.chachaXor(key, 0, nonce, ct)
                const txt = this.decodeUtf8(plain)
                if (/https?:\/\//.test(txt) || /m3u8|\.mp4/.test(txt)) {
                    const urls = txt.split("\n").map((s) => s.trim()).filter((s) => s.length > 0)
                    if (urls.length > 0) return urls
                }
            }
        }
        return null
    }

    // ---------------------------------------------------------------- WASM MVP parser

    readUleb(buf, off), number] {
        let r = 0, s = 0
        for (;;) {
            const b = buf[off++]
            r |= (b & 0x7f) << s
            if (!(b & 0x80)) return [r, off]
            s += 7
        }
    }

    parseDataSegments(buf): { offset: number; bytes: Uint8Array }[] {
        const segs: { offset: number; bytes: Uint8Array }[] = []
        let off = 8
        while (off < buf.length) {
            const sid = buf[off++]
            let size: number
            ;[size, off] = this.readUleb(buf, off)
            if (sid === 11) {
                let cnt: number
                ;[cnt, off] = this.readUleb(buf, off)
                for (let i = 0; i < cnt; i++) {
                    const flag = buf[off++]
                    let offset = -1
                    if (flag === 0) {
                        const op = buf[off++]
                        if (op === 0x41) {
                            let v: number
                            ;[v, off] = this.readUleb(buf, off)
                            offset = v
                            off++
                        } else if (op === 0x42) {
                            let v: number
                            ;[v, off] = this.readUleb(buf, off)
                            offset = v
                            off++
                        }
                    } else if (flag === 2) {
                        let m: number
                        ;[m, off] = this.readUleb(buf, off)
                        const op = buf[off++]
                        if (op === 0x41) {
                            let v: number
                            ;[v, off] = this.readUleb(buf, off)
                            offset = v
                            off++
                        }
                    }
                    let len: number
                    ;[len, off] = this.readUleb(buf, off)
                    segs.push({ offset, bytes: buf.slice(off, off + len) })
                    off += len
                }
                break
            }
            off += size
        }
        return segs
    }

    // ---------------------------------------------------------------- ChaCha20 (IETF)

    rotl(x, n): number {
        return ((x << n) | (x >>> (32 - n))) >>> 0
    }

    QR(x, a, b, c, d): void {
        x[a] = (x[a] + x[b]) >>> 0; x[d] = this.rotl(x[d] ^ x[a], 16)
        x[c] = (x[c] + x[d]) >>> 0; x[b] = this.rotl(x[b] ^ x[c], 12)
        x[a] = (x[a] + x[b]) >>> 0; x[d] = this.rotl(x[d] ^ x[a], 8)
        x[c] = (x[c] + x[d]) >>> 0; x[b] = this.rotl(x[b] ^ x[c], 7)
    }

    chachaBlock(key, counter, nonce): Uint8Array {
        const st = new Uint32Array(16)
        const c = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574]
        for (let i = 0; i < 4; i++) st[i] = c[i]
        for (let i = 0; i < 8; i++) {
            st[4 + i] = ((key[4 * i] | (key[4 * i + 1] << 8) | (key[4 * i + 2] << 16) | (key[4 * i + 3] << 24)) >>> 0)
        }
        st[12] = counter >>> 0
        for (let i = 0; i < 3; i++) {
            st[13 + i] = ((nonce[4 * i] | (nonce[4 * i + 1] << 8) | (nonce[4 * i + 2] << 16) | (nonce[4 * i + 3] << 24)) >>> 0)
        }

        const x = new Uint32Array(st)
        for (let i = 0; i < 10; i++) {
            this.QR(x, 0, 4, 8, 12); this.QR(x, 1, 5, 9, 13); this.QR(x, 2, 6, 10, 14); this.QR(x, 3, 7, 11, 15)
            this.QR(x, 0, 5, 10, 15); this.QR(x, 1, 6, 11, 12); this.QR(x, 2, 7, 8, 13); this.QR(x, 3, 4, 9, 14)
        }
        const out = new Uint8Array(64)
        for (let i = 0; i < 16; i++) {
            const v = (x[i] + st[i]) >>> 0
            out[4 * i] = v & 0xff; out[4 * i + 1] = (v >>> 8) & 0xff; out[4 * i + 2] = (v >>> 16) & 0xff; out[4 * i + 3] = (v >>> 24) & 0xff
        }
        return out
    }

    chachaXor(key, counter, nonce, data): Uint8Array {
        const out = new Uint8Array(data.length)
        let c = counter
        for (let off = 0; off < data.length; off += 64) {
            const block = this.chachaBlock(key, c, nonce)
            const n = Math.min(64, data.length - off)
            for (let i = 0; i < n; i++) out[off + i] = data[off + i] ^ block[i]
            c = (c + 1) >>> 0
        }
        return out
    }

    // ---------------------------------------------------------------- byte helpers

    base64ToBytes(b64): Uint8Array {
        // goja_nodejs Buffer supports base64; avoids needing global atob/btoa.
        return Uint8Array.from((Buffer as any).from(b64, "base64"))
    }

    // Minimal UTF-8 decoder (goja lacks TextDecoder). Decrypted URLs are ASCII,
    // so we handle ASCII fast-path plus a conservative UTF-8 fallback.
    decodeUtf8(bytes): string {
        let out = ""
        let i = 0
        while (i < bytes.length) {
            const b = bytes[i]
            if (b < 0x80) {
                out += String.fromCharCode(b)
                i++
            } else {
                // Accumulate UTF-8 sequence and decode via Buffer to be safe.
                let len = 1
                if (b >= 0xc0 && b < 0xe0) len = 2
                else if (b >= 0xe0 && b < 0xf0) len = 3
                else if (b >= 0xf0) len = 4
                else len = 1
                const chunk = bytes.slice(i, Math.min(i + len, bytes.length))
                try {
                    out += (Buffer as any).from(chunk).toString("utf8")
                } catch {
                    out += String.fromCharCode(b)
                }
                i += len
            }
        }
        return out
    }

    async fetchToken(masterUrl): Promise<string> {
        try {
            const origin = new URL(masterUrl).origin
            const res = await fetch(`${origin}/generate.php`)
            if (!res.ok) return ""
            const t = (res.text() as any)
            const ts = typeof t === "string" ? t : String(t || "")
            return ts.trim() && !ts.startsWith("<") ? ts.trim() : ""
        } catch {
            return ""
        }
    }
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "VidSrc", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "VidSrc", url, type: manifest.type }) });
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