(function() {
    var manifest = {"packageName":"com.eternalnexus.dipland_name","name":"dipland_name","version":1,"description":"dipland_name plugin by eternalnexus","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"video","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};
class Provider {
    getSettings(): Settings {
        return {
            episodeServers: ['server1', 'server2'],
            supportsDub,
        };
    }

    async search(query): Promise<SearchResult[]> {
        return [
            {
                id: '',
                title: '',
                url: '',
                subOrDub: 'both',
            },
        ];
    }
    async findEpisodes(id): Promise<EpisodeDetails[]> {
        return [
            {
                id: '',
                number,
                url: '',
                title: '',
            },
        ];
    }
    async findEpisodeServer(episode, _server): Promise<EpisodeServer> {
        let server = 'server1';
        if (_server !== 'default') server = _server;

        return {
            server,
            headers: {},
            videoSources: [
                {
                    url: 'https://example.com/.../stream.m3u8',
                    type: 'm3u8',
                    quality: '1080p',
                    subtitles: [
                        {
                            id: '1',
                            url: 'https://example.com/.../subs.vtt',
                            language: 'en',
                            isDefault,
                        },
                    ],
                },
            ],
        };
    }
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "dipland_name", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "dipland_name", url, type: manifest.type }) });
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