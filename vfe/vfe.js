let viewer;
let viewerConfig;
let config;
let configUrl;
let currentSlate = null;
let activeHotspotIds = new Set();
let openInfoAfterSceneChange = false;
let dataMode = false;
let dataState = {regions: [], unit: ''};
let lastSceneId = null;

const mediaOverlay = document.getElementById("mediaOverlay");
const video = document.getElementById("video");
const videoSource = document.getElementById("videoSource");
const mediaTitle = document.getElementById("mediaTitle");
const closeMediaButton = document.getElementById("closeMedia");
const descriptionOverlay = document.getElementById("descriptionOverlay");
const descriptionTitle = document.getElementById("descriptionTitle");
const descriptionContent = document.getElementById("descriptionContent");
const closeDescriptionButton = document.getElementById("closeDescription");
const errorElement = document.getElementById("error");
const youtubeFrame = document.getElementById("youtubeFrame");
const hotspotImage = document.getElementById("hotspotImage");
const youtubeContainer = document.getElementById("youtubeContainer");
const imageContainer = document.getElementById("imageContainer");
const videoContainer = document.getElementById("videoContainer");
const slateControls = document.getElementById("slateControls");
const audio = document.getElementById("audio");
const audioSource = document.getElementById("audioSource");
const panorama = document.getElementById("panorama");
const dataReadout = document.getElementById("dataReadout");
const dataCenterIndicator = document.getElementById("dataCenterIndicator");

let dragState = { active:false, offsetX:0, offsetY:0 };
let dataButton = null;
let gatedModeConfig = null;
let unlockedScenes = new Set();
let gatePromptInDesc = null;
let lastAppliedSlate = null;
let lastAppliedScene = null;
let tutorialOverlay = null;
let tutorialContent = null;
let tutorialShown = false;

function ensureTutorialOverlay() {
    if (tutorialOverlay) return;
    tutorialOverlay = document.createElement('div');
    tutorialOverlay.id = 'tutorialOverlay';
    tutorialOverlay.setAttribute('role', 'dialog');
    tutorialOverlay.setAttribute('aria-modal', 'true');
    tutorialOverlay.setAttribute('aria-hidden', 'true');
    tutorialOverlay.innerHTML = '<div id="tutorialContent"></div>';
    document.body.appendChild(tutorialOverlay);
    tutorialContent = document.getElementById('tutorialContent');
    tutorialOverlay.addEventListener('click', closeTutorial);
}

function closeTutorial() {
    if (!tutorialOverlay) return;
    tutorialOverlay.classList.remove('open');
    tutorialOverlay.setAttribute('aria-hidden', 'true');
    tutorialShown = true;
}

async function showTutorial() {
    if (tutorialShown) return;
    ensureTutorialOverlay();
    try {
        const url = new URL('descriptions/tutorial.html', configUrl);
        const res = await fetch(url.href, {cache:'no-store'});
        if (!res.ok) return;
        const html = await res.text();
        tutorialContent.innerHTML = html;
        tutorialOverlay.classList.add('open');
        tutorialOverlay.setAttribute('aria-hidden', 'false');
    } catch(e) {
        console.warn('Tutorial load failed', e);
    }
}

function hideAllMedia() {
    youtubeContainer.classList.remove("active");
    imageContainer.classList.remove("active");
    videoContainer.classList.remove("active");

    youtubeFrame.src = "";

    hotspotImage.onload = null;
    hotspotImage.onerror = null;
    hotspotImage.removeAttribute("src");
    hotspotImage.alt = "";

    video.pause();
    video.currentTime = 0;
    videoSource.src = "";
    video.load();

    audio.pause();
    audio.currentTime = 0;
    audioSource.src = "";
    audio.load();
    audio.classList.remove("active");
    mediaOverlay.classList.remove("audio-mode");
}

function applyMediaPosition(anchor, hotSpotEl) {
    // reset to default corner
    mediaOverlay.classList.remove('pinned');
    mediaOverlay.style.left = '';
    mediaOverlay.style.top = '';
    mediaOverlay.style.right = '24px';
    mediaOverlay.style.bottom = '24px';

    if (anchor === 'hotspot' && hotSpotEl) {
        mediaOverlay.classList.add('pinned');
        mediaOverlay.style.right = 'auto';
        mediaOverlay.style.bottom = 'auto';
        // initial placement adjacent to hotspot, screen anchored
        // Defer to next frame so overlay has a measured size and is laid out
        requestAnimationFrame(() => {
            const r = hotSpotEl.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const margin = 12;
            // Use actual measured size, fall back to estimated if not yet laid out
            let width = mediaOverlay.offsetWidth || parseInt(getComputedStyle(mediaOverlay).width, 10) || 600;
            let height = mediaOverlay.offsetHeight || parseInt(getComputedStyle(mediaOverlay).height, 10) || 400;
            let left = r.right + 12;
            let top = r.top;
            // Prefer right side, flip to left if overflow
            if (left + width > vw - margin) {
                left = r.left - width - 12;
            }
            // Clamp horizontally within viewport
            left = Math.max(margin, Math.min(left, vw - width - margin));
            // Clamp vertically within viewport
            if (top + height > vh - margin) {
                top = vh - height - margin;
            }
            if (top < margin) top = margin;
            top = Math.max(margin, Math.min(top, vh - height - margin));
            mediaOverlay.style.left = left + 'px';
            mediaOverlay.style.top = top + 'px';
        });
    }
}


function openYouTube(youtubeId, title, anchor = 'corner', hotSpotEl = null) {
    if (!youtubeId) {
        console.error("YouTube hotspot has no youtubeId.");
        return;
    }

    hideAllMedia();

    youtubeFrame.src =
        "https://www.youtube.com/embed/" +
        encodeURIComponent(youtubeId) +
        "?autoplay=1&rel=0";

    youtubeContainer.classList.add("active");
    mediaTitle.textContent = title || "";
    mediaOverlay.classList.add("open");
    mediaOverlay.setAttribute("aria-hidden", "false");
    applyMediaPosition(anchor, hotSpotEl);
}


function openImage(src, title, anchor = 'corner', hotSpotEl = null) {
    if (!src) {
        console.error("Image hotspot has no imageSrc.");
        return;
    }

    hideAllMedia();

    errorElement.style.display = "none";
    hotspotImage.alt = title || "";
    mediaTitle.textContent = title || "";
    mediaOverlay.classList.add("open");
    mediaOverlay.setAttribute("aria-hidden", "false");
    applyMediaPosition(anchor, hotSpotEl);

    hotspotImage.onload = () => {
        imageContainer.classList.add("active");
        // Re-position after image size is known to keep within viewport
        requestAnimationFrame(() => applyMediaPosition(anchor, hotSpotEl));
        hotspotImage.onload = null;
        hotspotImage.onerror = null;
    };

    hotspotImage.onerror = () => {
        const message = `Unable to load image: ${src}`;
        hotspotImage.onload = null;
        hotspotImage.onerror = null;
        console.error(message);
        errorElement.textContent = message;
        errorElement.style.display = "block";
        closeMedia();
    };

    hotspotImage.src = src;
}


function openVideo(src, title, anchor = 'corner', hotSpotEl = null) {
    if (!src) {
        console.error("Video hotspot has no videoSrc.");
        return;
    }

    hideAllMedia();

    videoSource.src = src;
    mediaTitle.textContent = title || "";
    videoContainer.classList.add("active");
    video.load();
    mediaOverlay.classList.add("open");
    mediaOverlay.setAttribute("aria-hidden", "false");
    applyMediaPosition(anchor, hotSpotEl);
    video.play().catch(() => {});
}


function closeMedia() {
    hideAllMedia();
    mediaOverlay.classList.remove("open");
    mediaOverlay.classList.remove("pinned");
    mediaOverlay.setAttribute("aria-hidden", "true");
    mediaOverlay.style.left = '';
    mediaOverlay.style.top = '';
    mediaOverlay.style.right = '24px';
    mediaOverlay.style.bottom = '24px';
}


function openAudio(src, title, anchor = 'corner', hotSpotEl = null) {
    if (!src) {
        console.error("Audio hotspot has no audioSrc.");
        return;
    }

    hideAllMedia();
    audioSource.src = src;
    audio.load();
    mediaTitle.textContent = title || "";
    audio.classList.add("active");
    mediaOverlay.classList.add("open");
    mediaOverlay.classList.add("audio-mode");
    mediaOverlay.setAttribute("aria-hidden", "false");
    applyMediaPosition(anchor, hotSpotEl);
    audio.play().catch(() => {});
}


function createMediaHotspot(hotSpotDiv, args) {
    const icon = document.createElement("img");

    icon.className = "media-hotspot-icon";
    icon.src = args.icon || "../icons/video.svg";
    icon.alt = "";

    hotSpotDiv.appendChild(icon);
    hotSpotDiv.setAttribute("role", "button");
    hotSpotDiv.setAttribute("aria-label", args.title || "Play video");
}


function handleVideoClick( event, args) {
    event.stopPropagation();
    openVideo( args.src, args.title);
}


function prepareHotspot(hotspot) {
    hotspot.scale = false;

    // Scene hotspot
    if (hotspot.type === "scene") {
        const h = {...hotspot};
        const targetScene = config.scenes[h.sceneId];
        if (targetScene && targetScene.title) {
            h.text = targetScene.title;
        }
        if (h.icon) {
            const safeId = h.id.replace(/[^a-zA-Z0-9_-]/g,'');
            const className = `scene-icon-${safeId}`;
            if (!document.getElementById(`style-scene-${safeId}`)) {
                const style = document.createElement("style");
                style.id = `style-scene-${safeId}`;
                let iconUrl;
                try { iconUrl = new URL(h.icon, configUrl).href; } catch(e) { iconUrl = h.icon; }
                style.textContent = `.${className}{background-image:url("${iconUrl}") !important;}`;
                document.head.appendChild(style);
            }
            h.cssClass = `pnlm-scene ${className}`;
            delete h.createTooltipFunc;
            delete h.createTooltipArgs;
        }

        h.clickHandlerFunc = function(event, args) {
            event.stopPropagation();

            const scene = config.scenes[args.sceneId];

            openInfoAfterSceneChange = args.infoOpen ?? scene.infoOpen ?? false;
            const targetPitch = args.targetPitch ?? config.scenes[args.sceneId].defaultPitch;
            const targetYaw = args.targetYaw ?? config.scenes[args.sceneId].defaultYaw;
            const pitch = targetPitch != null ? Math.max(-90, Math.min(90, targetPitch)) : undefined;
            const yaw = targetYaw != null ? ((targetYaw % 360) + 360) % 360 : undefined;
            viewer.loadScene(
                args.sceneId,
                pitch,
                yaw,
                args.targetHfov
            );
        };

        h.clickHandlerArgs = {
            sceneId: h.sceneId,
            targetPitch: h.targetPitch,
            targetYaw: h.targetYaw,
            targetHfov: h.targetHfov,
            infoOpen: h.infoOpen
        };
        return h;
    }

    // Info hotspot
    if (hotspot.type === "info" && hotspot.icon) {
        const className = `info-icon-${crypto.randomUUID()}`;

        const style = document.createElement("style");
        style.textContent = `
            .${className} {
                background-image: url("${hotspot.icon}") !important;
            }
        `;
        document.head.appendChild(style);

        hotspot.cssClass = `pnlm-info ${className}`;
    }

    // Image hotspot
    if (hotspot.hotspotType === "image") {
        //hotspot.type = hotspot.type || "info";
        hotspot.cssClass = hotspot.cssClass || "media-hotspot";
        hotspot.createTooltipFunc = createMediaHotspot;
        hotspot.createTooltipArgs = {
            title: hotspot.imageTitle || hotspot.text || "View image",
            icon: hotspot.icon || "../icons/image.svg"
        };
        hotspot.clickHandlerFunc = function(event, args) {
            event.stopPropagation();
            const hotSpotEl = event.currentTarget || event.target.closest('.pnlm-hotspot, .pnlm-hotspot-base');
            openImage(args.src, args.title, args.anchor, hotSpotEl);
        };
        hotspot.clickHandlerArgs = {
            src: hotspot.imageSrc
            ? new URL(hotspot.imageSrc, configUrl).href
            : "",
            title: hotspot.imageTitle || hotspot.text || "",
            anchor: hotspot.mediaAnchor || 'corner'
        };
        return hotspot;
    }

    // Youtube hotspot
    if (hotspot.hotspotType === "youtube") {
        //hotspot.type = hotspot.type || "info";
        hotspot.cssClass = hotspot.cssClass || "media-hotspot";
        hotspot.createTooltipFunc = createMediaHotspot;
        hotspot.createTooltipArgs = {
            title: hotspot.mediaTitle || hotspot.text || "Play video",
            icon: hotspot.icon || "../icons/video.svg"
        };
        hotspot.clickHandlerFunc = function(event, args) {
            event.stopPropagation();
            const hotSpotEl = event.currentTarget || event.target.closest('.pnlm-hotspot, .pnlm-hotspot-base');
            openYouTube(args.youtubeId, args.title, args.anchor, hotSpotEl);
        };
        hotspot.clickHandlerArgs = {
            youtubeId: hotspot.youtubeId,
            title: hotspot.mediaTitle || hotspot.text || "",
            anchor: hotspot.mediaAnchor || 'corner'
        };
        return hotspot;
    }

    // local video hotspot
    if (hotspot.hotspotType === "video") {
        //hotspot.type = hotspot.type || "info";
        hotspot.cssClass = hotspot.cssClass || "media-hotspot";
        hotspot.createTooltipFunc = createMediaHotspot;
        hotspot.createTooltipArgs = {
            title: hotspot.mediaTitle || hotspot.text || "Play video",
            icon: hotspot.icon || "../icons/video.svg"
        };
        hotspot.clickHandlerFunc = function(event, args) {
            event.stopPropagation();
            const hotSpotEl = event.currentTarget || event.target.closest('.pnlm-hotspot, .pnlm-hotspot-base');
            openVideo(args.src, args.title, args.anchor, hotSpotEl);
        };
        hotspot.clickHandlerArgs = {
            src: hotspot.videoSrc
            ? new URL(hotspot.videoSrc, configUrl).href
            : "",
            title: hotspot.mediaTitle || hotspot.text || "",
            anchor: hotspot.mediaAnchor || 'corner'
        };
        return hotspot;
    }

    // local audio hotspot
    if (hotspot.hotspotType === "audio") {
        //hotspot.type = hotspot.type || "info";
        hotspot.cssClass = hotspot.cssClass || "media-hotspot";
        hotspot.createTooltipFunc = createMediaHotspot;
        hotspot.createTooltipArgs = {
            title: hotspot.audioTitle || hotspot.text || "Play audio",
            icon: hotspot.icon || "../icons/audio.svg"
        };
        hotspot.clickHandlerFunc = function(event, args) {
            event.stopPropagation();
            const hotSpotEl = event.currentTarget || event.target.closest('.pnlm-hotspot, .pnlm-hotspot-base');
            openAudio(args.src, args.title, args.anchor, hotSpotEl);
        };
        hotspot.clickHandlerArgs = {
            src: hotspot.audioSrc
            ? new URL(hotspot.audioSrc, configUrl).href
            : "",
            title: hotspot.audioTitle || hotspot.text || "",
            anchor: hotspot.mediaAnchor || 'corner'
        };
        return hotspot;
    }

    return hotspot;
}


function currentSceneConfig() {
    return config.scenes[viewer.getScene()];
}


function hotspotIsVisible(hotspot) {
    // No selected slate means no filtering: show every hotspot.
    if (currentSlate === null) {
        return true;
    }

    // Hotspots with no slate membership are always visible.
    if (!Array.isArray(hotspot.slates)) {
        return true;
    }

    return hotspot.slates.includes(currentSlate);
}


function getVisibleHotspots(sceneId) {
    const scene = viewerConfig.scenes[sceneId];

    if (!scene || !Array.isArray(scene.allHotSpots)) {
        return [];
    }

    return scene.allHotSpots.filter(hotspotIsVisible);
}

function applySlate() {
    const sceneId = viewer.getScene();
    if (lastAppliedScene === sceneId && lastAppliedSlate === currentSlate) {
        return;
    }
    const visibleHotspots = getVisibleHotspots(sceneId);
    const wantedIds = new Set(visibleHotspots.map(h => h.id));

    // Remove hotspots no longer wanted
    activeHotspotIds.forEach(id => {
        if (!wantedIds.has(id)) {
            try { viewer.removeHotSpot(id, sceneId); } catch(e){}
            activeHotspotIds.delete(id);
        }
    });

    // Mark as in-progress to prevent re-entrancy
    lastAppliedScene = sceneId;
    lastAppliedSlate = currentSlate;

    // Defer add to allow removals to settle
    setTimeout(() => {
        visibleHotspots.forEach(hotspot => {
            if (!activeHotspotIds.has(hotspot.id)) {
                // Shallow clone to give Pannellum a fresh object reference while keeping functions
                const clone = Object.assign({}, hotspot);
                viewer.addHotSpot(clone, sceneId);
                activeHotspotIds.add(hotspot.id);
            }
        });
    }, 0);
}


function setSlate(slate) {
    currentSlate = slate;
    applySlate();
    renderSlateButtons();
}


function getSlateEntries(scene) {
    return Object.entries(scene?.hotSpotSlates || {});
}


function getDefaultSlate(scene) {
    if (
        scene?.defaultHotSpotSlate &&
        scene?.hotSpotSlates?.[scene.defaultHotSpotSlate]
    ) {
        return scene.defaultHotSpotSlate;
    }
    return null;
}


function renderSlateButtons() {
    slateControls.replaceChildren();

    const scene = currentSceneConfig();
    const entries = getSlateEntries(scene);

    if (entries.length === 0) {
        slateControls.hidden = true;
        return;
    }

    // All button
    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.textContent = "All";
    allButton.classList.toggle("active", currentSlate === null);
    allButton.setAttribute( "aria-pressed", String(currentSlate === null));
    allButton.addEventListener("click", () => setSlate(null));
    slateControls.appendChild(allButton);

    // Named slates
    entries.forEach(([id, slate]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.toggle("active", id === currentSlate);
        button.setAttribute("aria-pressed", String(id === currentSlate));
        button.title = slate.title || slate.label || id;

        const label = document.createElement("span");
        label.textContent = slate.label || id;
        button.appendChild(label);

        button.addEventListener("click", () => setSlate(id));
        slateControls.appendChild(button);
    });

    slateControls.hidden = false;
}


async function openDescription() {
    const sceneId = viewer.getScene();
    const scene = viewerConfig.scenes[sceneId];

    descriptionTitle.textContent = scene.title || "";
    descriptionContent.replaceChildren();

    if (scene.descriptionFile) {
        try {
            const url = new URL(scene.descriptionFile, viewerConfig.configUrl);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(
                    `Unable to load description: ${response.status}`
                );
            }

            descriptionContent.innerHTML = await response.text();
        }
        catch (error) {
            console.error(error);
            descriptionContent.textContent = "Unable to load description.";
        }
    }
    else {
        descriptionContent.textContent = scene.description || "";
    }

    descriptionOverlay.classList.add("open");
    descriptionOverlay.setAttribute("aria-hidden", "false");

    // If scene is gated and locked, show gate prompt inside description
    const effective = getEffectiveGatedConfig(scene);
    if (effective?.enabled && !unlockedScenes.has(sceneId)) {
        showGatePrompt(scene);
    } else {
        hideGatePrompt();
    }
}


function closeDescription() {
    descriptionOverlay.classList.remove("open");
    descriptionOverlay.setAttribute("aria-hidden", "true");
}


async function loadDataLayer(sceneId) {
    const scene = viewerConfig?.scenes?.[sceneId];
    const dl = scene?.dataLayer;
    if (!dl || dl.mode !== 'regions') { clearData(); return; }
    if (!dataMode) return;

    // Clear stale data immediately so old hits don't linger while fetching
    clearData();

    try {
        const srcUrl = new URL(dl.source, configUrl);
        srcUrl.searchParams.set('_t', Date.now());
        const res = await fetch(srcUrl.href, {cache: 'no-store'});
        if (!res.ok) throw new Error(`Data load ${res.status}`);
        const regions = await res.json();
        dataState = {regions, unit: dl.unit || ''};
    } catch(e) {
        console.error('Data regions load failed', e);
        clearData();
    }
}


function yawDiff(a, b) {
    let d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
}


function closeEnough(p1, p2, yawLim, pitchLim) {
    return yawDiff(p1.yaw, p2.yaw) <= yawLim &&
        Math.abs(p1.pitch - p2.pitch) <= pitchLim;
}


function handleDataPointer() {
    if (!dataMode || !dataState.regions?.length) {
        dataReadout.hidden = true;
        return;
    }
    const pt = {yaw: viewer.getYaw(), pitch: viewer.getPitch()};
    const hits = [];

    for (const r of dataState.regions) {
        if (r.yaw != null && r.pitch != null && r.yawLim != null && r.pitchLim != null) {
            if (closeEnough(pt, { yaw: r.yaw, pitch: r.pitch }, r.yawLim, r.pitchLim)) {
                hits.push(r);
            }
        }
    }

    if (!hits.length) { dataReadout.hidden = true; return; }

    dataReadout.hidden = false;
    dataReadout.innerHTML = hits.map(r => 
        `<div><strong>${r.label || r.id}</strong><br>
         ${r.value}${dataState.unit ? ' '+dataState.unit : ''}</div>`
    ).join('<hr style="margin:8px 0;opacity:.3">');
}


function clearData() {
    dataState = {regions: [], unit: ''};
    if (dataReadout) {
        dataReadout.hidden = true;
        dataReadout.textContent = '';
    }
}

function updateDataButtonVisibility() {
    if (!dataButton || !viewer || !viewerConfig) return;
    const sceneId = viewer.getScene();
    const scene = viewerConfig.scenes?.[sceneId];
    const hasData = !!scene?.dataLayer && scene.dataLayer.mode === 'regions' && !!scene.dataLayer.source;
    dataButton.style.display = hasData ? '' : 'none';
    // If we left a data scene, reset data mode and hide indicators
    if (!hasData && dataMode) {
        dataMode = false;
        dataButton.classList.remove('active');
        dataButton.setAttribute('aria-pressed', 'false');
        clearData();
        if (dataCenterIndicator) dataCenterIndicator.style.display = 'none';
    }
}

function createGatePromptInDesc() {
    if (gatePromptInDesc) return;
    gatePromptInDesc = document.createElement('div');
    gatePromptInDesc.id = 'gatePromptInDesc';
    gatePromptInDesc.className = 'gate-prompt-in-desc';
    gatePromptInDesc.setAttribute('aria-hidden','true');
    gatePromptInDesc.innerHTML = `
      <div class="gate-prompt-box">
        <div id="gatePromptText" class="gate-prompt-text"></div>
        <div id="gatePromptInputWrap" class="gate-prompt-input-wrap" style="display:none">
          <input id="gatePromptInput" type="text" class="gate-prompt-input" placeholder="" />
        </div>
        <div class="gate-prompt-actions">
          <button id="gatePromptSubmit" type="button" class="gate-prompt-btn primary">Continue</button>
        </div>
      </div>`;
    // Append inside description overlay, after descriptionContent
    if (descriptionOverlay) {
      descriptionOverlay.appendChild(gatePromptInDesc);
    } else {
      document.body.appendChild(gatePromptInDesc);
    }
    document.getElementById('gatePromptSubmit').addEventListener('click', () => handleGateSubmit());
}

function showGatePrompt(sceneConfig) {
    if (!gatePromptInDesc) return;
    const textEl = document.getElementById('gatePromptText');
    const inputWrap = document.getElementById('gatePromptInputWrap');
    const input = document.getElementById('gatePromptInput');
    const effective = getEffectiveGatedConfig(sceneConfig);
    const basePrompt = effective?.prompt || {};
    const overridePrompt = sceneConfig?.prompt || {};
    const promptCfg = { ...basePrompt, ...overridePrompt };
    textEl.textContent = promptCfg.text || 'Complete the step to continue.';
    if (promptCfg.type === 'text') {
        inputWrap.style.display = 'block';
        input.placeholder = promptCfg.placeholder || '';
        input.value = '';
        input.focus();
    } else {
        inputWrap.style.display = 'none';
    }
    gatePromptInDesc.setAttribute('aria-hidden','false');
    gatePromptInDesc.style.display = '';
}

function hideGatePrompt() {
    if (!gatePromptInDesc) return;
    gatePromptInDesc.setAttribute('aria-hidden','true');
    gatePromptInDesc.style.display = 'none';
}

function handleGateSubmit() {
    if (!viewer) return;
    const sceneId = viewer.getScene();
    const scene = viewerConfig?.scenes?.[sceneId];
    const effective = getEffectiveGatedConfig(scene);
    if (!effective?.enabled) { hideGatePrompt(); return; }
    // Optionally capture text
    const input = document.getElementById('gatePromptInput');
    const textValue = input ? input.value.trim() : '';
    // Mark unlocked
    unlockedScenes.add(sceneId);
    hideGatePrompt();
    const unlockedSlate = effective.unlockedSlate || 'full';
    setSlate(unlockedSlate);

    // Recenter view if scene defines gateRecenter
    const recenter = scene?.gateRecenter || scene?.gatedMode?.recenter;
    if (recenter && typeof recenter === 'object') {
        const pitch = recenter.pitch ?? recenter.p;
        const yaw = recenter.yaw ?? recenter.y;
        const hfov = recenter.hfov ?? recenter.fov;
        if (pitch != null && yaw != null) {
            try {
                // Defer to next frame so slate change settles
                requestAnimationFrame(() => {
                    viewer.setPitch(Number(pitch));
                    viewer.setYaw(Number(yaw));
                    if (hfov != null) viewer.setHfov(Number(hfov));
                });
            } catch(e) {
                console.warn('gateRecenter failed', e);
            }
        }
    }
}

function getEffectiveGatedConfig(scene) {
    if (!gatedModeConfig) return null;
    const top = gatedModeConfig;
    const sceneGated = scene?.gatedMode;
    const enabled = sceneGated?.enabled ?? top.enabled;
    if (!enabled) return null;
    return {
        enabled: true,
        initialSlate: sceneGated?.initialSlate || top.initialSlate || 'intro',
        unlockedSlate: sceneGated?.unlockedSlate || top.unlockedSlate || 'full',
        prompt: sceneGated?.prompt || top.prompt || { type:'button', text:'Continue to view more content.' },
        defaultHiddenTypes: sceneGated?.defaultHiddenTypes || top.defaultHiddenTypes || ['video','scene']
    };
}

async function checkGateForScene() {
    if (!viewer || !viewerConfig || !gatedModeConfig) { hideGatePrompt(); return; }
    const sceneId = viewer.getScene();
    const scene = viewerConfig.scenes[sceneId];
    const effective = getEffectiveGatedConfig(scene);
    if (!effective?.enabled) { hideGatePrompt(); return; }
    if (unlockedScenes.has(sceneId)) {
        // ensure unlocked slate
        const unlockedSlate = effective.unlockedSlate || 'full';
        if (currentSlate !== unlockedSlate) setSlate(unlockedSlate);
        hideGatePrompt();
        return;
    }
    // locked
    const initialSlate = effective.initialSlate || 'intro';
    if (currentSlate !== initialSlate) setSlate(initialSlate);
    // Ensure description is loaded before showing gate prompt
    await openDescription();
    // openDescription already handles showing/hiding gate prompt
}

async function initializeViewer() {
    try {
        configUrl = new URL("vfe.json", document.baseURI);
        configUrl.searchParams.set('_t', Date.now());
        const response = await fetch(configUrl.href, {cache: 'no-store'});

        if (!response.ok) {
            throw new Error(`Unable to load json: ${response.status}`);
        }

        config = await response.json();
        config.configUrl = configUrl;

        gatedModeConfig = config.gatedMode || null;

        // Preprocess gated mode hotspot slates
        if (gatedModeConfig?.enabled) {
            const top = gatedModeConfig;
            const initialSlate = top.initialSlate || 'intro';
            const unlockedSlate = top.unlockedSlate || 'full';
            const hiddenTypes = top.defaultHiddenTypes || ['video','scene'];
            Object.values(config.scenes).forEach(scene => {
                // ensure scene has a defaultHotSpotSlate for gated entry
                if (!scene.defaultHotSpotSlate && scene.gatedMode?.enabled !== false) {
                    scene.defaultHotSpotSlate = initialSlate;
                }
                (scene.hotSpots || []).forEach(hs => {
                    const isSceneNav = hs.type === 'scene';
                    const isVideo = hs.hotspotType === 'video' || hs.hotspotType === 'youtube';
                    const isAudio = hs.hotspotType === 'audio';
                    const matches = (hiddenTypes.includes('scene') && isSceneNav) ||
                                    (hiddenTypes.includes('video') && isVideo) ||
                                    (hiddenTypes.includes('audio') && isAudio);
                    if (matches) {
                        if (!Array.isArray(hs.slates)) hs.slates = [];
                        if (!hs.slates.includes(unlockedSlate)) hs.slates.push(unlockedSlate);
                        // ensure not visible in initial slate by default
                        hs.slates = hs.slates.filter(s => s !== initialSlate);
                    }
                });
            });
        }

        // override default scene load before initial
        Object.values(config.scenes).forEach(scene => {
            if (scene.pitch == null && scene.defaultPitch != null) {
                scene.pitch = scene.defaultPitch;
            }
            if (scene.yaw == null && scene.defaultYaw != null) {
                scene.yaw = scene.defaultYaw;
            }
            scene.allHotSpots = (scene.hotSpots || []).map(prepareHotspot);
            scene.hotSpots = [];
        })
        openInfoAfterSceneChange = config.scenes[config.default.firstScene]?.infoOpen === true;

        viewerConfig = config;
        viewer = pannellum.viewer("panorama", config);

        const descriptionButton = document.createElement("div");

        descriptionButton.className =
            "pnlm-controls pnlm-description-toggle";

        descriptionButton.setAttribute("role", "button");
        descriptionButton.setAttribute("tabindex", "0");
        descriptionButton.setAttribute("aria-label", "Scene description");
        descriptionButton.textContent = "i";

        descriptionButton.addEventListener("click", () => {
            if (descriptionOverlay.classList.contains("open")) {
                closeDescription();
            } else {
                openDescription();
            }
        });

        descriptionButton.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (descriptionOverlay.classList.contains("open")) {
                    closeDescription();
                } else {
                openDescription();
                }
            }
        });

        document
            .querySelector(".pnlm-controls-container")
            .appendChild(descriptionButton);

        // Data toggle button
        dataButton = document.createElement('div');
        dataButton.className = 'pnlm-controls pnlm-data-toggle';
        dataButton.setAttribute('role','button');
        dataButton.setAttribute('tabindex','0');
        dataButton.setAttribute('aria-label','Toggle data layer');
        dataButton.textContent = 'D';
        dataButton.addEventListener('click', () => {
            dataMode = !dataMode;
            dataButton.classList.toggle('active', dataMode);
            dataButton.setAttribute('aria-pressed', String(dataMode));
            if (dataMode) {
                loadDataLayer(viewer.getScene());
                if (dataCenterIndicator) dataCenterIndicator.style.display = 'block';
            } else {
                clearData();
                if (dataCenterIndicator) dataCenterIndicator.style.display = 'none';
            }
        });
        dataButton.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dataButton.click();
            }
        });
        document.querySelector('.pnlm-controls-container').appendChild(dataButton);

        if (gatedModeConfig?.enabled) {
            createGatePromptInDesc();
        }

        viewer.on("scenechange", () => {
            closeMedia();
            closeDescription();
            // Remove hotspots from the scene we are leaving to avoid duplicates
            if (lastSceneId) {
                activeHotspotIds.forEach(id => {
                    try { viewer.removeHotSpot(id, lastSceneId); } catch(e){}
                });
            }
            activeHotspotIds.clear();
            currentSlate = getDefaultSlate(currentSceneConfig());
            renderSlateButtons();
            clearData();
            updateDataButtonVisibility();
            checkGateForScene();
        });

        viewer.on("load", () => {
            activeHotspotIds.clear();
            applySlate();

            if (openInfoAfterSceneChange) {
                openDescription();
                openInfoAfterSceneChange = false;
            }
            if (dataMode) {
                loadDataLayer(viewer.getScene());
            }
            openInfoAfterSceneChange = false;
            lastSceneId = viewer.getScene();
            updateDataButtonVisibility();
            checkGateForScene();

            // Show tutorial once on initial scene load
            if (!tutorialShown && viewer.getScene() === config?.default?.firstScene) {
                showTutorial();
            }
        });
        currentSlate = getDefaultSlate(currentSceneConfig());
        renderSlateButtons();
        updateDataButtonVisibility();
        checkGateForScene();
    }
    catch (error) {
        console.error(error);
        errorElement.textContent = error.message;
        errorElement.style.display = "block";
    }
}


closeMediaButton.addEventListener(
    "click",
    closeMedia
);


closeDescriptionButton.addEventListener(
    "click",
    closeDescription
);

// Drag media overlay by title bar
mediaTitle.addEventListener('pointerdown', (e) => {
    if (!mediaOverlay.classList.contains('open')) return;
    if (e.pointerType !== 'mouse') return;
    dragState.active = true;
    const rect = mediaOverlay.getBoundingClientRect();
    dragState.offsetX = e.clientX - rect.left;
    dragState.offsetY = e.clientY - rect.top;
    try { mediaTitle.setPointerCapture(e.pointerId); } catch {}
});

window.addEventListener('pointermove', (e) => {
    if (!dragState.active) return;
    if (!mediaOverlay.classList.contains('pinned')) {
        mediaOverlay.classList.add('pinned');
        mediaOverlay.style.right = 'auto';
        mediaOverlay.style.bottom = 'auto';
    }
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = e.clientX - dragState.offsetX;
    let top  = e.clientY - dragState.offsetY;
    left = Math.max(margin, Math.min(left, vw - mediaOverlay.offsetWidth - margin));
    top  = Math.max(margin, Math.min(top,  vh - mediaOverlay.offsetHeight - margin));
    mediaOverlay.style.left = left + 'px';
    mediaOverlay.style.top  = top + 'px';
});

window.addEventListener('pointerup', () => {
    dragState.active = false;
});

// Keep pinned media overlay within viewport on resize
window.addEventListener('resize', () => {
    if (mediaOverlay.classList.contains('open') && mediaOverlay.classList.contains('pinned')) {
        const margin = 12;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const width = mediaOverlay.offsetWidth || 600;
        const height = mediaOverlay.offsetHeight || 400;
        let left = parseFloat(mediaOverlay.style.left || '0');
        let top = parseFloat(mediaOverlay.style.top || '0');
        left = Math.max(margin, Math.min(left, vw - width - margin));
        top = Math.max(margin, Math.min(top, vh - height - margin));
        mediaOverlay.style.left = left + 'px';
        mediaOverlay.style.top = top + 'px';
    }
});

document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
        if (mediaOverlay.classList.contains("open")) {
            closeMedia();
        }

        if (descriptionOverlay.classList.contains("open")) {
            closeDescription();
        }
    }
});


panorama.addEventListener("keydown", function(event) {
    if (event.key === "Shift" || event.key === "Control") {
        event.stopImmediatePropagation();
    }
}, true);

panorama.addEventListener("pointermove", () => {
    if (dataMode) handleDataPointer();
})


initializeViewer();
