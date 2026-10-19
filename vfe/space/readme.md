
# Image sources
- https://svs.gsfc.nasa.gov/4851
- Instructions per ChatGPT

    NASA’s Deep Star Maps 2020 are already in plate carrée—the same geometry as a 2:1 equirectangular image. The celestial-coordinate versions represent the entire sky with Earth, Sun, and horizon absent.
    Available resolutions range from 4096×2048 to 65,536×32,768 in HDR OpenEXR format. They combine Gaia DR2, Hipparcos, Tycho-2, and other catalogs, totaling about 1.7 billion stars. Right ascension increases toward the left because the sphere is viewed from inside. Deep Star Maps 2020
    This is likely the best choice if you need a static star environment for Pannellum, Blender, or another 360° viewer.
    Convert the EXR to a normal image with OpenImageIO, for example:

    oiiotool starmap_2020_8k.exr \
      --colorconvert linear sRGB \
      -o starmap_2020_8k.png

    A horizontal flip or rotation may be needed depending on the viewer’s longitude convention.
