(function() {
    var manifest = {"packageName":"com.eternalnexus.mal_friend_stats","name":"MAL Friend Stats","version":1,"description":"Shows which of your MyAnimeList friends are watching or have rated the anime you're viewing","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"other","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};





function init() {
    $ui.register((ctx) => {

        // ──────────────────────────────── Types ────────────────────────────────

         i < parts.length; i++) {
                const part = parts[i]
                const userMatch = part.match(/href="https:\/\/myanimelist\.net\/profile\/([^"/?#\s]+)"/)
                if (userMatch) {
                    const username = decodeURIComponent(userMatch[1])
                    let avatar = ""
                    const dataSrcMatch = part.match(/data-src="([^"]+)"/)
                    if (dataSrcMatch) {
                        avatar = dataSrcMatch[1]
                    } else {
                        const srcMatch = part.match(/src="([^"]+)"/)
                        if (srcMatch && !srcMatch[1].endsWith('spacer.gif')) {
                            avatar = srcMatch[1]
                        }
                    }
                    parsed.push({ username, avatar })
                }
            }

            cacheSet(cacheKey, parsed, FRIENDS_LIST_TTL_MS)
            return parsed
        }

        // Fetches a single friend's anime/manga list (paginated only when necessary).
        // Returns [] on failure so the caller can continue with the other friends.
        async function fetchFriendListData(friend, malId, mediaType): Promise<any[]> {
            const cacheKey = `mfs:${mediaType}:${friend.username.toLowerCase()}`

            const idField = mediaType === "manga" ? "manga_id" : "anime_id"

            const cached = cacheGet(cacheKey)
            if (cached) {
                // Target already present in the cached list → done.
                const hit = (cached.value || []).find((e) => e[idField] === malId)
                if (hit) {
                    return cached.value
                }
                // Only trust a cache entry that covers the friend's ENTIRE list.
                if (cached.complete) {
                    return cached.value
                }
                // Incomplete + target not present → re-fetch (list may be truncated).
            }

            let listData = []
            let offset = 0
            let complete = false
            try {
                while (offset < 900) {
                    const listUrl = `https://myanimelist.net/${mediaType}list/${encodeURIComponent(friend.username)}/load.json?status=7&offset=${offset}`
                    const listResp = await ctx.fetch(listUrl, { timeout: 15 })
                    if (!listResp || !listResp.ok) {
                        break
                    }

                    const pageData = listResp.json<any[]>()
                    if (!pageData || !pageData.length) {
                        // Reached the end of the friend's list.
                        complete = true
                        break
                    }

                    listData = listData.concat(pageData)

                    // Early exit once we found the target media, or when the page
                    // was not completely full (no more pages exist).
                    const found = listData.some(e => e[idField] === malId)
                    if (found || pageData.length < 300) {
                        complete = pageData.length < 300
                        break
                    }

                    offset += 300
                }

                cacheSet(cacheKey, listData, LIST_TTL_MS, complete)
            } catch (err) {
                // Silently ignore — caller continues with the other friends.
            }

            return listData
        }

        // Limits active concurrent promises to prevent network rate limits when checking many friends.
        async function pLimit<T>(concurrency, tasks: (() => Promise<T>)[]): Promise<T[]> {
            const results = []
            let activeCount = 0
            let nextIndex = 0

            return new Promise<T[]>((resolve) => {
                function runNext() {
                    if (nextIndex >= tasks.length && activeCount === 0) {
                        resolve(results)
                        return
                    }

                    while (activeCount < concurrency && nextIndex < tasks.length) {
                        const currentIndex = nextIndex++
                        activeCount++
                        tasks[currentIndex]()
                            .then((res) => {
                                results[currentIndex] = res
                            })
                            .catch(() => {
                                results[currentIndex] = [] as any
                            })
                            .finally(() => {
                                activeCount--
                                runNext()
                            })
                    }
                }
                runNext()
            })
        }

        async function fetchMalFriends(malId, malUsername, mediaType): Promise<FriendEntry[]> {
            const friends = await fetchFriendList(malUsername)

            const results = []

            // Fetch ALL friend lists with concurrency limiting (max 5 active requests at a time).
            // This prevents MyAnimeList from rate-limiting us while still checking everyone.
            const tasks = friends.map((friend) => () => fetchFriendListData(friend, malId, mediaType))
            const lists = await pLimit(5, tasks)

            const idField = mediaType === "manga" ? "manga_id" : "anime_id"
            const progressField = mediaType === "manga" ? "num_read_chapters" : "num_watched_episodes"
            const totalField = mediaType === "manga" ? "manga_num_chapters" : "anime_num_episodes"

            for (let i = 0; i < friends.length; i++) {
                const friend = friends[i]
                const listData = lists[i] || []
                const match = listData.find(e => e[idField] === malId)
                if (match) {
                    results.push({
                        status: mapMALStatus(match.status, mediaType),
                        score: (match.score || 0) * 10,
                        progress: match[progressField] || 0,
                        total: match[totalField] ?? undefined,
                        user: {
                            name: friend.username,
                            avatar: friend.avatar || undefined,
                        },
                    })
                }
            }

            return results
        }

        // ──────────────────────────────── Plugin Entry ────────────────────────────────

        const mediaId = ctx.state(0)
        const mediaType = ctx.state<MediaType | null>(null)
        const friends = ctx.state<FriendEntry[]>([])
        const loading = ctx.state(false)
        const configured = ctx.state(false)

        const animePanel = ctx.newWebview({
            slot: "after-anime-entry-episode-list",
            fullWidth,
            autoHeight,
        })

        const mangaPanel = ctx.newWebview({
            slot: "after-manga-entry-chapter-list",
            fullWidth,
            autoHeight,
        })

        // Both panels share the same state and content — only the slot differs.
        animePanel.channel.sync("friends", friends)
        animePanel.channel.sync("loading", loading)
        animePanel.channel.sync("configured", configured)
        animePanel.channel.sync("mediaType", mediaType)
        mangaPanel.channel.sync("friends", friends)
        mangaPanel.channel.sync("loading", loading)
        mangaPanel.channel.sync("configured", configured)
        mangaPanel.channel.sync("mediaType", mediaType)

        // ── Open profile links ──
        const openUrl = ctx.state("")
        animePanel.channel.on("open-profile", (url) => {
            openUrl.set(url)
        })
        mangaPanel.channel.on("open-profile", (url) => {
            openUrl.set(url)
        })

        ctx.effect(() => {
            const url = openUrl.get()
            if (!url) return
            try {
                if ($os.platform === "windows") {
                    $os.cmd("cmd", "/c", "start", url).start()
                } else if ($os.platform === "darwin") {
                    $os.cmd("open", url).start()
                } else {
                    $os.cmd("xdg-open", url).start()
                }
            } catch (err) {
                // Silently ignore — unable to open the URL.
            }
            openUrl.set("")
        }, [openUrl])

        // ── Track navigation ──
        ctx.screen.onNavigate((e) => {
            let type: MediaType | null = null
            if (e.pathname === "/entry" && !!e.searchParams.id) {
                (async () => {
                try {
                    // Resolve the MAL ID (async + timeout-bounded, cached 7 days).
                    const malId = await getMalMediaId(id)
                    if (myToken !== navToken) return
                    if (!malId) {
                        friends.set([])
                        panel.hide()
                        return
                    }

                    const cacheKey = `mfs:result:${type}:${malUser}:${malId}`
                    const cached = cacheGet(cacheKey)

                    if (cached) {
                        // Instant path: cached answer — no need to show the spinner.
                        friends.set(cached.value)
                        if (cached.value.length > 0) {
                            panel.show()
                        } else {
                            panel.hide()
                        }
                        return
                    }

                    const entries = await fetchMalFriends(malId, malUser, type)
                    if (myToken !== navToken) return
                    cacheSet(cacheKey, entries, RESULT_TTL_MS)
                    friends.set(entries)
                    if (entries.length > 0) {
                        panel.show()
                    } else {
                        panel.hide()
                    }
                } catch (err) {
                    if (myToken !== navToken) return
                    friends.set([])
                    panel.hide()
                } finally {
                    if (myToken === navToken) {
                        loading.set(false)
                    }
                    cancelFailsafe()
                }
            })()
        }, [mediaId, mediaType])

        // ── UI (shared by both panels) ──
        const panelContent = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
    html { color-scheme: dark; overflow: hidden; }
    body { background: transparent; color: #e2e8f0; font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 0; }

    .heading { font-size: 1.3rem; font-weight: 600; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }
    .heading .icon-svg { flex-shrink: 0; }
    .heading .badge { font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: #2e51a2; color: #fff; margin-left: 4px; }

    .list { display: flex; flex-wrap: wrap; gap: 9px; }

    .row { display: flex; align-items: center; gap: 12px; padding: 9px 15px; background: rgba(255,255,255,0.04); border-radius: 12px; text-decoration: none; color: inherit; cursor: pointer; }
    .row:hover { background: rgba(255,255,255,0.08); }

    .avatar { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: rgba(255,255,255,0.08); }
    .name { font-size: 1.3rem; max-width: 270px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .episode { font-size: 1.2rem; opacity: 0.8; }
    .score { font-size: 1.2rem; font-weight: 600; }
    .status { font-size: 1.1rem; font-weight: 600; padding: 3px 12px; border-radius: 999px; color: #10161f; }

    .loading { display: flex; align-items: center; gap: 10px; padding: 12px 15px; color: #8892a4; font-size: 1.2rem; }
    .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.12); border-top-color: #8892a4; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty { color: #8892a4; padding: 12px 15px; font-size: 1.2rem; }
    .note { color: #5a6476; padding: 12px 15px; font-size: 1.1rem; }
</style>
</head>
<body>
<div id="app"></div>
<script>
    var STATUS_LABEL = {"READING":"Reading","CURRENT":"Watching","PLANNING":"Planning","COMPLETED":"Completed","DROPPED":"Dropped","PAUSED":"On Hold","REPEATING":"Rewatching"}
    var STATUS_COLOR = {"READING":"#3db4f2","CURRENT":"#3db4f2","PLANNING":"#f2c94c","COMPLETED":"#4cd137","DROPPED":"#e84118","PAUSED":"#a4a4a4","REPEATING":"#9b59b6"}

    function scoreColor(s) {
        if (s >= 80) return "#4cd137"
        if (s >= 60) return "#c9d137"
        if (s >= 40) return "#f2994a"
        return "#e84118"
    }

    function renderRow(entry) {
        var username = (entry.user && entry.user.name) || ""
        var url = "https://myanimelist.net/profile/" + encodeURIComponent(username)

        var row = document.createElement("a")
        row.className = "row"
        row.href = url
        row.target = "_blank"
        row.rel = "noopener noreferrer"
        row.addEventListener("click", function (e) {
            e.preventDefault()
            window.webview.send("open-profile", url)
        })

        var img = document.createElement("img")
        img.className = "avatar"
        img.src = (entry.user && entry.user.avatar) || ""
        img.onerror = function () { this.style.display = "none" }
        row.appendChild(img)

        var name = document.createElement("div")
        name.className = "name"
        name.textContent = username || "Unknown"
        row.appendChild(name)

        if (entry.progress > 0 && entry.status !== "COMPLETED") {
            var ep = document.createElement("div")
            ep.className = "episode"
            var prefix = _mediaType === "manga" ? "Ch " : "Ep "
            ep.textContent = prefix + entry.progress + (entry.total ? "/" + entry.total : "")
            row.appendChild(ep)
        }

        if (entry.score > 0) {
            var s = document.createElement("div")
            s.className = "score"
            s.style.color = scoreColor(entry.score)
            s.textContent = String(Math.round(entry.score) / 10)
            row.appendChild(s)
        }

        var st = document.createElement("div")
        st.className = "status"
        st.style.background = STATUS_COLOR[entry.status] || "#a4a4a4"
        st.textContent = STATUS_LABEL[entry.status] || entry.status
        row.appendChild(st)

        return row
    }

    function render(friends, loading, configured) {
        var app = document.getElementById("app")
        app.innerHTML = ""

        if (!configured) {
            var note = document.createElement("div")
            note.className = "note"
            note.textContent = "Set your MAL username in settings"
            app.appendChild(note)
            return
        }

        if (loading) {
            var loader = document.createElement("div")
            loader.className = "loading"
            var sp = document.createElement("div")
            sp.className = "spinner"
            loader.appendChild(sp)
            loader.appendChild(document.createTextNode("Loading MAL friends\u2026"))
            app.appendChild(loader)
            return
        }

        if (!friends || friends.length === 0) {
            var empty = document.createElement("div")
            empty.className = "empty"
            empty.textContent = _mediaType === "manga"
                ? "No MAL friends found for this manga"
                : "No MAL friends found for this anime"
            app.appendChild(empty)
            return
        }

        // Heading with MAL icon
        var heading = document.createElement("div")
        heading.className = "heading"
        heading.innerHTML = '<svg class="icon-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#2e51a2"/><circle cx="8.5" cy="9.5" r="1.5" fill="white"/><circle cx="15.5" cy="9.5" r="1.5" fill="white"/><path d="M7 14.5c1.5 2.5 4.5 2.5 6 0" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/></svg>'
        heading.appendChild(document.createTextNode("MAL Friends"))
        var badge = document.createElement("span")
        badge.className = "badge"
        badge.textContent = "MAL"
        heading.appendChild(badge)
        app.appendChild(heading)

        var list = document.createElement("div")
        list.className = "list"
        friends.forEach(function (f) { list.appendChild(renderRow(f)) })
        app.appendChild(list)
    }

    var _friends = []
    var _loading = false
    var _configured = false
    var _mediaType = "anime"

    function rerender() { render(_friends, _loading, _configured) }

    window.webview.on("friends", function (d) { _friends = d || []; rerender() })
    window.webview.on("loading", function (d) { _loading = !!d; rerender() })
    window.webview.on("configured", function (d) { _configured = !!d; rerender() })
    window.webview.on("mediaType", function (d) { _mediaType = d === "manga" ? "manga" : "anime"; rerender() })
</script>
</body>
</html>
        `
        animePanel.setContent(() => panelContent)
        mangaPanel.setContent(() => panelContent)
    })
}
    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "MAL Friend Stats", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "MAL Friend Stats", url, type: manifest.type }) });
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