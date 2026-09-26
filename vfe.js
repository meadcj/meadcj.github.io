
const videoOverlay = document.getElementById("videoOverlay");
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

    videoOverlay.classList.add("open");
    videoOverlay.setAttribute("aria-hidden", "false");
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
    videoOverlay.classList.add("open");
    videoOverlay.setAttribute("aria-hidden", "false");

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

    videoOverlay.classList.add("open");
    videoOverlay.setAttribute("aria-hidden", "false");

    video.play().catch(() => {});
}


function closeVideo() {
    hideAllMedia();
    videoOverlay.classList.remove("open");
    videoOverlay.setAttribute("aria-hidden", "true");
}



function createMediaHotspot(
    hotSpotDiv,
    args
) {

    const icon = document.createElement("img");

    icon.className = "media-hotspot-icon";
    icon.src = args.icon || "icons/video.svg";
    icon.alt = "";

    hotSpotDiv.appendChild(icon);

    hotSpotDiv.setAttribute(
        "role",
        "button"
    );

    hotSpotDiv.setAttribute(
        "aria-label",
        args.title || "Play video"
    );
}


function handleVideoClick(
    event,
    args
) {

    event.stopPropagation();

    openVideo(
        args.src,
        args.title
    );
}


function prepareConfig(config, configUrl) {
    if (!config.scenes) {
        return config;
    }

    Object.values(config.scenes).forEach(scene => {
        if (!Array.isArray(scene.hotSpots)) {
            return;
        }
        scene.hotSpots.forEach(hotspot => {
            hotspot.scale = false;

            // IMAGE HOTSPOT
            if (hotspot.hotspotType === "image") {
                hotspot.type = hotspot.type || "info";
                hotspot.cssClass = hotspot.cssClass || "media-hotspot";
                hotspot.createTooltipFunc = createMediaHotspot;
                hotspot.createTooltipArgs = {
                    title: hotspot.imageTitle ||
                    hotspot.text ||
                    "View image",
                    icon: hotspot.icon || "icons/image.svg"
                };

                hotspot.clickHandlerFunc =
                    function(event, args) {
                        event.stopPropagation();
                        openImage(
                            args.src,
                            args.title
                        );
                    };

                hotspot.clickHandlerArgs = {
                    src: hotspot.imageSrc
                    ? new URL(hotspot.imageSrc, configUrl).href
                    : "",
                    title:
                    hotspot.imageTitle ||
                    hotspot.text ||
                    ""
                };
            }

            // YOUTUBE HOTSPOT
            else if (hotspot.hotspotType === "youtube") {
                hotspot.type = hotspot.type || "info";
                hotspot.cssClass =
                    hotspot.cssClass || "media-hotspot";
                hotspot.createTooltipFunc = createMediaHotspot;
                hotspot.createTooltipArgs = {
                    title:
                    hotspot.videoTitle ||
                    hotspot.text ||
                    "Play video"
                };

                hotspot.clickHandlerFunc =
                    function(event, args) {
                        event.stopPropagation();
                        openYouTube(
                            args.youtubeId,
                            args.title
                        );
                    };

                hotspot.clickHandlerArgs = {
                    youtubeId: hotspot.youtubeId,
                    title:
                    hotspot.videoTitle ||
                    hotspot.text ||
                    ""
                };
            }

            // LOCAL VIDEO HOTSPOT
            else if (hotspot.hotspotType === "video") {
                hotspot.type = hotspot.type || "info";
                hotspot.cssClass =
                    hotspot.cssClass || "media-hotspot";
                hotspot.createTooltipFunc = createMediaHotspot;
                hotspot.createTooltipArgs = {
                    title:
                    hotspot.videoTitle ||
                    hotspot.text ||
                    "Play video"
                };

                hotspot.clickHandlerFunc =
                    function(event, args) {
                        event.stopPropagation();
                        openVideo(
                            args.src,
                            args.title
                        );
                    };

                hotspot.clickHandlerArgs = {
                    src: hotspot.videoSrc
                    ? new URL(hotspot.videoSrc, configUrl).href
                    : "",
                    title:
                    hotspot.videoTitle ||
                    hotspot.text ||
                    ""
                };
            }
        });
    });

    return config;
}


async function initializeViewer() {
    try {
        const configUrl = new URL("vfe.json", document.baseURI);

        const response = await fetch(configUrl);

        if (!response.ok) {
            throw new Error(
                `Unable to load json: ${response.status}`
            );
        }

        // Parse external JSON.
            const config =
            await response.json();

        // Attach JavaScript behavior to the JSON-defined hotspots.
            prepareConfig(config, configUrl);

        // Create Pannellum.
            const viewer = pannellum.viewer(
                "panorama",
                config
            );

        // Stop video when moving to another scene.
            viewer.on("scenechange",
                closeVideo
            );
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
        videoOverlay.classList.contains("open")
    ) {
        closeVideo();
    }
});

initializeViewer();
