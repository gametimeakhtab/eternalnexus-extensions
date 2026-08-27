(function() {
    var manifest = {"packageName":"com.eternalnexus.dipland_mangafire","name":"MangaFire","version":1,"description":"Multi language manga provider.","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"manga","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};
class Provider {
    baseURL = 'https://mangafire.to';

    getSettings(): Settings {
        return {
            supportsMultiLanguage,
            supportsMultiScanlator,
        };
    }

    async search(opts: { query: string }): Promise<SearchResult[]> {
        const url = `${this.baseURL}/api/titles?keyword=${opts.query.replace(/\s+/g, '+')}&content_rating%5B%5D=safe&content_rating%5B%5D=suggestive&order%5Brelevance%5D=desc&page=1&limit=30`;
        const res = await fetch(this.generate(url));
        const data = await res.json();

        if (!data?.items) return [];

        return data.items.map((v) => ({
            id: v.hid,
            title: v.title,
            synonyms,
            year: v.year,
            image: v.poster.large,
        }));
    }

    async findChapters(mangaId): Promise<ChapterDetails[]> {
        const url = `${this.baseURL}/api/titles/${mangaId}`;
        const res = await fetch(this.generate(url));
        const data = await res.json();

        const allChapters = [];

        for (let page = 1; page <= Math.ceil(data.data.latestChapter / 200); page++) {
            for (const lang of data.data.languages) {
                const chapters = await this.fetchChaptersForLanguage(mangaId, lang, page);
                allChapters.push(...chapters);
            }
        }

        return allChapters;
    }

    async findChapterPages(chapterId): Promise<ChapterPage[]> {
        const url = `${this.baseURL}/api/chapters/${chapterId}`;
        const res = await fetch(this.generate(url));
        const data = await res.json();

        if (!data?.data?.pages?.length) return [];

        return data.data.pages.map((value, i) => ({
            url: value.url,
            index,
            headers: {
                Referer: `${this.baseURL}/`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
            },
        }));
    }

    async fetchChaptersForLanguage(mangaId, lang, page): Promise<ChapterDetails[]> {
        const url = `${this.baseURL}/api/titles/${mangaId}/chapters?language=${lang}&sort=number&order=asc&page=${page}&limit=200`;
        const res = await fetch(this.generate(url));
        const data = await res.json();

        if (!data?.items) return [];

        const langChapters = data.items.map((chapter, i) => {
            return {
                id: `${chapter.id}`,
                url: 'https://mangafire.to/title/' + mangaId,
                title: !chapter.name.trim() ? `Chapter ${chapter.number}` : chapter.name,
                index: page * 200 - 200 + i,
                chapter: `${chapter.number}`,
                language: this.normalizeLanguageCode(lang),
                updatedAt: `${chapter.createdAt}`,
            };
        });

        return langChapters;
    }

    normalizeLanguageCode(lang): string {
        const langToISO, string> = {
            en: 'en',
            fr: 'fr',
            es: 'es',
            'es-la': 'es-419',
            pt: 'pt',
            'pt-br': 'pt-br',
            ja: 'ja',
            de: 'de',
            it: 'it',
            ru: 'ru',
            ko: 'ko',
            zh: 'zh',
            'zh-cn': 'zh-cn',
            'zh-tw': 'zh-tw',
            ar: 'ar',
            tr: 'tr',
        };

        return langToISO[lang] || lang;
    }

    textEncode(str): Uint8Array {
        return Uint8Array.from(Buffer.from(str, 'utf-8'));
    }

    atob(data): Uint8Array {
        return Uint8Array.from(Buffer.from(data, 'base64'));
    }

    base64UrlEncode(uint8Array) {
        const b64 = Buffer.from(uint8Array).toString('base64');
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    tables, string> = {
        1: 'yINlmUNho8VYJT+ibTIP+9ESiULpVEtMOoD6U6lRE0R/xwXo/Xp9NrUgC4cw/Lmo33vUyjUE40kUoEWIr/fxfNNcq2s79ShQ5NhNrFnJ4hXPwOu/SuXzIbuTQKGFvfm08E9jvCfqAtoDqvQq3dVWPQFmJjgvkISBeXY3BgANR+yVnjGbcxZ47d6kLNfZPIayTq3/YGySb1KuVZodWp/WGNAO5pfMcpaK53Hhs0allBszaMaxuouOwdxbwgxIw6YunSsXjI05Yi0j9j4eHKfSXR8Ifo/Od+8iamRfCXTyvm7NGRGYdcQ0ywcK/u6RXhrbcCm4t2eCtrDgQVecJGkQ+A==',
        2: 'IUFltCxD3Oc2cwCgkJffthaOg9cgPUb0LgW6H/VtfcF0kc5F25t+aWj6JH9VOhOaY0rAFdUxlDnl5BLNvwEJvQtP5qcw7vdb/K+chnbwnspSHT8mz5lqwz41TezG0hkO06FTjJZhsyNuFLDpD2ZZxQj/QIRcF90zpmQ7Byu483WsQqUE0C342HL+JXngRB6fRzxRyVTaKu83h7UYTJ0QMt6ixFh6S3F8gqkKwrGTL3jHNBsD45UnifK8+RGtishQV2K3rujLKEkiZxpr2dYcudFW4oFsDKhad3CLBvuyTqsCo4B7mL5IKQ1vXo/MOOvq1I1d8ar9X6Ttu5KF4fZgiA==',
        3: 'NQHlu1/wVO5EmkwQymF810qqY2xG1k2obcas4Z9mCsPEIFl9pRIjFxbJ7ybMHbBckT5Ton85E0FOeHezbh/mjlEYpmpnlXOS8dgrqeq2KfxImTh1YK9y0PeMNhzA1OQzSY9brYOJq/l2QnE/hwOeZIhPixVSKIUlDb5vLcH6RWKxkIEMuP0bDwIqQ71AJJaEaMJL7A6YtyIwoRT+L5v4aZzodN/0+3nOGsfblFjgxSfPzVDjNFeNl5P26+kEC/8AHgdrpAbt3hHz3HrRN1Y6e+JHgF7ncFWnoF0y3THL1S71WgWGCa6KtSzTCCG58n68nTyj2T3Sshk7utqCtMi/ZQ==',
    };

    keys, string> = {
        1: '0Ec58JOY3uBzJK9m3zqIOpdlF7UFiax9DmA=',
        2: 'AAdjb1iPY8CiDmq9H34tKTBF8a3oDQ==',
        3: 'DELOJgPsVaCcblDtTGMdHzM=',
    };

    stages = [
        [this.atob(this.tables[1]), this.atob(this.keys[1]), 0x5a],
        [this.atob(this.tables[2]), this.atob(this.keys[2]), 0x35],
        [this.atob(this.tables[3]), this.atob(this.keys[3]), 0xba],
    ];

    encryptStage(data, table, key, iv): Uint8Array {
        const out = new Uint8Array(data.length);
        let prev = iv & 0xff;
        const keySize = key.length;

        for (let i = 0; i < data.length; i++) {
            const idx = (data[i] ^ key[i % keySize] ^ prev) & 0xff;
            prev = table[idx] & 0xff;
            out[i] = prev;
        }

        return out;
    }

    sign(path): string {
        const data = this.textEncode(path);
        let working = data;
        for (const [table, key, iv] of this.stages) {
            working = this.encryptStage(working, table, key, iv);
        }
        return this.base64UrlEncode(working);
    }

    generate(input): string {
        const url = new URL(input);
        if (!url.pathname.startsWith('/api/')) return url;

        const pairs = [];
        for (const [k, v] of url.searchParams) {
            pairs.push([k, v]);
        }

        pairs.sort((a, b) => {
            if (a[0] < b[0]) return -1;
            if (a[0] > b[0]) return 1;
            return 0;
        });

        let sortedQueryUrl = url.pathname.replace(/^\/api/, '');

        if (pairs.length > 0) {
            sortedQueryUrl += '?';
            let lastKey = '';
            let index = 0;
            sortedQueryUrl += pairs
                .map(([key, value]) => {
                    let newKey = key;
                    if (key.endsWith('[]')) {
                        if (lastKey !== key) index = 0;
                        lastKey = key;
                        newKey = key.replace('[]', `[${index++}]`);
                    }
                    return `${newKey}=${value}`;
                })
                .join('&');
        }

        const newUrl = new URL(url.origin + url.pathname);
        for (const [k, v] of pairs) newUrl.searchParams.append(k, v);
        newUrl.searchParams.append('vrf', this.sign(sortedQueryUrl));

        return newUrl.toString();
    }
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "MangaFire", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "MangaFire", url, type: manifest.type }) });
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