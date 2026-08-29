(function() {
    var manifest = {"packageName":"com.eternalnexus.skip_ahead_video_player","name":"Skip Ahead","version":1,"description":"Adds a skip-ahead button to the video player control bar with configurable position. Useful for skipping intros or recaps in anime episodes.","author":"eternalnexus","authors":["eternalnexus"],"baseUrl":"https://example.com","type":"other","rating":"All","isAdult":false,"language":"multi","languages":["multi"],"icon":"icon.png","iconUrl":"./icon.png","manifestVersion":1};
/// <reference path="./plugin.d.ts" />
/// <reference path="./app.d.ts" />
/// <reference path="./system.d.ts" />
/// <reference path="./core.d.ts" />

function init() {
    $ui.register((ctx) => {
        const LOG_PREFIX = "[skip-ahead-plugin]"
        const DEFAULT_SKIP_SECONDS = 85
        const MIN_SKIP_SECONDS = 1
        const MAX_SKIP_SECONDS = 3600
        const RUN_ID = String(Date.now())

        const POSITION_SELECTORS = {
            "after-next-episode": [
                '[data-vc-element="control-bar"] button[data-vc-element="control-button"]:nth-child(3)',
                'button[data-vc-element="control-button"]:has(svg path[d="m9 18 6-6-6-6"])',
                '[data-vc-element="next-episode-button"]',
                '[data-vc-element="control-bar-next-episode"]'
            ],
            "after-play-button": [
                'button[data-vc-element="control-button"][data-vc-state="paused"]',
                'button[data-vc-element="control-button"][data-vc-state="playing"]',
                '[data-vc-element="play-button"]',
                '[data-vc-element="play-pause-button"]'
            ],
            "after-timestamp": [
                '[data-vc-element="timestamp"]',
                '[data-vc-timestamp-type]'
            ]
        }

        const FALLBACK_SELECTORS = [
            '[data-vc-element="timestamp"]',
            '[data-vc-timestamp-type]'
        ]

        const OBSERVE_SELECTORS = [
            '[data-vc-element="timestamp"]',
            '[data-vc-timestamp-type]',
            'button[data-vc-element="control-button"][data-vc-state="paused"]',
            'button[data-vc-element="control-button"][data-vc-state="playing"]',
            '[data-vc-element="control-bar"] button[data-vc-element="control-button"]:nth-child(3)',
            '[data-vc-element="settings-button"]',
            '[data-vc-element="settings-menu-button"]',
            '[data-vc-element="control-bar-main-section"]',
            '[data-vc-element="control-bar"]'
        ]
        const BUTTON_SELECTOR = '[data-seanime-skip-ahead-button="true"]'
        const BUTTON_RUN_ID_ATTR = "data-seanime-skip-ahead-run-id"
        const BUTTON_BOUND_ATTR = "data-seanime-skip-ahead-bound"
        const BUTTON_KEY_ATTR = "data-seanime-skip-ahead-key"

        console.log(LOG_PREFIX, "Plugin runtime started", { runId: RUN_ID })

        function getConfiguredSkipSeconds() {
            const rawValue = $getUserPreference("skipSeconds")
            const parsed = parseInt(rawValue || "", 10)

            if (isNaN(parsed)) return DEFAULT_SKIP_SECONDS
            if (parsed < MIN_SKIP_SECONDS) return MIN_SKIP_SECONDS
            if (parsed > MAX_SKIP_SECONDS) return MAX_SKIP_SECONDS

            return parsed
        }

        function getConfiguredPosition() {
            const position = $getUserPreference("buttonPosition") || "after-next-episode"
            if (!POSITION_SELECTORS[position]) return "after-next-episode"
            return position
        }

        let observerStops = []
        let cancelPolling = null
        let lastSkipTriggerAt = 0
        let buttonKeyCounter = 0
        let buttonListenerStops: Record<string, () => void> = {}

        function cleanupObservers() {
            for (let i = 0; i < observerStops.length; i += 1) {
                observerStops[i]()
            }
            observerStops = []
        }

        function cleanupButtonListeners() {
            for (const key in buttonListenerStops) {
                if (Object.prototype.hasOwnProperty.call(buttonListenerStops, key)) {
                    buttonListenerStops[key]()
                    delete buttonListenerStops[key]
                }
            }
        }

        function getButtonText() {
            return "+" + getConfiguredSkipSeconds() + "s"
        }

        async function isLikelyVisible(element) {
            try {
                const display = await element.getComputedStyle("display")
                if (display === "none") return false

                const visibility = await element.getComputedStyle("visibility")
                if (visibility === "hidden") return false

                const opacity = await element.getComputedStyle("opacity")
                if (opacity === "0") return false

                return true
            } catch (error) {
                return true
            }
        }

        async function findTargetElement() {
            const position = getConfiguredPosition()
            const selectors = POSITION_SELECTORS[position]

            for (let i = 0; i < selectors.length; i += 1) {
                const elements = await ctx.dom.query(selectors[i])
                for (let j = 0; j < elements.length; j += 1) {
                    if (await isLikelyVisible(elements[j])) {
                        return { element: elements[j], position }
                    }
                }
            }

            for (let i = 0; i < FALLBACK_SELECTORS.length; i += 1) {
                const elements = await ctx.dom.query(FALLBACK_SELECTORS[i])
                for (let j = 0; j < elements.length; j += 1) {
                    if (await isLikelyVisible(elements[j])) {
                        return { element: elements[j], position: "after-next-episode" }
                    }
                }
            }

            for (let i = 0; i < FALLBACK_SELECTORS.length; i += 1) {
                const elements = await ctx.dom.query(FALLBACK_SELECTORS[i])
                if (elements.length > 0) {
                    return { element: elements[0], position: "after-next-episode" }
                }
            }
            return null
        }

        async function ensureSkipButton(target) {
            if (!target) return null

            const buttonText = getButtonText()
            const { element, position } = target
            const parent = await element.getParent()
            if (!parent) return null

            const existingButton = await parent.queryOne(BUTTON_SELECTOR)
            if (existingButton) {
                existingButton.setText(buttonText)
                const existingRunId = await existingButton.getAttribute(BUTTON_RUN_ID_ATTR)
                if (existingRunId === RUN_ID) {
                    const existingKey = await existingButton.getAttribute(BUTTON_KEY_ATTR)
                    if (!existingKey) {
                        existingButton.setAttribute(BUTTON_KEY_ATTR, RUN_ID + "-" + String(buttonKeyCounter++))
                    }
                    return existingButton
                }

                existingButton.remove()
            }

            const button = await ctx.dom.createElement("button")
            button.setAttribute("type", "button")
            button.setAttribute("data-seanime-skip-ahead-button", "true")
            button.setAttribute(BUTTON_RUN_ID_ATTR, RUN_ID)
            button.setAttribute(BUTTON_KEY_ATTR, RUN_ID + "-" + String(buttonKeyCounter++))
            button.setAttribute("title", "Skip ahead")
            button.setAttribute(
                "class",
                "ml-2 h-6 px-2 inline-flex items-center justify-center flex-shrink-0 rounded-md border border-white/30 bg-white/10 text-white text-xs leading-none cursor-pointer pointer-events-auto select-none relative z-[2] hover:bg-white/20 transition-colors"
            )
            button.setText(buttonText)

            element.after(button)
            return button
        }

        async function runSkip(buttonId) {
            const now = Date.now()
            if (now - lastSkipTriggerAt < 250) return
            lastSkipTriggerAt = now

            try {
                const skipSeconds = getConfiguredSkipSeconds()
                console.log(LOG_PREFIX, "Skip clicked", {
                    skipSeconds: skipSeconds,
                    buttonId: buttonId,
                })

                await Promise.resolve(ctx.videoCore.seek(skipSeconds))
                console.log(LOG_PREFIX, "videoCore.seek succeeded")

                ctx.videoCore.showMessage("Skipped +" + skipSeconds + "s", 1200)
                console.log(LOG_PREFIX, "videoCore.showMessage dispatched")
            } catch (error) {
                console.error(LOG_PREFIX, "videoCore.seek failed", error)
                try {
                    const skipSeconds = getConfiguredSkipSeconds()
                    const status = ctx.videoCore.getPlaybackStatus()
                    const currentTime = status && typeof status.currentTime === "number" ? status.currentTime : 0
                    const targetTime = Math.max(0, Math.floor(currentTime + skipSeconds))

                    await Promise.resolve(ctx.playback.seek(targetTime))
                    console.log(LOG_PREFIX, "playback.seek fallback succeeded")
                    ctx.videoCore.showMessage("Skipped +" + skipSeconds + "s", 1200)
                } catch (fallbackError) {
                    console.error(LOG_PREFIX, "playback.seek fallback failed", fallbackError)
                    ctx.toast.warning("Could not skip right now")
                }
            }
        }

        async function bindButtonListeners() {
            const buttons = await ctx.dom.query(BUTTON_SELECTOR)
            const activeKeys: Record<string, boolean> = {}
            let newlyBoundCount = 0

            for (let i = 0; i < buttons.length; i += 1) {
                let buttonKey = await buttons[i].getAttribute(BUTTON_KEY_ATTR)
                if (!buttonKey) {
                    buttonKey = RUN_ID + "-" + String(buttonKeyCounter++)
                    buttons[i].setAttribute(BUTTON_KEY_ATTR, buttonKey)
                }

                activeKeys[buttonKey] = true

                if (buttonListenerStops[buttonKey]) {
                    continue
                }

                buttons[i].setAttribute(BUTTON_BOUND_ATTR, RUN_ID)
                const buttonId = buttons[i].id || buttonKey
                const onPress = (event: any) => {
                    if (event && typeof event.preventDefault === "function") {
                        event.preventDefault()
                    }
                    if (event && typeof event.stopPropagation === "function") {
                        event.stopPropagation()
                    }

                    console.log(LOG_PREFIX, "Skip button press captured", {
                        buttonId: buttonId,
                    })
                    runSkip(buttonId)
                }

                const stopClick = buttons[i].addEventListener("click", onPress)
                const stopPointerDown = buttons[i].addEventListener("pointerdown", onPress)
                const stopMouseDown = buttons[i].addEventListener("mousedown", onPress)

                buttonListenerStops[buttonKey] = () => {
                    stopClick()
                    stopPointerDown()
                    stopMouseDown()
                }
                newlyBoundCount += 1
            }

            if (newlyBoundCount > 0) {
                console.log(LOG_PREFIX, "Bound button listeners", {
                    count: newlyBoundCount,
                    totalButtons: buttons.length,
                })
            }

            for (const key in buttonListenerStops) {
                if (!Object.prototype.hasOwnProperty.call(buttonListenerStops, key)) continue
                if (activeKeys[key]) continue

                buttonListenerStops[key]()
                delete buttonListenerStops[key]
            }
        }

        let attachInProgress = false
        let attachQueued = false

        async function attachButtons() {
            if (attachInProgress) {
                attachQueued = true
                return
            }

            attachInProgress = true

            const targetElement = await findTargetElement()
            if (!targetElement) {
                attachInProgress = false
                if (attachQueued) {
                    attachQueued = false
                    attachButtons()
                }
                return
            }

            const targetButton = await ensureSkipButton(targetElement)

            const allButtons = await ctx.dom.query(BUTTON_SELECTOR)

            // Only dedupe once a target button definitely exists.
            if (targetButton) {
                for (let i = 0; i < allButtons.length; i += 1) {
                    if (allButtons[i].id !== targetButton.id) {
                        allButtons[i].remove()
                    }
                }
            }

            await bindButtonListeners()

            attachInProgress = false
            if (attachQueued) {
                attachQueued = false
                attachButtons()
            }
        }

        function start() {
            cleanupObservers()
            cleanupButtonListeners()

            for (let i = 0; i < OBSERVE_SELECTORS.length; i += 1) {
                const result = ctx.dom.observe(OBSERVE_SELECTORS[i], () => {
                    attachButtons()
                })
                observerStops.push(result[0])
                result[1]()
            }

            if (cancelPolling) {
                cancelPolling()
            }
            cancelPolling = null

            attachButtons()
        }

        ctx.dom.onReady(() => {
            start()
        })

        ctx.dom.onMainTabReady(() => {
            start()
        })
    })
}

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