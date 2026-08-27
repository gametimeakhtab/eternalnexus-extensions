(function() {
    var manifest = {"packageName":"com.eternalnexus.mangaworldadult","name":"MangaWorldAdult","version":1,"description":"MangaWorldAdult is a manga provider for Seanime","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"manga","rating":"All","isAdult":false,"language":"en","languages":["en"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};



class Provider {
  api = 'https://www.mangaworldadult.net';

  getSettings(): Settings {
    return {
      supportsMultiLanguage,
      supportsMultiScanlator,
    };
  }

  async search(opts): Promise<SearchResult[]> {
    let queryParam = opts.query;
    queryParam = queryParam.toLowerCase();

    const url = `${this.api}/archive?keyword=${encodeURIComponent(queryParam)}`;

    if (url == null) {
      return [];
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch search results: ${response.statusText}`);
      }

      const body = await response.text();
      const doc = LoadDoc(body);

      let mangas = await Promise.all(
        doc('div.comics-grid>div.entry').map(async (index, element) => {
          const title = element
            .find('a.manga-title')
            .first()
            .attrs()['title'];
          const thumbnailUrl = element.find('a.thumb img').first().attrs()['src'];
          const mangaId = element
            .find('a.thumb')
            .first()
            .attrs()
          ['href'].split('manga/')[1];

          let aniListDetails = await this.getAniListMangaDetails(queryParam);

          let mangaDetails = {
            id,
            title,
            synonyms: aniListDetails.synonyms,
            year: aniListDetails.year,
            image,
          };

          return mangaDetails;
        })
      );

      let uniqueMangas = Array.from(
        new Map(mangas.map((m) => [m.id, m])).values()
      );
      return uniqueMangas;
    }
    catch (e) {
      console.error(e);
      return [];
    }
  }

  async findChapters(mangaId): Promise<ChapterDetails[]> {
    console.info('kRYstall9 - mangaId: ' + mangaId);

    const url = `${this.api}/manga/${mangaId}`;

    try {
      let response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch chapters: ${response.statusText}`);
      }

      let body = await response.text();
      const doc = LoadDoc(body);

      const chaptersWrapper = doc('div.chapters-wrapper');

      const volumesContainer = chaptersWrapper.has('div.volume-element');

      let finalChapters = [];

      if (volumesContainer.html() != '') {
        const volumes = chaptersWrapper
          .children('div.volume-element')
          .map((index, element) => {
            return element.children('div.volume-chapters');
          });

        for (let volume of volumes) {
          let chapters = volume.children('div').map((index, element) => {
            let id = element
              .find('a')
              .first()
              .attrs()
            ['href'].split('manga/')[1]
              .split('?')[0];
            let url = element.find('a').first().attrs()['href'].split('?')[0];
            let title = element.find('span').first().text();
            let chapter = title.split(' ')[1];
            let chapterIndex = this.getConvertedIndex(chapter);

            let chapterDetails = {
              id,
              url,
              title,
              chapter,
              index,
            };
            return chapterDetails;
          });
          finalChapters.push(...chapters);
        }
      } else {
        doc('div.chapters-wrapper>div.chapter').each((_, elem) => {
          let id = elem
            .find('a')
            .first()
            .attrs()
          ['href'].split('manga/')[1]
            .split('?')[0];
          let url = elem.find('a').first().attrs()['href'].split('?')[0];
          let title = elem.find('span.d-inline-block').text();
          let chapter = `${title.split(' ')[1]}`;
          let chapterIndex = this.getConvertedIndex(chapter);

          let chapterDetails = {
            id,
            url,
            title,
            chapter,
            index,
          };

          finalChapters.push(chapterDetails);
        });
      }

      finalChapters.reverse();
      return finalChapters;
    }
    catch (e) {
      console.error(e);
      return []
    }

  }

  async findChapterPages(chapterId): Promise<ChapterPage[]> {
    const url = `${this.api}/manga/${chapterId}?style=list`;
    const referer = url.split('/read')[0];

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch chapter pages: ${response.statusText}`);
      }

      const body = await response.text();
      const doc = LoadDoc(body);

      let pages = [];
      doc('div#page>img').each((index, element) => {
        let obj = {
          url: element.attrs()['src'],
          index,
          headers: {
            Referer,
          },
        };
        pages.push(obj);
      });
      return pages;
    }
    catch (e) {
      console.error(e);
      return []
    }
  }
  async getAniListMangaDetails(query, id = 0) {
    const aniListAPI = 'https://graphql.anilist.co';
    let variables = {};
    let aniListQuery = '';

    if (id == 0) {
      variables = {
        search,
      };
      aniListQuery = this.getAniListQueryString('search');
    } else {
      variables = {
        mediaId,
      };
      aniListQuery = this.getAniListQueryString('id');
    }

    let options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    };
    let responseGraph = await fetch(aniListAPI, options);

    if (!responseGraph.ok) {
      throw new Error(
        `Failed to fetch search results: ${responseGraph.statusText}`
      );
    }

    let data = await responseGraph.json();
    let mangaYear = data.data.Media.startDate['year'];
    let mangaSynonyms = data.data.Media.synonyms;

    let mangaDetails = {
      title: data.data.Media.title.english,
      synonyms: mangaSynonyms ?? [],
      year,
    };

    return mangaDetails;
  }

  getAniListQueryString(type): string {
    let query = `query`;

    switch (type) {
      case 'id':
        query += `($mediaId) {
              Media(id: $mediaId) {`;
        break;
      case 'search':
        query += `($search) {
              Media(search: $search) {`;
        break;
    }
    query += `id
        title {
          romaji
          english
          native
        }
        startDate {
          day
          month
          year
        }
        meanScore
        synonyms
        updatedAt
        coverImage {
          large
        }
      }
      }`;
    return query;
  }

  getConvertedIndex(mangaChapter): number {
    let chapterNumber = mangaChapter.split('.');
    return Number(chapterNumber[0]);
  }
}





;
      startDate: {
        day: number;
        month: number;
        year: number;
      };
      meanScore: number;
      synonyms: string[];
      updatedAt: string;
      coverImage: {
        large: string;
      };
    };
  };
}

    async function getHome(cb) {
      try {
        if (typeof globalThis.getHomeImpl === 'function') return await globalThis.getHomeImpl(cb);
        cb({ success: true, data: { "Latest": [new MultimediaItem({ title: "MangaWorldAdult", url: manifest.baseUrl, posterUrl: "./icon.png", type: manifest.type })] } });
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
        cb({ success: true, data: new MultimediaItem({ title: "MangaWorldAdult", url, type: manifest.type }) });
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