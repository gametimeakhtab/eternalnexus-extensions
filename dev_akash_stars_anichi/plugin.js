(function() {
    var manifest = {"packageName":"com.eternalnexus.dev_akash_stars_anichi","name":"Anichi","version":1,"description":"Anichi (AllAnime) plugin for SkyStream. GraphQL-powered anime provider.","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://allmanga.to","type":"video","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};
(function() {
    /**
     * @type {import('@skystream/sdk').Manifest}
     */
    // manifest is injected at runtime

    // --- Constants ---
    const API_URL = "https://api.allanime.day/api";
    const API_ENDPOINT = "https://allanime.day";
    const HEADERS = {
        "app-version": "android_c-247",
        "from-app": "allmanga",
        "platformstr": "android_c",
        "Referer": "https://allmanga.to"
    };

    const HASHES = {
        main: "e42a4466d984b2c0a2cecae5dd13aa68867f634b16ee0f17b380047d14482406",
        popular: "60f50b84bb545fa25ee7f7c8c0adbf8f5cea40f7b1ef8501cbbff70e38589489",
        detail: "bb263f91e5bdd048c1c978f324613aeccdfe2cbc694a419466a31edb58c0cc0b",
        server: "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec",
        mainPage: "a24c500a1b765c68ae1d8dd85174931f661c71369c89b92b88b75a725afc471c",
        showsMetadata: "9de1b73e302fa5e471990ed8229c9ad330b3f82a92a288743fb67309520a1996"
    };


    // --- Helpers ---
    function encodeQueryParts(variables, hash) {
        return "variables=" + encodeURIComponent(JSON.stringify(variables || {}))
            + "&extensions=" + encodeURIComponent(JSON.stringify({
                persistedQuery: {
                    version: 1,
                    sha256Hash: hash
                }
            }));
    }

    async function queryGraph(variables, hash, method, silent) {
        const body = {
            variables: variables,
            extensions: {
                persistedQuery: {
                    version: 1,
                    sha256Hash: hash
                }
            }
        };
        
        const requestMethod = method || "GET";
        try {
            let res;
            if (requestMethod === "GET") {
                const url = API_URL + "?" + encodeQueryParts(variables, hash);
                res = await http_get(url, HEADERS);
            } else {
                try {
                    res = await http_post(API_URL, HEADERS, JSON.stringify(body));
                } catch (_) {
                    res = await http_post(API_URL, JSON.stringify(body), HEADERS);
                }
            }
            const bodyStr = res.body || "";
            if (res.status !== 200 || bodyStr.trim().startsWith("<")) {
               throw new Error("HTTP_BLOCK: Cloudflare or Network Error (HTML returned)");
            }
            return JSON.parse(bodyStr);
        } catch (e) {
            if (!silent) {
                console.error("GraphQL Error: " + e.message);
            }
            throw e;
        }
    }

    async function safeQueryGraph(variables, hash, method) {
        try {
            return await queryGraph(variables, hash, method, true);
        } catch (_) {
            return null;
        }
    }

    function hasEpisodes(edge) {
        const available = edge && edge.availableEpisodes;
        return !available || !(
            Number(available.raw || 0) === 0 &&
            Number(available.sub || 0) === 0 &&
            Number(available.dub || 0) === 0
        );
    }

    function preferredTitle(edge) {
        if (!edge) return "Unknown";
        return edge.englishName || edge.name || edge.nativeName || "Unknown";
    }

    function toMultimediaItem(edge) {
        if (!edge) return null;
        const posterUrl = edge.thumbnail?.startsWith("http") 
            ? edge.thumbnail 
            : edge.thumbnail ? `https://wp.youtube-anime.com/aln.youtube-anime.com/${edge.thumbnail}` : null;

        return new MultimediaItem({
            title: preferredTitle(edge),
            url: edge._id || edge.showId, 
            posterUrl: posterUrl,
            type: edge.type?.toLowerCase().includes("movie") ? "movie" : "anime",
            year: edge.airedStart?.year,
            description: edge.description?.replace(/<[^>]*>/g, ""),
            headers: HEADERS
        });
    }

    // --- Core Functions ---

    async function getHome(cb) {
        try {
            const now = new Date();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();
            const season = month <= 3 ? "Winter" : month <= 6 ? "Spring" : month <= 9 ? "Summer" : "Fall";
            const transType = getPreference("translation_type") || "sub";

            const categories = {
                "New Series": { search: { season, year }, translationType: transType, countryOrigin: "ALL" },
                "Latest Anime": { search: {}, translationType: transType, countryOrigin: "ALL" },
                "Latest Donghua": { search: {}, translationType: transType, countryOrigin: "CN" },
                "Movie": { search: { types: ["Movie"] }, translationType: transType, countryOrigin: "ALL" }
            };

            const homeData = {};
            const categoryEntries = Object.entries(categories);
            const sectionResults = await Promise.allSettled(categoryEntries.map(async function (entry) {
                const name = entry[0];
                const variables = entry[1];
                const res = await queryGraph({ ...variables, limit: 26, page: 1 }, HASHES.mainPage, "GET");
                const items = (res.data?.shows?.edges || []).filter(hasEpisodes).map(toMultimediaItem).filter(Boolean);
                return { name: name, items: items };
            }));

            sectionResults.forEach(function (result) {
                if (result.status !== "fulfilled") return;
                if (!result.value.items.length) return;
                homeData[result.value.name] = result.value.items;
            });

            const popularRes = await safeQueryGraph(
                { type: "anime", size: 30, dateRange: 1, page: 1, allowAdult: true, allowUnknown: false },
                HASHES.popular,
                "GET"
            );
            const popularItems = (popularRes?.data?.queryPopular?.recommendations || [])
                .map(function (r) { return toMultimediaItem(r.anyCard); })
                .filter(Boolean)
                .filter(hasEpisodes);
            if (popularItems.length > 0) homeData["Popular"] = popularItems;

            if (!Object.keys(homeData).length) {
                return cb({ success: false, errorCode: "HOME_ERROR", message: "No home sections available" });
            }
            cb({ success: true, data: homeData });
        } catch (e) {
            cb({ success: false, errorCode: "HOME_ERROR", message: e.message });
        }
    }

    async function search(query, cb) {
        try {
            const transType = getPreference("translation_type") || "sub";
            const variables = {
                search: { query: query },
                limit: 26,
                page: 1,
                translationType: transType,
                countryOrigin: "ALL"
            };

            const res = await queryGraph(variables, HASHES.mainPage, "GET");
            const items = (res.data?.shows?.edges || []).filter(hasEpisodes).map(toMultimediaItem).filter(Boolean);
            cb({ success: true, data: items });
        } catch (e) {
            cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
        }
    }

    async function getAniListMedia(title, year, season, type) {
        const query = `
        query ($search: String, $type: MediaType, $season: MediaSeason, $year: String, $format: [MediaFormat]) {
          Page(page: 1, perPage: 1) {
            media(search: $search, type: $type, season: $season, startDate_like: $year, format_in: $format) {
              id idMal bannerImage
              coverImage { extraLarge large medium }
              title { english romaji native }
              startDate { year }
              genres description averageScore status
              nextAiringEpisode { episode }
              recommendations { edges { node { id mediaRecommendation { id title { english romaji } coverImage { large } } } } }
            }
          }
        }`;
        
        const variables = {
            search: title,
            type: "ANIME",
            season: type?.toLowerCase() === "ona" ? undefined : season?.toUpperCase(),
            year: year ? `${year}%` : undefined,
            format: [type?.toUpperCase()]
        };

        const payload = JSON.stringify({ query, variables });
        let res;
        try {
            res = await http_post("https://graphql.anilist.co", { "Content-Type": "application/json" }, payload);
        } catch (_) {
            res = await http_post("https://graphql.anilist.co", payload, { "Content-Type": "application/json" });
        }
        const data = JSON.parse(res.body || "{}");
        return data.data?.Page?.media?.[0] || null;
    }

    async function getTmdbLogo(tmdbId, type) {
        if (!tmdbId) return null;
        const apiKey = "98ae14df2b8d8f8f8136499daf79f0e0";
        const url = `https://api.themoviedb.org/3/${type === "movie" ? "movie" : "tv"}/${tmdbId}/images?api_key=${apiKey}`;
        try {
            const res = await http_get(url);
            const data = JSON.parse(res.body);
            const logos = data.logos || [];
            if (logos.length === 0) return null;
            // Prefer English
            const logo = logos.find(l => l.iso_639_1 === "en") || logos[0];
            return `https://image.tmdb.org/t/p/w500${logo.file_path}`;
        } catch (e) {
            return null;
        }
    }

    async function getAniZipData(malId) {
        if (!malId) return null;
        try {
            const res = await http_get(`https://api.ani.zip/mappings?mal_id=${malId}`);
            return JSON.parse(res.body);
        } catch (e) {
            return null;
        }
    }

    async function getRelatedShows(showIds) {
        const ids = (showIds || []).filter(Boolean);
        if (!ids.length) return [];
        const batches = [];
        for (let i = 0; i < ids.length; i += 12) {
            batches.push(ids.slice(i, i + 12));
        }
        const results = await Promise.allSettled(batches.map(async function (batch) {
            const res = await safeQueryGraph({ showIds: batch }, HASHES.showsMetadata, "POST");
            if (!res) return [];
            return res.data?.showsMetadata || res.data?.shows || [];
        }));
        return results
            .filter(function (result) { return result.status === "fulfilled"; })
            .flatMap(function (result) { return result.value || []; });
    }

    async function load(url, cb) {
        try {
            const res = await queryGraph({ _id: url }, HASHES.detail, "GET");
            const show = res.data?.show;
            if (!show) return cb({ success: false, message: "Show not found" });

            const title = show.name || show.englishName || show.nativeName;
            const year = show.airedStart?.year;
            const season = show.season?.quarter;
            const type = show.type;

            // Fetch extra metadata in parallel
            const [primaryAniMedia, aniZip] = await Promise.all([
                getAniListMedia(title, year, season, type),
                show.idMal ? getAniZipData(show.idMal) : Promise.resolve(null)
            ]);
            const aniMedia = primaryAniMedia || await getAniListMedia(show.altNames?.[0], year, season, type);

            const tmdbId = aniZip?.mappings?.themoviedb_id;
            const logoUrl = await getTmdbLogo(tmdbId, show.type?.toLowerCase().includes("movie") ? "movie" : "tv");
            const resolvedTitle = aniZip?.titles?.en || show.englishName || aniMedia?.title?.english || title || preferredTitle(show);

            const episodes = (show.availableEpisodesDetail?.sub || []).map(epNum => {
                const aniEp = aniZip?.episodes?.[epNum];
                return new Episode({
                    name: aniEp?.title?.en || aniEp?.title?.ja || `Episode ${epNum}`,
                    url: JSON.stringify({ hash: show._id, dubStatus: "sub", episode: epNum, idMal: show.idMal }),
                    season: 1,
                    episode: parseInt(epNum),
                    description: aniEp?.overview || "No summary available",
                    posterUrl: aniEp?.image || toMultimediaItem(show).posterUrl,
                    runtime: aniEp?.runtime,
                    dubStatus: "sub",
                    headers: HEADERS
                });
            });

            const dubEpisodes = (show.availableEpisodesDetail?.dub || []).map(epNum => {
                const aniEp = aniZip?.episodes?.[epNum];
                return new Episode({
                    name: aniEp?.title?.en || aniEp?.title?.ja || `Episode ${epNum} (Dub)`,
                    url: JSON.stringify({ hash: show._id, dubStatus: "dub", episode: epNum, idMal: show.idMal }),
                    season: 1,
                    episode: parseInt(epNum),
                    description: aniEp?.overview || "No summary available",
                    posterUrl: aniEp?.image || toMultimediaItem(show).posterUrl,
                    runtime: aniEp?.runtime,
                    dubStatus: "dub",
                    headers: HEADERS
                });
            });

            // Resolve recommendations metadata
            const relatedIds = (show.relatedShows || []).map(r => r.showId).filter(id => id);
            const metaShows = await getRelatedShows(relatedIds);
            const recommendations = metaShows.map(toMultimediaItem).filter(function (item) { return item; });

            const result = new MultimediaItem({
                title: resolvedTitle,
                url: url,
                posterUrl: toMultimediaItem(show).posterUrl,
                bannerUrl: aniMedia?.bannerImage || show.banner,
                logoUrl: logoUrl,
                type: show.type?.toLowerCase().includes("movie") ? "movie" : "anime",
                description: show.description?.replace(/<[^>]*>/g, ""),
                year: year,
                score: show.averageScore / 10,
                status: show.status?.toLowerCase() === "releasing" ? "ongoing" : "completed",
                genres: show.genres,
                tags: show.tags,
                contentRating: show.rating,
                duration: show.episodeDuration ? Math.floor(show.episodeDuration / 60000) : undefined,
                cast: (show.characters || []).map(c => new Actor({
                    name: c.name?.full || c.name?.native,
                    role: c.role,
                    image: c.image?.large || c.image?.medium
                })),
                trailers: (show.prevideos || []).filter(v => v).map(v => new Trailer({
                    name: "Trailer",
                    url: `https://www.youtube.com/watch?v=${v}`
                })),
                episodes: episodes,
                recommendations: recommendations,
                headers: HEADERS
            });

            // If we have DUB episodes, we might want to expose them. 
            // In SkyStream, we usually combine them or let user choose.
            // For now, let's just use SUB episodes as default but store both in manifest if needed.
            // Actually, the app logic handles sub/dub via the url payload we created.
            if (dubEpisodes.length > 0) {
                // We add dub episodes to the end or interleaved?
                // Standard: the provider handles it.
                result.episodes = episodes.concat(dubEpisodes);
            }

            cb({ success: true, data: result });
        } catch (e) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
        }
    }

    function decryptHex(hex) {
        if (!hex) return "";
        let cleanHex = hex;
        if (cleanHex.startsWith("--")) cleanHex = cleanHex.slice(2);
        if (cleanHex.startsWith("-")) cleanHex = cleanHex.split("-").pop();
        let str = "";
        for (let i = 0; i < cleanHex.length; i += 2) {
            const byte = parseInt(cleanHex.substring(i, i + 2), 16);
            str += String.fromCharCode(byte ^ 56);
        }
        return str;
    }

    function getHostName(url) {
        try {
            const host = new URL(url.startsWith("//") ? ("https:" + url) : url).hostname;
            const parts = host.split(".");
            return parts.length >= 2 ? parts[parts.length - 2] : host;
        } catch (_) {
            return "source";
        }
    }

    function qualityFromText(text) {
        const value = String(text || "").toLowerCase();
        if (/(^|[^0-9])2160p([^0-9]|$)|(^|[^a-z0-9])4k([^a-z0-9]|$)|(^|[^a-z0-9])uhd([^a-z0-9]|$)/.test(value)) return 2160;
        if (/(^|[^0-9])1440p([^0-9]|$)|(^|[^a-z0-9])2k([^a-z0-9]|$)/.test(value)) return 1440;
        if (/(^|[^0-9])1080p([^0-9]|$)|(^|[^a-z0-9])fhd([^a-z0-9]|$)/.test(value)) return 1080;
        if (/(^|[^0-9])720p([^0-9]|$)|(^|[^a-z0-9])hd([^a-z0-9]|$)/.test(value)) return 720;
        if (/(^|[^0-9])480p([^0-9]|$)|(^|[^a-z0-9])sd([^a-z0-9]|$)/.test(value)) return 480;
        if (/(^|[^0-9])360p([^0-9]|$)/.test(value)) return 360;
        if (/sub/.test(value)) return 720;
        return undefined;
    }

    function attachSubtitles(stream, subtitles) {
        if (!subtitles || !subtitles.length) return stream;
        stream.subtitles = subtitles;
        return stream;
    }

    function buildSubtitleList(subtitles) {
        return (subtitles || []).map(function (sub) {
            const url = sub.src || sub.url;
            return {
                name: sub.lang || sub.label || "Unknown",
                url: url && url.startsWith("//") ? ("https:" + url) : url
            };
        }).filter(function (item) { return item.url; });
    }

    function mergeSubtitleLists() {
        const merged = [];
        const seen = new Set();
        for (let i = 0; i < arguments.length; i += 1) {
            const list = arguments[i] || [];
            list.forEach(function (item) {
                if (!item || !item.url) return;
                const key = `${item.name || ""}|${item.url}`;
                if (seen.has(key)) return;
                seen.add(key);
                merged.push(item);
            });
        }
        return merged;
    }

    function decodeEscapedString(value) {
        if (!value) return value;
        return String(value)
            .replace(/\\u0026/g, "&")
            .replace(/\\\//g, "/")
            .replace(/\\"/g, "\"")
            .replace(/\\\\/g, "\\");
    }

    function findMediaUrlsInHtml(html) {
        const text = String(html || "");
        const results = [];
        const patterns = [
            /https?:\/\/[^"'\\\s]+\.(?:m3u8|mp4|mpd)(?:$|[?#/][^"'\\\s]*)/gi
        ];
        patterns.forEach(function (pattern) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                results.push(decodeEscapedString(match[0]));
            }
        });

        const okMeta = text.match(/data-options="([^"]+)"/i);
        if (okMeta) {
            try {
                const decoded = decodeEscapedString(okMeta[1].replace(/&quot;/g, "\""));
                const hlsMatch = decoded.match(/"hlsMasterPlaylistUrl":"([^"]+)"/);
                if (hlsMatch) results.push(decodeEscapedString(hlsMatch[1]));
                const dashMatch = decoded.match(/"metadataEmbedded":"([^"]+)"/);
                if (dashMatch) {
                    const embedded = JSON.parse(decodeURIComponent(dashMatch[1]));
                    const hls = embedded?.hlsMasterPlaylistUrl;
                    const dash = embedded?.metadata?.hlsMasterPlaylistUrl;
                    if (hls) results.push(hls);
                    if (dash) results.push(dash);
                }
            } catch (_) {}
        }

        return Array.from(new Set(results.filter(Boolean)));
    }

    function normalizeSourceUrl(rawUrl, sourceName) {
        if (!rawUrl) return null;
        let url = String(rawUrl).replace(/ /g, "%20");
        if (sourceName === "Ak" || url.includes("/player/vitemb")) {
            try {
                const payload = url.split("=").pop();
                const decoded = JSON.parse(atob(payload));
                url = decoded.idUrl || url;
            } catch (_) {}
        }
        return url;
    }

    function isBuiltinExtractorHost(url) {
        return /dood|filemoon|hubcloud|mixdrop|streamtape|voe/i.test(String(url || ""));
    }

    async function tryBuiltinExtractor(url, sourceName, subtitles, streamResults) {
        if (!url || !isBuiltinExtractorHost(url) || typeof globalThis.loadExtractor !== "function") return false;
        const before = streamResults.length;
        try {
            await globalThis.loadExtractor(url, function (stream) {
                streamResults.push(attachSubtitles(stream, subtitles));
            });
        } catch (_) {
            return false;
        }
        if (streamResults.length > before) {
            for (let i = before; i < streamResults.length; i += 1) {
                if (!streamResults[i].source && sourceName) {
                    streamResults[i].source = `AllAnime - ${sourceName}`;
                }
            }
        }
        return streamResults.length > before;
    }

    function resolveUrl(baseUrl, nextUrl) {
        try {
            return new URL(nextUrl, baseUrl).toString();
        } catch (_) {
            return nextUrl;
        }
    }

    function getBaseUrl(url) {
        try {
            const parsed = new URL(url);
            return `${parsed.protocol}//${parsed.host}`;
        } catch (_) {
            return "";
        }
    }

    function getCodeFromUrl(url) {
        try {
            const parsed = new URL(url);
            const path = parsed.pathname || "";
            return path.replace(/\/+$/, "").split("/").pop() || "";
        } catch (_) {
            return "";
        }
    }

    function binaryToBytes(binary) {
        const out = new Uint8Array(String(binary || "").length);
        for (let i = 0; i < out.length; i += 1) out[i] = binary.charCodeAt(i) & 255;
        return out;
    }

    function getNodeCrypto() {
        try {
            if (typeof require === "function") return require("crypto");
        } catch (_) {}
        return null;
    }

    function hexToBytes(hex) {
        const clean = String(hex || "").replace(/[^a-fA-F0-9]/g, "");
        const out = new Uint8Array(Math.floor(clean.length / 2));
        for (let i = 0; i < out.length; i += 1) {
            out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) & 255;
        }
        return out;
    }

    function bytesToUtf8(bytes) {
        const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
        if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(view);
        let out = "";
        for (let i = 0; i < view.length; i += 1) out += String.fromCharCode(view[i]);
        try { return decodeURIComponent(escape(out)); } catch (_) { return out; }
    }

    function base64UrlDecodeToBytes(text) {
        const fixed = String(text || "").replace(/-/g, "+").replace(/_/g, "/");
        const pad = (4 - (fixed.length % 4)) % 4;
        return binaryToBytes(atob(fixed + "=".repeat(pad)));
    }

    function concatBytes(parts) {
        let total = 0;
        for (let i = 0; i < parts.length; i += 1) total += (parts[i] || []).length || 0;
        const out = new Uint8Array(total);
        let offset = 0;
        for (let i = 0; i < parts.length; i += 1) {
            const value = parts[i] instanceof Uint8Array ? parts[i] : new Uint8Array(parts[i] || []);
            out.set(value, offset);
            offset += value.length;
        }
        return out;
    }

    async function decryptAesCbcHex(cipherHex, keyText, ivText) {
        const cipherBytes = hexToBytes(cipherHex);
        const keyBytes = binaryToBytes(String(keyText || ""));
        const ivBytes = binaryToBytes(String(ivText || ""));
        if (globalThis.crypto && typeof globalThis.crypto.decryptAES === "function" && typeof btoa === "function") {
            try {
                const viaBridge = await globalThis.crypto.decryptAES(cipherHex, btoa(String(keyText || "")), btoa(String(ivText || "")));
                if (viaBridge) return String(viaBridge).replace(/[\u0000-\u001f]+$/g, "");
            } catch (_) {}
        }
        if (globalThis.crypto && globalThis.crypto.subtle && typeof globalThis.crypto.subtle.importKey === "function") {
            const imported = await globalThis.crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["decrypt"]);
            const plain = await globalThis.crypto.subtle.decrypt({ name: "AES-CBC", iv: ivBytes }, imported, cipherBytes);
            return bytesToUtf8(new Uint8Array(plain)).replace(/[\u0000-\u001f]+$/g, "");
        }
        const nodeCrypto = getNodeCrypto();
        if (nodeCrypto && typeof nodeCrypto.createDecipheriv === "function" && typeof Buffer !== "undefined") {
            const decipher = nodeCrypto.createDecipheriv("aes-128-cbc", Buffer.from(keyBytes), Buffer.from(ivBytes));
            let out = decipher.update(Buffer.from(cipherBytes));
            out = Buffer.concat([out, decipher.final()]);
            return out.toString("utf8").replace(/[\u0000-\u001f]+$/g, "");
        }
        throw new Error("AES-CBC unavailable");
    }

    async function decryptAesGcm(cipherBytes, keyBytes, ivBytes) {
        if (globalThis.crypto && globalThis.crypto.subtle && typeof globalThis.crypto.subtle.importKey === "function") {
            const imported = await globalThis.crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
            const plain = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes, tagLength: 128 }, imported, cipherBytes);
            return new Uint8Array(plain);
        }
        const nodeCrypto = getNodeCrypto();
        if (nodeCrypto && typeof nodeCrypto.createDecipheriv === "function" && typeof Buffer !== "undefined") {
            const view = cipherBytes instanceof Uint8Array ? cipherBytes : new Uint8Array(cipherBytes || []);
            const tagBytes = view.slice(view.length - 16);
            const payloadBytes = view.slice(0, view.length - 16);
            const decipher = nodeCrypto.createDecipheriv("aes-256-gcm", Buffer.from(keyBytes), Buffer.from(ivBytes));
            decipher.setAuthTag(Buffer.from(tagBytes));
            let out = decipher.update(Buffer.from(payloadBytes));
            out = Buffer.concat([out, decipher.final()]);
            return new Uint8Array(out);
        }
        throw new Error("AES-GCM unavailable");
    }

    function parseSubtitleObjectFromJsonText(text) {
        const subtitles = [];
        const section = String(text || "").match(/"subtitle"\s*:\s*\{(.*?)\}/);
        if (!section) return subtitles;
        const pattern = /"([^"]+)":\s*"([^"]+)"/g;
        let match;
        while ((match = pattern.exec(section[1])) !== null) {
            const lang = match[1];
            const rawPath = match[2].split("#")[0].replace(/\\\//g, "/");
            if (!rawPath) continue;
            const base = rawPath.startsWith("http") ? "" : "https://allanime.uns.bio";
            subtitles.push({ name: lang, url: base + rawPath });
        }
        return subtitles;
    }

    async function expandM3u8Streams(m3u8Url, sourceName, referer, subtitles, streamResults) {
        try {
            const headers = referer ? { ...HEADERS, "Referer": referer } : HEADERS;
            const res = await withTimeout(http_get(m3u8Url, headers), 3000, null);
            const body = res && res.body ? String(res.body) : "";
            if (!body || !/#EXTM3U/i.test(body)) {
                streamResults.push(attachSubtitles(new StreamResult({
                    url: m3u8Url,
                    source: sourceName,
                    quality: qualityFromText(m3u8Url) || qualityFromText(sourceName),
                    headers: headers
                }), subtitles));
                return;
            }
            const lines = body.split(/\r?\n/);
            let added = 0;
            for (let i = 0; i < lines.length; i += 1) {
                const line = lines[i];
                if (!/^#EXT-X-STREAM-INF:/i.test(line)) continue;
                const nextLine = (lines[i + 1] || "").trim();
                if (!nextLine || nextLine.startsWith("#")) continue;
                const resMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
                const quality = resMatch ? parseInt(resMatch[1], 10) : (qualityFromText(line) || qualityFromText(nextLine));
                streamResults.push(attachSubtitles(new StreamResult({
                    url: resolveUrl(m3u8Url, nextLine),
                    source: sourceName,
                    quality: quality,
                    headers: headers
                }), subtitles));
                added += 1;
            }
            if (!added) {
                streamResults.push(attachSubtitles(new StreamResult({
                    url: m3u8Url,
                    source: sourceName,
                    quality: qualityFromText(m3u8Url) || qualityFromText(sourceName),
                    headers: headers
                }), subtitles));
            }
        } catch (_) {
            streamResults.push(attachSubtitles(new StreamResult({
                url: m3u8Url,
                source: sourceName,
                quality: qualityFromText(m3u8Url) || qualityFromText(sourceName),
                headers: referer ? { ...HEADERS, "Referer": referer } : HEADERS
            }), subtitles));
        }
    }

    function extractPlayerScript(html) {
        const text = String(html || "");
        if (typeof getAndUnpack === "function" && /function\(p,a,c,k,e,d\)/.test(text)) {
            try {
                const unpacked = getAndUnpack(text);
                if (unpacked) return unpacked;
            } catch (_) {}
        }
        const scriptBlocks = Array.from(text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)).map(function (m) { return m[1] || ""; });
        for (let i = 0; i < scriptBlocks.length; i += 1) {
            const block = scriptBlocks[i];
            if (block.includes('jwplayer("vplayer").setup(') || /sources\s*:/.test(block)) return block;
        }
        return "";
    }

    async function resolveVidStackLike(url, sourceName, subtitles, streamResults) {
        try {
            const headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0"
            };
            const hash = String(url).substring(String(url).lastIndexOf("#") + 1).replace(/^\//, "");
            if (!hash) return false;
            const baseUrl = getBaseUrl(url);
            const encodedRes = await withTimeout(http_get(`${baseUrl}/api/v1/video?id=${hash}`, headers), 4000, null);
            if (!encodedRes || !encodedRes.body) return false;
            const ivList = ["1234567890oiuytr", "0123456789abcdef"];
            let decryptedText = null;
            for (let i = 0; i < ivList.length; i += 1) {
                try {
                    decryptedText = await decryptAesCbcHex(String(encodedRes.body).trim(), "kiemtienmua911ca", ivList[i]);
                    if (decryptedText) break;
                } catch (_) {}
            }
            if (!decryptedText) return false;
            const sourceMatch = decryptedText.match(/"source":"(.*?)"/);
            const m3u8 = sourceMatch ? sourceMatch[1].replace(/\\\//g, "/") : "";
            if (!m3u8) return false;
            const mergedSubs = mergeSubtitleLists(subtitles, parseSubtitleObjectFromJsonText(decryptedText));
            await expandM3u8Streams(m3u8, sourceName || "Vidstack", url, mergedSubs, streamResults);
            return true;
        } catch (_) {
            return false;
        }
    }

    async function resolveByseLike(url, sourceName, subtitles, streamResults) {
        try {
            const base = getBaseUrl(url);
            const code = getCodeFromUrl(url);
            if (!base || !code) return false;
            const detailsRes = await withTimeout(http_get(`${base}/api/videos/${code}/embed/details`, HEADERS), 4000, null);
            if (!detailsRes || !detailsRes.body) return false;
            const details = JSON.parse(detailsRes.body || "{}");
            const embedFrameUrl = details.embed_frame_url || details.embedFrameUrl;
            if (!embedFrameUrl) return false;
            const embedBase = getBaseUrl(embedFrameUrl);
            const embedCode = getCodeFromUrl(embedFrameUrl);
            if (!embedBase || !embedCode) return false;
            const playbackUrl = `${embedBase}/api/videos/${embedCode}/embed/playback`;
            const getHeaders = {
                "accept": "*/*",
                "accept-language": "en-US,en;q=0.5",
                "priority": "u=1, i",
                "referer": embedFrameUrl,
                "x-embed-parent": embedFrameUrl
            };
            const postHeaders = {
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.9",
                "Content-Type": "application/json",
                "Referer": embedFrameUrl,
                "X-Embed-Parent": url,
                "Priority": "u=4"
            };
            let playbackRes = await withTimeout(http_get(playbackUrl, getHeaders), 4000, null);
            let playbackRoot = null;
            if (playbackRes && playbackRes.status === 200 && playbackRes.body) {
                playbackRoot = JSON.parse(playbackRes.body || "{}");
            } else {
                let postRes;
                try {
                    postRes = await withTimeout(http_post(playbackUrl, postHeaders, JSON.stringify({ fingerprint: {} })), 4000, null);
                } catch (_) {
                    postRes = await withTimeout(http_post(playbackUrl, JSON.stringify({ fingerprint: {} }), postHeaders), 4000, null);
                }
                if (postRes && postRes.body) playbackRoot = JSON.parse(postRes.body || "{}");
            }
            const playback = playbackRoot && playbackRoot.playback;
            if (!playback || !playback.iv || !playback.payload || !playback.key_parts) return false;
            const keyBytes = concatBytes([
                base64UrlDecodeToBytes(playback.key_parts[0]),
                base64UrlDecodeToBytes(playback.key_parts[1])
            ]);
            const ivBytes = base64UrlDecodeToBytes(playback.iv);
            const cipherBytes = base64UrlDecodeToBytes(playback.payload);
            const plainBytes = await decryptAesGcm(cipherBytes, keyBytes, ivBytes);
            let jsonStr = bytesToUtf8(plainBytes);
            if (jsonStr.charCodeAt(0) === 0xFEFF) jsonStr = jsonStr.slice(1);
            const root = JSON.parse(jsonStr || "{}");
            const streamUrl = root && root.sources && root.sources[0] && root.sources[0].url;
            if (!streamUrl) return false;
            await expandM3u8Streams(streamUrl, sourceName || "Bysekoze", base, subtitles, streamResults);
            return true;
        } catch (_) {
            return false;
        }
    }

    async function resolveStreamWishLike(url, sourceName, subtitles, streamResults) {
        try {
            const mainUrl = getBaseUrl(url);
            const headers = {
                "Accept": "*/*",
                "Connection": "keep-alive",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "cross-site",
                "Referer": `${mainUrl}/`,
                "Origin": `${mainUrl}/`,
                "User-Agent": "Mozilla/5.0"
            };
            let resolvedUrl = url;
            if (/\/f\//.test(url)) resolvedUrl = `${mainUrl}/${url.substring(url.indexOf("/f/") + 3)}`;
            else if (/\/e\//.test(url)) resolvedUrl = `${mainUrl}/${url.substring(url.indexOf("/e/") + 3)}`;
            const pageRes = await withTimeout(http_get(resolvedUrl, referer ? { ...headers, "Referer": referer } : headers), 4000, null);
            if (!pageRes || !pageRes.body) return false;
            const playerScript = extractPlayerScript(pageRes.body);
            let m3u8 = null;
            if (playerScript) {
                const fileMatch = playerScript.match(/file:\s*"([^"]*m3u8[^"]*)"/i) || playerScript.match(/sources:\s*\[\{file:"([^"]+)"/i);
                if (fileMatch) m3u8 = fileMatch[1];
            }
            if (!m3u8) {
                const urls = findMediaUrlsInHtml(pageRes.body).filter(function (candidate) { return /\.m3u8/i.test(candidate); });
                m3u8 = urls[0];
            }
            if (!m3u8) return false;
            await expandM3u8Streams(m3u8, sourceName || "StreamWish", mainUrl, subtitles, streamResults);
            return true;
        } catch (_) {
            return false;
        }
    }

    async function resolveFilemoonV2Like(url, sourceName, subtitles, streamResults) {
        try {
            const headers = {
                "Referer": url,
                "Sec-Fetch-Dest": "iframe",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "cross-site",
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0"
            };
            const pageRes = await withTimeout(http_get(url, headers), 4000, null);
            if (!pageRes || !pageRes.body) return false;
            let href = "";
            if (typeof parse_html === "function") {
                try {
                    const iframeRows = await parse_html(String(pageRes.body), "iframe", "src");
                    href = iframeRows && iframeRows[0] && (iframeRows[0].attr || iframeRows[0].src || iframeRows[0].href || "");
                } catch (_) {}
            }
            if (!href) {
                const iframeMatch = String(pageRes.body).match(/<iframe[^>]+src=["']([^"']+)["']/i);
                href = iframeMatch ? iframeMatch[1] : "";
            }
            href = href ? resolveUrl(url, href) : "";
            if (!href) return false;
            const iframeRes = await withTimeout(http_get(href, {
                "Accept-Language": "en-US,en;q=0.5",
                "sec-fetch-dest": "iframe"
            }), 4000, null);
            if (!iframeRes || !iframeRes.body) return false;
            const scriptContent = extractPlayerScript(iframeRes.body);
            let m3u8 = null;
            if (scriptContent) {
                const match = scriptContent.match(/sources:\s*\[\{file:"(.*?)"/i);
                if (match) m3u8 = match[1];
            }
            if (!m3u8) {
                const urls = findMediaUrlsInHtml(iframeRes.body).filter(function (candidate) { return /\.m3u8/i.test(candidate); });
                m3u8 = urls[0];
            }
            if (!m3u8) return false;
            await expandM3u8Streams(m3u8, sourceName || "Filemoon", getBaseUrl(url), subtitles, streamResults);
            return true;
        } catch (_) {
            return false;
        }
    }

    async function withTimeout(promise, ms, fallback) {
        let timer;
        const timeoutPromise = new Promise(function (resolve) {
            timer = setTimeout(function () {
                resolve(fallback);
            }, ms);
        });
        try {
            return await Promise.race([promise, timeoutPromise]);
        } finally {
            clearTimeout(timer);
        }
    }

    function toAbsoluteUrl(url) {
        if (!url) return null;
        if (url.startsWith("//")) return "https:" + url;
        if (/^https?:\/\//i.test(url)) return url;
        try {
            if (url.includes(".json?")) return API_ENDPOINT + url;
            const queryIndex = url.indexOf("?");
            if (queryIndex === -1) return new URL(url, API_ENDPOINT).toString();
            const path = url.substring(0, queryIndex);
            const query = url.substring(queryIndex + 1);
            return new URL(path + ".json?" + query, API_ENDPOINT).toString();
        } catch (_) {
            return null;
        }
    }

    async function resolveServerRedirect(url) {
        if (!url || !/streamsb\.net/i.test(url)) return url;
        try {
            const res = await http_get(url, HEADERS);
            const match = (res.body || "").match(/window\.location\.replace\('([^']+)'\)/);
            return match ? match[1] : url;
        } catch (_) {
            return url;
        }
    }

    async function resolveEmbeddedSource(url, sourceName, subtitles, streamResults) {
        try {
            if (/allanime\.uns\.bio|server1\.uns\.bio/i.test(String(url || ""))) {
                return await resolveVidStackLike(url, sourceName || "Allanimeups", subtitles, streamResults);
            }
            if (/bysekoze\.com|byse\.sx/i.test(String(url || ""))) {
                return await resolveByseLike(url, sourceName || "Bysekoze", subtitles, streamResults);
            }
            if (/swiftplayers\.com|streamwish|mwish|dwish|embedwish|wishembed|kswplayer|wishfast|strwish|flaswish|awish|obeywish|jodwish|swhoi|multimovies|uqloads|cdnwish|asnwish|nekowish|wishonly|playerwish|streamhls|hlswish/i.test(String(url || ""))) {
                return await resolveStreamWishLike(url, sourceName || "StreamWish", subtitles, streamResults);
            }
            if (/filemoon/i.test(String(url || ""))) {
                return await resolveFilemoonV2Like(url, sourceName || "Filemoon", subtitles, streamResults);
            }
            const shouldProbe = /vidstreaming|mp4upload|ok\.ru|streamsb/i.test(String(url || ""));
            if (!shouldProbe) return false;
            const res = await withTimeout(http_get(url, {
                ...HEADERS,
                "Referer": "https://allmanga.to/"
            }), 2500, null);
            if (!res || !res.body) return false;
            const mediaUrls = findMediaUrlsInHtml(res.body);
            if (!mediaUrls.length) return false;
            mediaUrls.forEach(function (mediaUrl) {
                const stream = new StreamResult({
                    url: mediaUrl,
                    source: `AllAnime - ${sourceName || getHostName(url)}`,
                    quality: qualityFromText(mediaUrl) || qualityFromText(sourceName),
                    headers: {
                        ...HEADERS,
                        "Referer": url
                    }
                });
                streamResults.push(attachSubtitles(stream, subtitles));
            });
            return true;
        } catch (_) {
            return false;
        }
    }

    async function resolveSourceEntries(source, streamResults) {
        let rawLink = source.sourceUrl;
        if (!rawLink) return;
        const sourceSubtitles = buildSubtitleList(source?.subtitles);

        let link = String(rawLink).startsWith("--") || String(rawLink).startsWith("-")
            ? decryptHex(rawLink)
            : rawLink;
        link = normalizeSourceUrl(link, source.sourceName);
        if (!link) return;

        if (!/^https?:\/\//i.test(link) && !link.startsWith("//")) {
            const fixedLink = toAbsoluteUrl(link);
            if (!fixedLink) return;
            try {
                const jsonRes = await withTimeout(http_get(fixedLink, HEADERS), 2500, null);
                if (!jsonRes || !jsonRes.body) return;
                const videoData = JSON.parse(jsonRes.body || "{}");
                const links = videoData.links || [];
                const subtitles = mergeSubtitleLists(sourceSubtitles, buildSubtitleList(videoData.subtitles));
                for (let i = 0; i < links.length; i += 1) {
                    const l = links[i];
                    if (!l || !l.link) continue;
                    const host = getHostName(l.link);
                    const referer = l.headers?.referer;
                    const endpoint = /^https?:\/\//i.test(l.link)
                        ? l.link
                        : `${API_ENDPOINT}/player?uri=${l.link}`;
                    const serverSubtitles = mergeSubtitleLists(subtitles, buildSubtitleList(l.subtitles));
                    const customLoadedEarly = await resolveEmbeddedSource(l.link, source.sourceName || host, serverSubtitles, streamResults);
                    if (customLoadedEarly) continue;
                    if (String(source.sourceName || "").includes("Default") &&
                        (l.resolutionStr === "SUB" || l.resolutionStr === "Alt vo_SUB")) {
                        await expandM3u8Streams(l.link, `AllAnime - ${source.sourceName}`, "https://static.crunchyroll.com/", serverSubtitles, streamResults);
                        continue;
                    }
                    if (String(source.sourceName || "").includes("Uns")) {
                        const builtInLoaded = await tryBuiltinExtractor(l.link, source.sourceName || host, serverSubtitles, streamResults);
                        if (builtInLoaded) continue;
                    }
                    if (l.hls === null || typeof l.hls === "undefined") {
                        const builtInLoaded = await tryBuiltinExtractor(l.link, source.sourceName || host, serverSubtitles, streamResults);
                        if (builtInLoaded) continue;
                        streamResults.push(attachSubtitles(new StreamResult({
                            url: l.link,
                            source: `AllAnime ${host} ${source.sourceName || ""}`.trim(),
                            quality: qualityFromText(l.resolutionStr) || qualityFromText(l.link) || 1080,
                            headers: referer ? { ...HEADERS, "Referer": referer } : HEADERS
                        }), serverSubtitles));
                        continue;
                    }
                    if (l.hls === true) {
                        await expandM3u8Streams(l.link, `AllAnime - ${host}`, referer || endpoint, serverSubtitles, streamResults);
                        continue;
                    }
                }
            } catch (_) {}
        } else {
            const fixed = link.startsWith("//") ? ("https:" + link) : link;
            const finalUrl = await resolveServerRedirect(fixed);
            const builtInLoaded = await tryBuiltinExtractor(finalUrl, source.sourceName || getHostName(finalUrl), sourceSubtitles, streamResults);
            if (builtInLoaded) return;
            const extracted = await resolveEmbeddedSource(finalUrl, source.sourceName || getHostName(finalUrl), sourceSubtitles, streamResults);
            if (!extracted) {
                streamResults.push(attachSubtitles(new StreamResult({
                    url: finalUrl,
                    source: `AllAnime - ${source.sourceName || getHostName(finalUrl)}`,
                    quality: qualityFromText(source.sourceName) || qualityFromText(finalUrl),
                    headers: HEADERS
                }), sourceSubtitles));
            }
        }

        const downloadUrl = source.downloads?.downloadUrl;
        if (downloadUrl && /^https?:\/\//i.test(downloadUrl)) {
            const downloadId = downloadUrl.includes("id=") ? downloadUrl.substring(downloadUrl.indexOf("id=") + 3) : "";
            if (!downloadId) return;
            try {
                const clockRes = await withTimeout(http_get(`https://allanime.day/apivtwo/clock.json?id=${downloadId}`, HEADERS), 2500, null);
                if (!clockRes || !clockRes.body) return;
                const clockData = JSON.parse(clockRes.body || "{}");
                (clockData.links || []).forEach(function (item) {
                    if (!item.link) return;
                    streamResults.push(new StreamResult({
                        url: item.link,
                        source: `AllAnime [${String(source.downloads?.dubStatus || "").toUpperCase() || "SUB"}] [${String(source.downloads?.sourceName || source.sourceName || "Download")}]`,
                        quality: qualityFromText(item.link) || qualityFromText(source.downloads?.sourceName) || 1080,
                        headers: HEADERS
                    }));
                });
            } catch (_) {}
        }
    }

    async function loadStreams(url, cb) {
        try {
            const data = JSON.parse(url);
            const variables = {
                showId: data.hash,
                translationType: data.dubStatus,
                episodeString: data.episode.toString()
            };

            const res = await queryGraph(variables, HASHES.server, "GET");
            const sources = res.data?.episode?.sourceUrls || [];

            const streamResults = [];
            await Promise.all(sources.map(function (source) {
                return resolveSourceEntries(source, streamResults);
            }));

            const deduped = [];
            const seen = new Set();
            streamResults.forEach(item => {
                const key = `${item.url}|${item.source}`;
                if (seen.has(key)) return;
                seen.add(key);
                deduped.push(item);
            });
            cb({ success: true, data: deduped });
        } catch (e) {
            cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
        }
    }

    // Export
    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "Anichi", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "Anichi", url, type: manifest.type }) });
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