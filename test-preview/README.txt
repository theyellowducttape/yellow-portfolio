# Thinking Generator — Room Approval Page

## Folder structure

    index.html
    rooms/
      room1.glb
      room2.glb
      room3.glb

Put your three GLB files in the `rooms` folder and use exactly these filenames:

- room1.glb
- room2.glb
- room3.glb

Then open the folder through a local web server or deploy it to GitHub Pages/Vercel/etc.

## Important

Do not open index.html directly with `file://` if the browser blocks GLB loading.
For local testing, from this folder run:

    python -m http.server 8000

Then open:

    http://localhost:8000

The viewer uses Three.js from unpkg and provides:
- Room 1 / Room 2 / Room 3 selection
- GLB loading
- Orbit controls
- Zoom and pan
- Automatic camera framing
- Top-right close button
- Escape key to close
