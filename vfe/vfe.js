let viewer;
let viewerConfig;
let config;
let configUrl;
let currentSlate = null;
let activeHotspotIds = new Set();
let openInfoAfterSceneChange = false;

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
    mediaTitle.textContent = title || "";
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
    mediaTitle.textContent = title || "";
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
        closeMedia();
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
    mediaTitle.textContent = title || "";
    videoContainer.classList.add("active");
    video.load();
    mediaOverlay.classList.add("open");
    mediaOverlay.setAttribute("aria-hidden", "false");
    video.play().catch(() => {});
}


function closeMedia() {
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
    mediaTitle.textContent = title || "";
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
            //hotspot.type = "info";
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

            const scene = config.scenes[args.sceneId];

            openInfoAfterSceneChange = args.infoOpen ?? scene.infoOpen ?? false;
            viewer.loadScene(
                args.sceneId,
                args.targetPitch ?? config.scenes[args.sceneId].defaultPitch,
                args.targetYaw ?? config.scenes[args.sceneId].defaultYaw,
                args.targetHfov
            );
        };

        hotspot.clickHandlerArgs = {
            sceneId: hotspot.sceneId,
            targetPitch: hotspot.targetPitch,
            targetYaw: hotspot.targetYaw,
            targetHfov: hotspot.targetHfov,
            infoOpen: hotspot.infoOpen
        };
        return hotspot;
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
        //hotspot.type = hotspot.type || "info";
        hotspot.cssClass = hotspot.cssClass || "media-hotspot";
        hotspot.createTooltipFunc = createMediaHotspot;
        hotspot.createTooltipArgs = {
            title: hotspot.mediaTitle || hotspot.text || "Play video",
            icon: hotspot.icon || "../icons/video.svg"
        };
        hotspot.clickHandlerFunc = function(event, args) {
            event.stopPropagation();
            openYouTube( args.youtubeId, args.title);
        };
        hotspot.clickHandlerArgs = {
            youtubeId: hotspot.youtubeId,
            title: hotspot.mediaTitle || hotspot.text || ""
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
            openVideo( args.src, args.title
            );
        };
        hotspot.clickHandlerArgs = {
            src: hotspot.videoSrc
            ? new URL(hotspot.videoSrc, configUrl).href
            : "",
            title: hotspot.mediaTitle || hotspot.text || ""
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
    const visibleHotspots = getVisibleHotspots(sceneId);
    const wantedIds = new Set(visibleHotspots.map(hotspot => hotspot.id));

    activeHotspotIds.forEach(id => {
        if (!wantedIds.has(id)) {
            viewer.removeHotSpot(id, sceneId);
            activeHotspotIds.delete(id);
        }
    });

    visibleHotspots.forEach(hotspot => {
        if (!activeHotspotIds.has(hotspot.id)) {
            viewer.addHotSpot(hotspot, sceneId);
            activeHotspotIds.add(hotspot.id);
        }
    });
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
}


function closeDescription() {
    descriptionOverlay.classList.remove("open");
    descriptionOverlay.setAttribute("aria-hidden", "true");
}


async function initializeViewer() {
    try {
        configUrl = new URL("vfe.json", document.baseURI);
        const response = await fetch(configUrl);

        if (!response.ok) {
            throw new Error(`Unable to load json: ${response.status}`);
        }

        config = await response.json();
        config.configUrl = configUrl;

        // override default scene load before initial
        Object.values(config.scenes).forEach(scene => {
            if (scene.pitch == null & scene.defaultPitch != null) {
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

        viewer.on("scenechange", () => {
            closeMedia();
            closeDescription();
            activeHotspotIds.clear();
            currentSlate = getDefaultSlate(currentSceneConfig());
            renderSlateButtons();
        });

        viewer.on("load", () => {
            activeHotspotIds.clear();
            applySlate();

            if (openInfoAfterSceneChange) {
                openDescription();
                openInfoAfterSceneChange = false;
            }

            openInfoAfterSceneChange = false;
        });

        currentSlate = getDefaultSlate(currentSceneConfig());
        renderSlateButtons();
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


initializeViewer();
