# EternalNexus Extension Development Guide (`extension.md`)

This guide explains how to build custom extensions (plugins) for **EternalNexus**. 

EternalNexus supports **both legacy (old) extension formats and the new feature-packed extension format**. The new format introduces granular age rating (18, 16+, 13+, All), detailed content rating descriptions, custom extension icons/thumbnails, and rich metadata features.

---

## 1. Overview & Extension Architecture

An extension (plugin) is a JavaScript script run inside EternalNexus's secure QuickJS runtime sandbox. Extensions fetch, parse, and present content from third-party media websites (Movies, Series, Anime, Manga, Music, Livestreams).

### File Structure of an Extension

```
my_extension/
├── plugin.js     (Required: Main JavaScript code containing logic and manifest)
├── plugin.json   (Optional: Repository manifest for remote extension repositories)
└── icon.png      (Optional: Local extension logo/picture)
```

---

## 2. Legacy vs. New Format Compatibility

EternalNexus guarantees **100% backward compatibility**. Old plugins will continue to work seamlessly, while new plugins can take advantage of enhanced rating options and rich extension pictures.

| Field / Feature | Legacy (Old) Format | New Extended Format |
|---|---|---|
| **Manifest Version** | `"1.0"` (String) or `1` (Integer) | `1` or higher |
| **Age / Rating System** | `isAdult`: `true` / `false` | `isAdult`: `true` / `false`<br>`rating`: `"18"`, `"16+"`, `"13+"`, `"All"`<br>`contentRating`: Description of content rating mean age |
| **Extension Picture / Icon** | `iconUrl`: `"https://..."` | `icon`: `"https://..."` or `"./icon.png"`<br>`iconUrl`: `"https://..."`<br>`thumbnailUrl`: `"https://..."` |
| **Plugin Types** | `"video"`, `"manga"`, `"music"` | `"video"`, `"music"`, `"anime"`, `"manga"`, `"schedule"`, `"other"` |
| **Metadata Helpers** | Basic title, url, posterUrl | Cast, Trailers, Next Airing, Instant Streams, Playback Policy |

---

## 3. Extension Picture & Icon Guidelines (`pic of extention`)

EternalNexus uses pictures to display your extension in the Extensions Store and Plugin Manager.

### Adding an Icon to Your Extension

You can define an extension picture in **three ways**:

1. **Remote Web URL (`iconUrl` or `icon`):**
   ```json
   "iconUrl": "https://example.com/assets/icon.png"
   ```
2. **Local Image File in Extension Package (`icon`):**
   Include an `icon.png` inside your extension ZIP folder and reference it:
   ```json
   "icon": "./icon.png"
   ```
3. **Thumbnail URL (`thumbnailUrl`):**
   Used for high-resolution store cards or previews:
   ```json
   "thumbnailUrl": "https://example.com/assets/banner.jpg"
   ```

### Recommended Image Specifications:
- **Format**: PNG or WEBP (transparent background preferred).
- **Square Icon Dimensions**: 512x512 px (minimum 200x200 px).
- **Aspect Ratio**: 1:1 square for `iconUrl` / `icon`.
- **Banner/Thumbnail Aspect Ratio**: 16:9 for `thumbnailUrl`.

---

## 4. Age Rating & Content Filter System

In the **new format**, age ratings can be precisely categorized into age brackets with human-readable descriptions.

### Rating Classifications

| Rating Tag | Mean Target Age | Description & Allowed Content | `isAdult` Flag |
|---|---|---|---|
| `"18"` / `"18+"` | Age 18+ (Adults Only) | NSFW, Hentai, Explicit adult content. Hidden by default until enabled in app settings. | `true` |
| `"16+"` | Age 16+ (Mature Teen) | Violence, strong language, mature themes, light fan service. Visible without 18+ filter. | `false` |
| `"13+"` | Age 13+ (Teens) | PG-13 content, mild action violence, superhero/anime series. | `false` |
| `"All"` / `"0+"` | All Ages (General) | Family-friendly, educational, general audience content. | `false` |

### Setting Rating in Manifest

```javascript
var manifest = {
  "name": "Adult & Anime Zone",
  "version": "1.2.0",
  "type": "video",
  
  // Rating configuration
  "isAdult": true,                       // Legacy flag (true for 18+)
  "rating": "18",                        // New rating classification: "18", "16+", "13+", "All"
  "contentRatingDescription": "Contains explicit adult animation and 18+ themes", // Detailed description
};
```

---

## 5. Manifest Specification

### Old Format Example (Legacy Compatible)

```javascript
var manifest = {
  "name": "Legacy Anime Source",
  "description": "Streams anime from legacy site",
  "version": "1.0.0",
  "author": "PluginDev",
  "type": "video",
  "language": "en",
  "baseUrl": "https://legacy-anime.example",
  "iconUrl": "https://legacy-anime.example/favicon.ico",
  "isAdult": false
};
```

### New Format Example (Full Featured)

```javascript
var manifest = {
  "manifest_version": 1,
  "id": "com.example.new-anime-source",
  "name": "Ultra Anime Source",
  "description": "High-definition streams with age ratings and multi-language support",
  "version": "2.0.0",
  "type": "video",
  "author": "PluginDev",
  "publisher": {
    "name": "Studio Dev",
    "url": "https://github.com/plugindev",
    "contact": "support@example.com"
  },
  "rating": "16+",                         // "18" | "16+" | "13+" | "All"
  "contentRatingDescription": "16+ Mature themes, action violence",
  "isAdult": false,                        // Set to true if rating is 18
  "language": "en",                        // or ["en", "ja"]
  "baseUrl": "https://ultra-anime.example",
  "icon": "https://ultra-anime.example/assets/icon.png", // or "./icon.png"
  "iconUrl": "https://ultra-anime.example/assets/icon.png",
  "thumbnailUrl": "https://ultra-anime.example/assets/banner.png",
  "license": "MIT",
  "homepage": "https://ultra-anime.example",
  "capabilities": ["search", "categories", "instant_stream", "trailers"],
  "categories": ["Action", "Romance", "Fantasy", "Sci-Fi"]
};
```


---

## 6. JavaScript Core API Reference

Extensions expose functions by assigning them to `globalThis` or top-level scope.

### 1. `getHome(cb)`
Fetches categories for the home dashboard. Items inside `"Trending"` category are highlighted in the Hero Carousel.

```javascript
async function getHome(cb) {
  try {
    cb({
      success: true,
      data: {
        "Trending": [
          new MultimediaItem({
            title: "Featured Action Movie",
            url: "https://example.com/movie/1",
            posterUrl: "https://example.com/posters/1.jpg",
            bannerUrl: "https://example.com/banners/1.jpg",
            type: "movie",
            description: "An epic sci-fi action movie."
          })
        ],
        "Popular Series": [ /* array of MultimediaItem */ ]
      }
    });
  } catch (e) {
    cb({ success: false, message: String(e) });
  }
}
```

### 2. `search(query, page, cb)`
Searches content matching `query`.

```javascript
async function search(query, page, cb) {
  try {
    const html = await fetch(`${manifest.baseUrl}/search?q=${encodeURIComponent(query)}&page=${page}`);
    cb({ success: true, data: [ /* array of MultimediaItem */ ] });
  } catch (e) {
    cb({ success: false, message: String(e) });
  }
}
```

### 3. `load(url, cb)`
Fetches detailed info about a specific media item (Movie, Series, Episode list, Cast, Trailers).

```javascript
async function load(url, cb) {
  try {
    cb({
      success: true,
      data: new DetailItem({
        title: "Super Series",
        url: url,
        posterUrl: "https://example.com/poster.jpg",
        description: "Complete series overview...",
        rating: "16+",
        contentRating: "TV-MA",
        logoUrl: "https://example.com/logo.png",
        isAdult: false,
        tags: ["Action", "Thriller"],
        cast: [
          new Actor({ name: "Jane Doe", role: "Lead", image: "https://example.com/jane.jpg" })
        ],
        trailers: [
          new Trailer({ name: "Official Trailer", url: "https://youtube.com/watch?v=xxx" })
        ],
        episodes: [
          new Episode({
            name: "Episode 1: The Beginning",
            url: "https://example.com/watch/ep1",
            season: 1,
            episode: 1,
            posterUrl: "https://example.com/ep1.jpg"
          })
        ]
      })
    });
  } catch (e) {
    cb({ success: false, message: String(e) });
  }
}
```

### 4. `loadStreams(url, cb)`
Extracts video/audio stream URLs.

```javascript
async function loadStreams(url, cb) {
  try {
    cb({
      success: true,
      data: [
        new StreamResult({
          url: "https://stream.example.com/video.m3u8",
          source: "Auto / 1080p",
          headers: { "Referer": manifest.baseUrl }
        })
      ]
    });
  } catch (e) {
    cb({ success: false, message: String(e) });
  }
}
```



---

## 7. Complete Starter Template (`plugin.js`)

You can copy and use this complete template for new extensions:

```javascript
(function() {
  /**
   * Extension Manifest Configuration
   */
  var manifest = {
    "manifest_version": 1,
    "id": "com.example.myextension",
    "name": "My Custom Source",
    "description": "Streams media with full age rating and high-res icon",
    "version": "1.0.0",
    "author": "YourName",
    "type": "video",                       // "video" | "manga" | "music"
    "rating": "16+",                       // Age rating: "18" | "16+" | "13+" | "All"
    "contentRatingDescription": "16+ Mild violence & mature action",
    "isAdult": false,                      // Set to true if rating is "18"
    "language": "en",
    "baseUrl": "https://example.com",
    "icon": "https://example.com/icon.png",// Extension picture URL or "./icon.png"
    "iconUrl": "https://example.com/icon.png",
    "thumbnailUrl": "https://example.com/banner.png"
  };

  // 1. Home Dashboard Category Provider
  async function getHome(cb) {
    try {
      const html = await fetch(manifest.baseUrl);
      cb({
        success: true,
        data: {
          "Trending": [
            new MultimediaItem({
              title: "Featured Title",
              url: `${manifest.baseUrl}/watch/1`,
              posterUrl: "https://placehold.co/400x600.png?text=Featured",
              type: "movie",
              description: "Trending carousel item description"
            })
          ],
          "Latest Uploads": []
        }
      });
    } catch (e) {
      cb({ success: false, message: String(e) });
    }
  }

  // 2. Search Function
  async function search(query, page, cb) {
    try {
      const searchUrl = `${manifest.baseUrl}/search?q=${encodeURIComponent(query)}&page=${page || 1}`;
      const responseText = await fetch(searchUrl);
      cb({
        success: true,
        data: [
          new MultimediaItem({
            title: `Result for ${query}`,
            url: `${manifest.baseUrl}/item/1`,
            posterUrl: "https://placehold.co/400x600.png?text=Search+Result",
            type: "series"
          })
        ]
      });
    } catch (e) {
      cb({ success: false, message: String(e) });
    }
  }

  // 3. Detail Loader
  async function load(url, cb) {
    try {
      cb({
        success: true,
        data: new DetailItem({
          title: "Sample Series Detail",
          url: url,
          posterUrl: "https://placehold.co/400x600.png?text=Poster",
          description: "Full plot description...",
          rating: "16+",
          contentRating: "TV-14",
          isAdult: false,
          episodes: [
            new Episode({
              name: "Episode 1",
              url: `${manifest.baseUrl}/watch/ep1`,
              season: 1,
              episode: 1
            })
          ]
        })
      });
    } catch (e) {
      cb({ success: false, message: String(e) });
    }
  }

  // 4. Stream Resolver
  async function loadStreams(url, cb) {
    try {
      cb({
        success: true,
        data: [
          new StreamResult({
            url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
            source: "HD 1080p Direct",
            headers: { "Referer": manifest.baseUrl }
          })
        ]
      });
    } catch (e) {
      cb({ success: false, message: String(e) });
    }
  }

  // Export functions to global scope
  globalThis.getHome = getHome;
  globalThis.search = search;
  globalThis.load = load;
  globalThis.loadStreams = loadStreams;
})();
```

---

## 8. Testing & Deployment

1. Save your script as `plugin.js`.
2. Add your extension icon (`icon.png`) in the same folder if using local assets.
3. Zip the files into a single archive (`.zip` or `.plugin`).
4. In **EternalNexus**, go to **Extensions** → **Install Local Extension** and select your file.
5. Your extension picture and age rating will instantly appear in the extension overview list!

---

## 9. Building Specific Extension Types (Music, Anime, Manga, Schedule, Other)

EternalNexus categorizes extensions into distinct format categories to optimize UI presentation and playback features.

### A. Music Extensions (`"type": "music"`)
Music extensions are separated from Video extensions. They focus on audio playback, tracks, albums, playlists, and Spotify Canvas background integration.

#### Manifest Definition
```json
{
  "name": "My Music Provider",
  "version": "1.0.0",
  "types": ["music"],
  "language": "en"
}
```

#### Exported JavaScript Functions
- `searchMusic(query, page, cb)`: Returns array of `MultimediaItem` (tracks/albums).
- `loadAudioStreams(url, cb)`: Returns array of `StreamResult` with direct audio stream URLs (`.mp3`, `.flac`, `.m3u8`).
- `getCanvasUrl(trackId, cb)`: Optional: returns Spotify Canvas video URL (`.mp4`) for animated audio backgrounds.

#### Sample Music Extension Implementation
```javascript
async function searchMusic(query, page, cb) {
  cb({
    success: true,
    data: [
      new MultimediaItem({
        title: "Song Title",
        author: "Artist Name",
        url: "https://music-provider.com/track/123",
        posterUrl: "https://music-provider.com/cover.jpg",
        type: "music"
      })
    ]
  });
}

async function loadAudioStreams(url, cb) {
  cb({
    success: true,
    data: [
      new StreamResult({
        url: "https://audio-stream-url.mp3",
        source: "HQ 320kbps MP3"
      })
    ]
  });
}

globalThis.searchMusic = searchMusic;
globalThis.loadAudioStreams = loadAudioStreams;
```

---

### B. Anime & Manga Extensions (`"type": "anime"` or `"type": "manga"`)
- `"type": "anime"`: Handles anime streaming scrapers and torrent sources.
- `"type": "manga"`: Handles manga search, chapter extraction, and page image loaders.

---

### C. Schedule & Calendar Extensions (`"type": "schedule"`)
Schedule extensions provide airing schedule details for calendar views.

```json
{
  "name": "Release Schedule Provider",
  "types": ["schedule"]
}
```

#### Exported JavaScript Function
- `getAiringSchedule(month, year, cb)`: Returns list of scheduled episode release objects containing airing dates, titles, and episode numbers.

---

### D. Other Extensions (`"type": "other"`)
Use `"type": "other"` for custom UI optimization plugins (e.g. plugin name "x" which optimizes look and feel, custom theme color engines, Discord RPC extensions, and desktop tools).

```json
{
  "name": "Custom Look & Feel Optimizer (X)",
  "version": "1.0.0",
  "types": ["other"],
  "description": "Optimizes app UI theme and enhances visual styling."
}
```

---


