(function() {
    var manifest = {"packageName":"com.eternalnexus.antiseeding","name":"Anti-Seeding","version":1,"description":"Prevents torrent seeding","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"other","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};
function init() {
    $ui.register((ctx) => {
        ctx.setInterval(async () => {
            try {
                const torrents = await ctx.torrentClient.getActiveTorrents();
                for (const torrent of torrents) {
                    if (torrent.status == "seeding") {
                        ctx.toast.info("Finished downloading - " + torrent.name);
                        await ctx.torrentClient.pauseTorrents([torrent.hash]); 
                        ctx.toast.info("Removed the torrent from torrent client.");
                    }
                }
            } catch (error) {
                console.error("Error getting torrents:", error)
            }
        }, 1000);
    });
}
    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "Anti-Seeding", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "Anti-Seeding", url, type: manifest.type }) });
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