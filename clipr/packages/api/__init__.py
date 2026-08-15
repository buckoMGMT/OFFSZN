"""HTTP API over the ClipR engine.

This is the seam between the product and the engine. Anything that renders a
screen -- a web app, a mobile app, Base44 -- talks to this and never touches
ffmpeg, Whisper or the filesystem directly.
"""
