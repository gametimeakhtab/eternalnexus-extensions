(function() {
    var manifest = {"packageName":"com.eternalnexus.animeunitymirror","name":"AnimeUnity (Mirror)","version":1,"description":"AnimeUnity mirror","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"video","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};
/// <reference path="./online-streaming-provider.d.ts" />
class Provider {
  constructor() {
    this.base = "https://animeunity.ch";
  }

  getSettings() {
    return {
      episodeServers: ["AnimeUnity"],
      supportsDub: false,
    };
  }

  async search(query) {
    const res = await fetch(`${this.base}/?s=${encodeURIComponent(query.query)}`);
    const html = await res.text();

    const results = [];

    // Extract each <article class="bs"> block
    const articleRegex = /<article[^>]+class="bs"[^>]*>([\s\S]*?)<\/article>/g;
    let articleMatch;

    while ((articleMatch = articleRegex.exec(html)) !== null) {
      const block = articleMatch[1];

      // href and title can be in single or double quotes, attribute order may vary
      const hrefMatch = block.match(/href=["']([^"']+)["'][^>]*title=["']([^"']+)["']/);
      if (!hrefMatch) continue;

      const url = hrefMatch[1];
      const title = hrefMatch[2];

      const slugMatch = url.match(/\/anime\/([^/?#]+)\/?/);
      if (!slugMatch) continue;

      const id = slugMatch[1];
      results.push({
        id,
        title,
        url,
        subOrDub: "sub",
      });
    }

    if (!results.length) throw new Error("No anime found");
    return results;
  }

  async findEpisodes(id) {
    const res = await fetch(`${this.base}/anime/${id}/`);
    const html = await res.text();

    const episodes = [];

    // Match each <li data-index="N"> block
    const liRegex = /<li[^>]+data-index="\d+"[^>]*>([\s\S]*?)<\/li>/g;
    let liMatch;

    while ((liMatch = liRegex.exec(html)) !== null) {
      const block = liMatch[1];

      const hrefMatch = block.match(/href=["']([^"']+)["']/);
      const numMatch = block.match(/<div[^>]+class="epl-num"[^>]*>(\d+)<\/div>/);
      const titleMatch = block.match(/<div[^>]+class="epl-title"[^>]*>([^<]*)<\/div>/);

      if (!hrefMatch || !numMatch) continue;

      const url = hrefMatch[1];
      const number = parseInt(numMatch[1], 10);
      const title = titleMatch ? titleMatch[1].trim() : `Episode ${number}`;

      const slugMatch = url.match(/\/([^/?#]+)\/?$/);
      const epId = slugMatch ? slugMatch[1] : url;

      episodes.push({
        id: epId,
        title,
        number,
        url,
      });
    }

    episodes.sort((a, b) => a.number - b.number);
    return episodes;
  }

  async findEpisodeServer(episode, _server) {
    const episodeUrl = episode.url.startsWith("http")
      ? episode.url
      : `${this.base}${episode.url.startsWith("/") ? "" : "/"}${episode.url}`;

    const res = await fetch(episodeUrl, {
      headers: {
        Referer: this.base,
      },
    });
    const html = await res.text();

    // Match the anixo.net embed iframe and pull its base64 "data" param
    const iframeMatch = html.match(/<iframe[^>]+src=["']https:\/\/anixo\.net\/embed\.html\?data=([^"'&]+)["']/i);
    if (!iframeMatch) throw new Error("Video embed not found");

    const encodedData = decodeURIComponent(iframeMatch[1]);
    const streamUrl = this.base64Decode(encodedData);

    if (!streamUrl.startsWith("http")) {
      throw new Error("Decoded stream URL is invalid");
    }

    const isHls = streamUrl.includes(".m3u8");
    const streamType = isHls ? "m3u8" : "mp4";

    return {
      server: "AnimeUnity",
      headers: {},
      videoSources: [
        {
          url: streamUrl,
          quality: "auto",
          type: streamType,
          subtitles: [],
        },
      ],
    };
  }

  base64Decode(str) {
    if (typeof atob === "function") {
      return atob(str);
    }
    // Fallback
    return Buffer.from(str, "base64").toString("utf-8");
  }
}
    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "AnimeUnity (Mirror)", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "AnimeUnity (Mirror)", url, type: manifest.type }) });
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