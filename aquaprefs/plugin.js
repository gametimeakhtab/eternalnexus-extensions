(function() {
    var manifest = {"packageName":"com.eternalnexus.aquaprefs","name":"Aqua's Prefs","version":1,"description":"Remembers your player and series options.","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://github.com/aquaryuo/seanime","type":"other","rating":"All","isAdult":false,"language":"multi","languages":["multi"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: manifest.name, url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: manifest.name, url, type: manifest.type }) });
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