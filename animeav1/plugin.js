(function() {
    var manifest = {"packageName":"com.eternalnexus.animeav1","name":"AnimeAV1","version":1,"description":"Online streaming provider with hard subs and dubs in Spanish.","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"video","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};
// Seanime's onlinestream provider contract.
// Declared here because the runtime supplies them: esbuild strips them while
// transpiling, which keeps this file self-contained (the repo ships no .d.ts).

declare 

declare 

declare 

declare 

declare 

declare 

declare 

declare 

declare 

declare 

declare ;
    videoSources: VideoSource[];
}

declare 

declare 

declare function fetch(url, options?): Promise<FetchResponse>;

/** Key/value store the runtime shares across this extension's VMs. */
declare const $store: {
    get<T = any>(key): T | undefined;
    set(key, value): void;
    has(key): boolean;
    remove(key): void;
} | undefined;

// Long enough to cover building one episode list, short enough that a catalog
// that just added an entry is not hidden for long.
const SEARCH_CACHE_MS = 5 * 60 * 1000;

// How long a request may have been going before retrying stops being worth it.
// Comfortably above a refused connection, far below a hung one.
const RETRY_BUDGET_MS = 8000;

// Past this, a host is not being slow, it has stopped answering: mp4upload
// serves in well under a second or not at all. Well clear of a normal reply.
const SLOW_HOST_MS = 6000;

// Written down when mp4upload stalls, so it is passed over while this is set
// rather than costing another 35s on the next episode. Shares SEARCH_CACHE_MS.
const MP4UPLOAD_DOWN_KEY = "av1:mp4upload:down";

// Words that place an entry in a series without naming it, so a title made of
// nothing else carries no signal about which show it belongs to.
const GENERIC_WORDS: { [word: string]: boolean } = {
    season, part, cour, movie, special,
    ova, ona, tv, the, final,
};

const BROWSER_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// Cloudflare turns away player segments (/segs/) that do not look like they
// came from the player itself: without Sec-Fetch-Site it answers 403, playback
// stalls and Seanime refetches the source in a loop. Seanime's proxy replays
// these headers on every segment, not just on the playlist.
const HLS_HEADERS: { [key: string]: string } = {
    "Referer": "https://player.zilla-networks.com/",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    "User-Agent",
};

// What the site's own frontend sends when it fetches these endpoints. Measured
// against sending nothing, the median response roughly halves. It does not stop
// animeav1 dropping or hanging connections, which is a separate problem and the
// one behind the long waits.
const SITE_HEADERS: { [key: string]: string } = {
    "User-Agent",
    "Accept": "*/*",
    "Accept-Language": "es-ES,es;q=0.9",
    "Referer": "https://animeav1.com/",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
};

const MP4UPLOAD_HEADERS: { [key: string]: string } = {
    "Referer": "https://www.mp4upload.com/",
    "User-Agent",
};

/**
 * AnimeAV1 runs on SvelteKit, so every page exposes its state at `__data.json`.
 * devalue serialises that JSON: `data` is a flat array whose objects hold
 * indices instead of values, so reading anything means following pointers.
 */
class Provider {
    baseUrl = "https://animeav1.com";

    getSettings(): Settings {
        // Seanime asks for every server listed here before it hands back any
        // source, so both are resolved even when only one gets watched. HLS
        // comes first as the one that always works; mp4upload is the fallback
        // for when the player's host is unreachable, and it looks after its own
        // stalls, so a bad spell on its side costs the fallback rather than the
        // episode.
        return {
            episodeServers: ["HLS", "MP4Upload"],
            supportsDub,
        };
    }

    // The runtime exposes neither AbortController nor setTimeout, and `timeout`
    // does nothing because of the 
        let lastErr = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const res = await fetch(url, { timeout, headers });

                // animeav1's 5xx responses are usually transient, so retry.
                if (res.status >= 500 && attempt < retries && Date.now() - started < RETRY_BUDGET_MS) {
                    continue;
                }

                return res;
            } catch (err) {
                lastErr = err;

                // animeav1 refuses roughly one connection in six. A refusal
                // comes back in well under a second and the next attempt
                // usually lands, which is worth doing. A request that instead
                // hangs holds the line until fetch gives up on it 35s later,
                // and since the timeout option never takes effect there is no
                // way to cut that short - trying again just spends another 35s
                // on a host that is clearly not answering. One episode list
                // took Seanime 1m13s that way. Spent time tells the two apart.
                if (Date.now() - started >= RETRY_BUDGET_MS) break;
            }
        }

        throw lastErr ?? new Error(`No se pudo conectar con ${url}`);
    }

    buildAnimeId(slug, isDub): string {
        return JSON.stringify({ slug, type: isDub ? "dub" : "sub" });
    }

    _resolveRemixData(json, isDub): SearchResult[] {
        if (!json || !json.nodes) return [];

        for (const node of json.nodes) {
            if (node && node.uses && node.uses.search_params) {
                const data = node.data;
                if (!data || data.length === 0) continue;

                const rootConfig = data[0];
                if (!rootConfig || typeof rootConfig.results !== "number") continue;

                const animePointers = data[rootConfig.results];
                if (!Array.isArray(animePointers)) continue;

                const results = [];

                for (const pointer of animePointers) {
                    const rawObj = data[pointer];
                    if (!rawObj) continue;

                    const title = data[rawObj.title];
                    const slug = data[rawObj.slug];
                    if (!title || !slug) continue;

                    results.push({
                        id: this.buildAnimeId(slug, isDub),
                        title,
                        url: `${this.baseUrl}/media/${slug}`,
                        subOrDub: isDub ? "dub" : "sub",
                    });
                }

                return results;
            }
        }

        return [];
    }

    // Titles get normalised over and over while scoring - every candidate
    // against every title, several times per search. goja interprets, so the
    // regex work is worth doing once per distinct string.
    normalized: { [value: string]: string } = {};

    /** Lowercased, free of accents and punctuation, for comparing titles. */
    normalize(value): string {
        const cached = this.normalized[value];
        if (cached !== undefined) return cached;

        return (this.normalized[value] = this.normalizeUncached(value));
    }

    normalizeUncached(value): string {
        return value
            .toLowerCase()
            .replace(/[áàäâã]/g, "a")
            .replace(/[éèëê]/g, "e")
            .replace(/[íìïî]/g, "i")
            .replace(/[óòöôõ]/g, "o")
            .replace(/[úùüû]/g, "u")
            .replace(/ñ/g, "n")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\b(\d+)(?)\b/g, "$1")
            .trim();
    }

    /**
     * Share of the wanted title's words that the candidate contains.
     *
     * Deliberately asymmetric. Seasons of the same show differ only by a short
     * suffix on top of a long shared prefix, so any measure that divides by the
     * combined length (Dice, and Levenshtein for that matter) is swamped by the
     * prefix and rates the longest, most specific entry worst. Asking instead
     * how much of the wanted title made it into the candidate keeps the weight
     * on the words that actually tell the seasons apart.
     */
    similarity(candidate, wanted): number {
        const words = this.normalize(wanted).split(" ").filter(Boolean);
        const pool = this.normalize(candidate).split(" ").filter(Boolean);
        if (words.length === 0 || pool.length === 0) return 0;

        let hits = 0;

        for (const word of words) {
            const at = pool.indexOf(word);
            if (at !== -1) {
                hits++;
                pool.splice(at, 1);
            }
        }

        return hits / words.length;
    }

    /**
     * Coverage weighed against how much of the candidate is padding.
     *
     * Coverage alone never charges for extra words, so "... the Movie 4: You're
     * Next" covers "Boku no Hero Academia 4" in full and outranks the season
     * being looked for. Balancing it against the share of the candidate that
     * was actually asked for puts the padded entry back behind.
     */
    balancedScore(candidate, wanted): number {
        const recall = this.similarity(candidate, wanted);
        if (recall === 0) return 0;

        const precision = this.similarity(wanted, candidate);
        if (precision === 0) return 0;

        return (2 * recall * precision) / (recall + precision);
    }

    /**
     * Season number stated in a title, or 0 when it states none.
     *
     * Only counts seasons. "Part" is a different axis: "The Final Season Part 3"
     * is the fourth season, and reading a 3 out of it makes the genuine third
     * season look like the match.
     */
    seasonOrdinal(title): number {
        const text = this.normalize(title);

        const ordinal = text.match(/\b(\d+)(?)?\s+season\b/);
        if (ordinal) return parseInt(ordinal[1], 10);

        const trailing = text.match(/\bseason\s+(\d+)\b/);
        if (trailing) return parseInt(trailing[1], 10);

        const roman = text.match(/\s(v?i{1,3})$/);
        if (roman) {
            const map: { [key: string]: number } = { i, ii, iii, iv, v, vi: 6 };
            return map[roman[1]] || 0;
        }

        return 0;
    }

    /**
     * Seanime picks the candidate with the smallest Levenshtein distance and
     * applies no threshold, so a neighbouring season is a dangerous decoy: for
     * Honzuki no Gekokujou the synonym "... 4th Season" sits 3 edits from the
     * site's "... 3rd Season" but much further from the season's actual title,
     * and the wrong season wins. Drop candidates that name a different season;
     * anything that names none is kept, since the site often titles a season
     * by its subtitle instead.
     */
    dropOtherSeasons(results, titles): SearchResult[] {
        let wanted = 0;
        for (const title of titles) {
            const season = this.seasonOrdinal(title);
            if (season > wanted) wanted = season;
        }

        if (wanted === 0) return results;

        const kept = results.filter(r => {
            const season = this.seasonOrdinal(r.title);
            return season === 0 || season === wanted;
        });

        return kept.length > 0 ? kept : results;
    }

    /**
     * Levenshtein counts raw edits, so it rewards whichever catalog entry is
     * shortest rather than the one that matches: for Honzuki's fourth season
     * the synonym "... 4th Season" lands closer to the site's "... Recap" and
     * to the first season than to "... - Ryoushu no Youjo", the actual entry.
     * Word overlap does read that subtitle, so when one candidate clearly wins
     * on it we hand back only that one and Seanime has nothing to trip over.
     * A close second means we are not sure, and the full list goes back.
     */
    narrowToBest(results, titles): SearchResult[] {
        let best: SearchResult | null = null;
        let bestScore = 0;
        let runnerUp = 0;

        for (const result of results) {
            let score = 0;
            for (const title of titles) {
                const value = this.balancedScore(result.title, title);
                if (value > score) score = value;
            }

            if (score > bestScore) {
                runnerUp = bestScore;
                bestScore = score;
                best = result;
            } else if (score > runnerUp) {
                runnerUp = score;
            }
        }

        // Thresholds are for the balanced score, which runs lower than plain
        // coverage: a right-but-wordier entry sits around 0.57 while its
        // siblings sit near 0.33. Demand a real gap so ties stay with Seanime.
        if (best && bestScore >= 0.5 && bestScore - runnerUp >= 0.08) return [best];

        return results;
    }

    /**
     * Every title Seanime knows this anime by, minus the ones that cannot be
     * compared. Synonyms come in every script, and normalising a Thai or
     * Japanese title leaves only whatever digits it carried: "…ซีซั่น Part 3"
     * comes out as "part 3", which any entry with a part number covers in full
     * and scores a perfect match on. Keep the titles that are mostly latin.
     */
    mediaTitles(media?): string[] {
        if (!media) return [];

        return this.usableTitles([media.romajiTitle, media.englishTitle, ...(media.synonyms || [])]);
    }

    /**
     * The titles that name this entry, as opposed to the series around it.
     *
     * Scoring has to stay off the numbered synonyms. Honzuki's fourth season
     * carries "... Erandeiraremasen 4th Season", which shares its long prefix
     * with every entry in the series and therefore rates whichever of them is
     * shortest, the recap, above the season that actually goes by a subtitle.
     * Those synonyms still make good extra search queries.
     */
    primaryTitles(media?): string[] {
        if (!media) return [];

        return this.usableTitles([media.romajiTitle, media.englishTitle]);
    }

    usableTitles(titles: (string | undefined)[]): string[] {
        return titles.filter((title): title is string => {
            if (typeof title !== "string" || title.trim() === "") return false;

            const stripped = title.replace(/\s+/g, "");
            if (stripped.length === 0) return false;

            const latin = stripped.replace(/[^a-zA-Z0-9]/g, "").length;
            if (latin / stripped.length < 0.7) return false;

            // Keep single-word titles: plenty of shows are just "Jigokuraku".
            // What has to go is a title left with nothing but numbering, which
            // is what a foreign one decays into once its own script is gone.
            const words = this.normalize(title).split(" ").filter(Boolean);
            return words.some(w => w.length >= 3 && !GENERIC_WORDS[w]);
        });
    }

    bestScore(results, titles): number {
        let best = 0;

        for (const result of results) {
            for (const title of titles) {
                const score = this.similarity(result.title, title);
                if (score > best) best = score;
            }
        }

        return best;
    }

    /**
     * Seanime searches once per romaji title and once per english, and a miss
     * sends us back out with the remaining titles, so the same query comes up
     * repeatedly while one episode list is being built. The store outlives a
     * single call and is shared across this extension's VMs, so remember what
     * each query returned for a few minutes.
     */
    async searchOnce(query, isDub): Promise<SearchResult[]> {
        const key = `av1:search:${isDub ? "dub" : "sub"}:${this.normalize(query)}`;

        const cached = this.remember<SearchResult[]>(key);
        if (cached) return cached;

        const params = new URLSearchParams();
        params.append("page", "1");

        if (query && query.trim() !== "") params.append("search", query);

        const res = await this.fetchWithRetry(`${this.baseUrl}/catalogo/__data.json?${params.toString()}`);
        if (!res.ok) return [];

        const results = this._resolveRemixData(res.json(), isDub);
        this.keep(key, results);

        return results;
    }

    /** Reads a value stored less than SEARCH_CACHE_MS ago, if the store is there. */
    remember<T>(key): T | undefined {
        if (typeof $store === "undefined" || !$store) return undefined;

        try {
            // Compare against undefined: a cached false is still an answer.
            const hit = $store.get<{ at: number; value: T }>(key);
            if (hit && hit.value !== undefined && Date.now() - hit.at < SEARCH_CACHE_MS) return hit.value;
        } catch (err) {
            // A store that misbehaves must not take the search down with it.
        }

        return undefined;
    }

    keep(key, value): void {
        if (typeof $store === "undefined" || !$store) return;

        try {
            $store.set(key, { at: Date.now(), value });
        } catch (err) {
            // Not being able to cache is not a reason to fail.
        }
    }

    async search(opts): Promise<SearchResult[]> {
        const isDub = opts.dub || false;
        // Every title is fair game as a search query; only the primary ones
        // are trusted to say which entry we are looking at.
        const titles = this.mediaTitles(opts.media);
        const primary = this.primaryTitles(opts.media);

        // Overriding Seanime is for series, where the decoy is a neighbouring
        // season. Films number and romanise themselves however they like -
        // "Evangelion Shin Movie: Kyuu" is the same film as "Evangelion Movie
        // 3: Q" - and there is no season to reason about, so leave them alone.
        const narrow = (opts.media && opts.media.format || "").toUpperCase() !== "MOVIE";

        // Seanime searches the same anime twice, once per title, and merges the
        // two lists by id. animeav1 drops roughly one connection in six and a
        // dropped one hangs for a quarter of a minute before it gives up, so
        // the second search is mostly another chance to stall. Answer it from
        // what the first one worked out.
        const cacheKey = opts.media && opts.media.id
            ? `av1:media:${opts.media.id}:${isDub ? "dub" : "sub"}`
            : "";

        const cached = cacheKey ? this.remember<SearchResult[]>(cacheKey) : undefined;
        if (cached) return cached;

        try {
            const results = await this.searchOnce(opts.query, isDub);

            // The catalog is titled in romaji, so searching by english title
            // tends to return twenty unrelated entries. Seanime picks whichever
            // result sits closest and applies no threshold, so a list of noise
            // still resolves to some anime, silently the wrong one. When nothing
            // resembles what we are after, search again with the other titles.
            if (titles.length === 0) return results;

            if (this.bestScore(results, primary) >= 0.6) {
                const kept = this.dropOtherSeasons(results, titles);
                const picked = narrow ? this.narrowToBest(kept, primary) : kept;
                if (cacheKey) this.keep(cacheKey, picked);
                return picked;
            }

            const seen: { [id: string]: boolean } = {};
            const merged = [];

            for (const result of results) {
                if (seen[result.id]) continue;
                seen[result.id] = true;
                merged.push(result);
            }

            const tried = [this.normalize(opts.query)];

            for (const title of titles.slice(0, 3)) {
                const key = this.normalize(title);
                if (tried.indexOf(key) !== -1) continue;
                tried.push(key);

                const extra = await this.searchOnce(title, isDub);
                for (const result of extra) {
                    if (seen[result.id]) continue;
                    seen[result.id] = true;
                    merged.push(result);
                }

                if (this.bestScore(merged, primary) >= 0.6) break;
            }

            const kept = this.dropOtherSeasons(merged, titles);
            const picked = narrow ? this.narrowToBest(kept, primary) : kept;
            if (cacheKey) this.keep(cacheKey, picked);
            return picked;
        } catch (err) {
            console.error("Error searching AnimeAV1:", err);
            return [];
        }
    }

    async findEpisodes(id): Promise<EpisodeDetails[]> {
        let slug: string;
        let type = "sub";

        try {
            const parsed = JSON.parse(id);
            slug = parsed.slug;
            if (parsed.type) 
        } catch {
            slug = id;
        }

        const url = `${this.baseUrl}/media/${slug}/__data.json`;

        try {
            const res = await this.fetchWithRetry(url);
            if (!res.ok) throw new Error("Error fetching episodes");

            const json = res.json();
            const nodes = json.nodes || [];

            let data: any[] | null = null;
            let mediaDescriptor = null;

            for (const node of nodes) {
                if (!node?.data) continue;

                for (const obj of node.data) {
                    if (obj && typeof obj === "object" && "slug" in obj && "episodes" in obj) {
                        const slugPointer = obj.slug;
                        if (typeof slugPointer === "number" && node.data[slugPointer] === slug) {
                            data = node.data;
                            mediaDescriptor = obj;
                            break;
                        }
                    }
                }

                if (data) break;
            }

            if (!data || !mediaDescriptor) throw new Error("Anime no encontrado");

            const episodeIndexes = data[mediaDescriptor.episodes];
            if (!Array.isArray(episodeIndexes)) throw new Error("Lista inválida");

            const episodes = [];

            episodeIndexes.forEach((epIdx, i) => {
                const ep = data![epIdx];
                if (!ep) return;

                let number = i + 1;
                if (typeof ep.number === "number") {
                    const resolved = data![ep.number];
                    if (typeof resolved === "number") number = resolved;
                }

                if (!Number.isInteger(number) || number <= 0) return;

                let title = `Episodio ${number}`;
                if (typeof ep.title === "number") {
                    title = data![ep.title];
                } else if (ep.title) {
                    title = ep.title;
                }

                episodes.push({
                    id: JSON.stringify({ slug, number, 
            });

            // Sub is what the site always carries; a dub is the exception, and
            // the anime's own page never says which. Settle it here rather than
            // hand back a list whose every episode fails once Seanime asks for
            // an audio track that was never there. Where no dub exists the
            // episodes are handed back as sub, so the show still plays.
            if (

                return episodes.map(episode => ({
                    ...episode,
                    id: JSON.stringify({ slug, number: episode.number, type: "sub" }),
                }));
            }

            return episodes;
        } catch (err) {
            console.error("Error finding episodes:", err);
            return [];
        }
    }

    /**
     * MP4Upload leaves the direct mp4 in the embed HTML, unobfuscated.
     *
     * Seanime asks for every declared server before it hands back any source,
     * so this runs on the way to playing an episode even when HLS is the one
     * being watched. mp4upload answers in well under a second almost always,
     * but now and then it stops answering and holds the request for the 35s
     * fetch allows, which is felt as the episode taking 35s to start.
     *
     * Nothing here can shorten that one stall, so the point is to not pay it
     * twice: a stall is written down and mp4upload is passed over for the next
     * few minutes. Seanime keeps whichever servers did answer, so skipping it
     * costs the fallback and nothing else.
     */
    async extractMp4Upload(embedUrl): Promise<VideoSource | null> {
        if (this.remember<boolean>(MP4UPLOAD_DOWN_KEY)) return null;

        const started = Date.now();

        try {
            // No retries: when mp4upload stalls, each attempt costs 35s.
            const res = await this.fetchWithRetry(embedUrl, 0, MP4UPLOAD_HEADERS);

            if (Date.now() - started >= SLOW_HOST_MS) this.keep(MP4UPLOAD_DOWN_KEY, true);
            if (!res.ok) return null;

            const match = res.text().match(/src:\s*"([^"]+\.mp4[^"]*)"/);
            if (!match) return null;

            return {
                url,
                type: "mp4",
                quality: "auto",
                subtitles,
            };
        } catch (err) {
            this.keep(MP4UPLOAD_DOWN_KEY, true);
            return null;
        }
    }

    /**
     * An episode page's embeds table, with the array its indices point into.
     *
     * Seanime asks for one server at a time and every one of them needs this
     * same page, so fetching it once and keeping it briefly is the difference
     * between one request per episode and one per server.
     */
    async episodeEmbeds(slug, number): Promise<{ data: any[]; embeds: any } | null> {
        const key = `av1:ep:${slug}:${number}`;

        const cached = this.remember<{ data: any[]; embeds: any }>(key);
        if (cached) return cached;

        const res = await this.fetchWithRetry(`${this.baseUrl}/media/${slug}/${number}/__data.json`);
        if (!res.ok) return null;

        const json = res.json();

        for (const node of json?.nodes || []) {
            if (!node?.data) continue;

            const root = node.data.find(
                (item) => item && typeof item === "object" && "embeds" in item
            );

            if (root) {
                const found = { data: node.data, embeds: node.data[root.embeds] || {} };
                this.keep(key, found);
                return found;
            }
        }

        return null;
    }

    /**
     * Which audio an episode page carries, as the keys of its embeds object:
     * ["SUB"] on its own, or ["SUB", "DUB"] where a dub exists.
     */
    async audioTracks(slug, number): Promise<string[]> {
        const found = await this.episodeEmbeds(slug, number);
        return found ? Object.keys(found.embeds) : [];
    }

    /**
     * Whether this anime is dubbed at all.
     *
     * Nothing on the anime's own page says so - the two look alike whether a
     * dub exists or not - so it takes looking at an episode. Worth the one
     * request: without it Seanime lists every episode, then fails on each one
     * in turn as it asks for an audio track that was never there.
     */
    async hasDub(slug, number): Promise<boolean> {
        const key = `av1:dub:${slug}`;

        const cached = this.remember<boolean>(key);
        if (cached !== undefined) return cached;

        const dubbed = (await this.audioTracks(slug, number)).indexOf("DUB") !== -1;

        this.keep(key, dubbed);
        return dubbed;
    }

    async findEpisodeServer(episode, server): Promise<EpisodeServer> {
        // Seanime passes the whole EpisodeDetails, but accept a bare id too.
        const rawId = typeof episode === "string" ? episode : episode.id;

        let slug: string;
        let number: number;
        let type = "sub";

        try {
            const parsed = JSON.parse(rawId);
            slug = parsed.slug;
            number = parsed.number;
            if (parsed.type) 
        } catch {
            throw new Error("ID inválido");
        }

        try {
            const found = await this.episodeEmbeds(slug, number);
            if (!found) throw new Error("No se encontraron servidores");

            const data = found.data;
            const embeds = found.embeds;
            const category = type.toUpperCase();

            // A dub can also stop partway through a run, so fall back per
            // episode as well and play the sub rather than nothing.
            let listIndex = embeds[category];
            if (typeof listIndex !== "number" && category === "DUB") {
                listIndex = embeds["SUB"];
                if (typeof listIndex === "number") {
                    console.error(`AnimeAV1: ${slug} ${number} sin doblaje, se usa el sub`);
                }
            }

            if (typeof listIndex !== "number") throw new Error(`No hay contenido en ${category}`);

            const serverList = data[listIndex];
            if (!Array.isArray(serverList)) throw new Error("Lista vacía");

            const wanted = (server || "HLS").trim().toUpperCase();

            let embedUrl: string | null = null;
            let serverName: string | null = null;

            for (const ptr of serverList) {
                const entry = data[ptr];
                if (!entry) continue;

                const name = data[entry.server];
                const link = data[entry.url];
                if (!name || !link) continue;

                if (String(name).trim().toUpperCase() === wanted) {
                    embedUrl = link;
                    serverName = name;
                    break;
                }
            }

            if (!embedUrl || !serverName) {
                throw new Error(`No se encontró servidor ${server} para ${type}`);
            }

            let source: VideoSource | null = null;
            let headers: { [key: string]: string } = {};

            if (wanted === "HLS") {
                source = {
                    url: embedUrl.replace("/play/", "/m3u8/"),
                    type: "m3u8",
                    quality: "auto",
                    subtitles,
                };
                headers = HLS_HEADERS;
            } else if (wanted === "MP4UPLOAD") {
                source = await this.extractMp4Upload(embedUrl);
                headers = MP4UPLOAD_HEADERS;
            }

            if (!source) throw new Error(`No se pudo extraer el video de ${serverName}`);

            return {
                server,
                headers,
                videoSources,
            };
        } catch (err) {
            console.error("Error finding episode server:", err);
            throw err;
        }
    }
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "AnimeAV1", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "AnimeAV1", url, type: manifest.type }) });
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