let viewer;
let config;
let configUrl;
let currentSlate = null;
let activeHotspotIds = [];

const mediaOverlay = document.getElementById("mediaOverlay");
const video = document.getElementById("video");
const videoSource = document.getElementById("videoSource");
const videoTitle = document.getElementById("videoTitle");
const closeVideoButton = document.getElementById("closeVideo");
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


function openYouTube(youtubeId, title) {
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
    videoTitle.textContent = title || "";
    mediaOverlay.classList.add("open");
    mediaOverlay.setAttribute("aria-hidden", "false");
}


function openImage(src, title) {
    if (!src) {
        console.error("Image hotspot has no imageSrc.");
        return;
    }

    hideAllMedia();

    errorElement.style.display = "none";
    hotspotImage.alt = title || "";
    videoTitle.textContent = title || "";
    mediaOverlay.classList.add("open");
    mediaOverlay.setAttribute("aria-hidden", "false");

    hotspotImage.onload = () => {
        imageContainer.classList.add("active");
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
        closeVideo();
    };

    hotspotImage.src = src;
}


function openVideo(src, title) {
    if (!src) {
        console.error("Video hotspot has no videoSrc.");
        return;
    }

    hideAllMedia();

    videoSource.src = src;
    videoTitle.textContent = title || "";
    videoContainer.classList.add("active");
    video.load();
    mediaOverlay.classList.add("open");
    mediaOverlay.setAttribute("aria-hidden", "false");
    video.play().catch(() => {});
}


function closeVideo() {
    hideAllMedia();
    mediaOverlay.classList.remove("open");
    mediaOverlay.setAttribute("aria-hidden", "true");
}


function openAudio(src, title) {
    if (!src) {
        console.error("Audio hotspot has no audioSrc.");
        return;
    }

    hideAllMedia();
    audioSource.src = src;
    audio.load();
    videoTitle.textContent = title || "";
    audio.classList.add("active");
    mediaOverlay.classList.add("open");
    mediaOverlay.classList.add("audio-mode");
    mediaOverlay.setAttribute("aria-hidden", "false");
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
        if (hotspot.icon) {
            hotspot.type = "info";
            hotspot.cssClass = "media-hotspot";
            hotspot.createTooltipFunc = createMediaHotspot;
            hotspot.createTooltipArgs = {
                title:
                hotspot.sceneTitle ||
                hotspot.text ||
                "Go to scene",
                icon: hotspot.icon
            };
        }

        hotspot.clickHandlerFunc = function(event, args) {
            event.stopPropagation();
            viewer.loadScene(
                args.sceneId,
                args.targetPitch,
                args.targetYaw,
                args.targetHfov
            );
        };

        hotspot.clickHandlerArgs = {
            sceneId: hotspot.sceneId,
            targetPitch: hotspot.targetPitch,
            targetYaw: hotspot.targetYaw,
            targetHfov: hotspot.targetHfov
        };
        return hotspot;
    }

    // Image hotspot
    if (hotspot.hotspotType === "image") {
        hotspot.type = hotspot.type || "info";
        hotspot.cssClass = hotspot.cssClass || "media-hotspot";
        hotspot.createTooltipFunc = createMediaHotspot;
        hotspot.createTooltipArgs = {
            title: hotspot.imageTitle || hotspot.text || "View image",
            icon: hotspot.icon || "../icons/image.svg"
        };
        hotspot.clickHandlerFunc = function(event, args) {
            event.stopPropagation();
            openImage( args.src, args.title);
        };
        hotspot.clickHandlerArgs = {
            src: hotspot.imageSrc
            ? new URL(hotspot.imageSrc, configUrl).href
            : "",
            title: hotspot.imageTitle || hotspot.text || ""
        };
        return hotspot;
    }

    // Youtube hotspot
    if (hotspot.hotspotType === "youtube") {
        hotspot.type = hotspot.type || "info";
        hotspot.cssClass = hotspot.cssClass || "media-hotspot";
        hotspot.createTooltipFunc = createMediaHotspot;
        hotspot.createTooltipArgs = {
            title: hotspot.videoTitle || hotspot.text || "Play video"
        };
        hotspot.clickHandlerFunc = function(event, args) {
            event.stopPropagation();
            openYouTube( args.youtubeId, args.title);
        };
        hotspot.clickHandlerArgs = {
            youtubeId: hotspot.youtubeId,
            title: hotspot.videoTitle || hotspot.text || ""
        };
        return hotspot;
    }

    // local video hotspot
    if (hotspot.hotspotType === "video") {
        hotspot.type = hotspot.type || "info";
        hotspot.cssClass = hotspot.cssClass || "media-hotspot";
        hotspot.createTooltipFunc = createMediaHotspot;
        hotspot.createTooltipArgs = {
            title: hotspot.videoTitle || hotspot.text || "Play video"
        };
        hotspot.clickHandlerFunc = function(event, args) {
            event.stopPropagation();
            openVideo( args.src, args.title
            );
        };
        hotspot.clickHandlerArgs = {
            src: hotspot.videoSrc
            ? new URL(hotspot.videoSrc, configUrl).href
            : "",
            title: hotspot.videoTitle || hotspot.text || ""
        };
        return hotspot;
    }

    // local audio hotspot
    if (hotspot.hotspotType === "audio") {
        hotspot.type = hotspot.type || "info";
        hotspot.cssClass = hotspot.cssClass || "media-hotspot";
        hotspot.createTooltipFunc = createMediaHotspot;
        hotspot.createTooltipArgs = {
            title: hotspot.audioTitle || hotspot.text || "Play audio",
            icon: hotspot.icon || "../icons/audio.svg"
        };
        hotspot.clickHandlerFunc = function(event, args) {
            event.stopPropagation();
            openAudio( args.src, args.title
            );
        };
        hotspot.clickHandlerArgs = {
            src: hotspot.audioSrc
            ? new URL(hotspot.audioSrc, configUrl).href
            : "",
            title: hotspot.audioTitle || hotspot.text || ""
        };
        return hotspot;
    }

    return hotspot;
}


function currentSceneConfig() {
    return config.scenes[viewer.getScene()];
}


function getSlateEntries(scene) {
    return Object.entries(scene?.hotSpotSlates || {});
}


function getDefaultSlate(scene) {
    const entries = getSlateEntries(scene);

    if (entries.length === 0) {
        return null;
    }

    if (scene.defaultHotSpotSlate && scene.hotSpotSlates[scene.defaultHotSpotSlate]) {
        return scene.defaultHotSpotSlate;
    }

    return entries[0][0];
}

function renderSlateButtons() {
    slateControls.replaceChildren();

    const scene = currentSceneConfig();
    const entries = getSlateEntries(scene);

    if (entries.length <= 1) {
        slateControls.hidden = true;
        return;
    }

    entries.forEach(([id, slate]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.toggle("active", id === currentSlate);
        button.setAttribute("aria-pressed", String(id === currentSlate));
        button.title = slate.title || slate.label || id;

        if (slate.icon) {
            const icon = document.createElement("img");
            icon.src = new URL(slate.icon, configUrl).href;
            icon.alt = "";
            button.appendChild(icon);
        }

        const label = document.createElement("span");
        label.textContent = slate.label || id;
        button.appendChild(label);

        button.addEventListener("click", () => loadSlate(id));
        slateControls.appendChild(button);
    });

    slateControls.hidden = entries.length <= 1;
}

function removeActiveHotspots() {
    const sceneId = viewer.getScene();

    activeHotspotIds.forEach((id) => {
        viewer.removeHotSpot(id, sceneId);
    });

    activeHotspotIds = [];
}

function loadSlate(name) {
    const scene = currentSceneConfig();
    const slate = scene?.hotSpotSlates?.[name];

    if (!slate) {
        return;
    }

    removeActiveHotspots();

    (slate.hotSpots || []).forEach((hotspot) => {
        viewer.addHotSpot(prepareHotspot({ ...hotspot }));
        activeHotspotIds.push(hotspot.id);
    });

    currentSlate = name;
    renderSlateButtons();
}

async function initializeViewer() {
    try {
        configUrl = new URL("vfe.json", document.baseURI);
        const response = await fetch(configUrl);

        if (!response.ok) {
            throw new Error(`Unable to load json: ${response.status}`);
        }

        config = await response.json();

        // Do not give Pannellum a static hotSpots array. The selected slate
        // is installed after the viewer is created through the API.
        Object.values(config.scenes).forEach((scene) => {
            delete scene.hotSpots;
        });

        viewer = pannellum.viewer("panorama", config);

        viewer.on("scenechange", () => {
            closeVideo();
            currentSlate = getDefaultSlate(currentSceneConfig());
            renderSlateButtons();
            if (currentSlate) {
                loadSlate(currentSlate);
            }
        });

        currentSlate = getDefaultSlate(currentSceneConfig());
        renderSlateButtons();
        if (currentSlate) {
            loadSlate(currentSlate);
        }
    }
    catch (error) {
        console.error(error);
        errorElement.textContent = error.message;
        errorElement.style.display = "block";
    }
}





closeVideoButton.addEventListener(
    "click",
    closeVideo
);

document.addEventListener("keydown", function(event) {
    if (
        event.key === "Escape" &&
        mediaOverlay.classList.contains("open")
    ) {
        closeVideo();
    }
});

panorama.addEventListener("keydown", function(event) {
    if (event.key === "Shift" || event.key === "Control") {
        event.stopImmediatePropagation();
    }
}, true);

initializeViewer();
