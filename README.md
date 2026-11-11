# Ground Signal

CCT360 Web Development and Design II  
Project 2: Designing With Data

Live website experience driven by the USGS earthquake feed. Magnitude changes the page colour, shake, sound volume, image filter, and video speed.

## Live links

- GitHub Pages: https://5781mahmood.github.io/CCT360-Ground-Signal/
- Repository: https://github.com/5781mahmood/CCT360-Ground-Signal

## What the site does

1. Fetches live JSON from the USGS M2.5+ past-day feed.
2. Plots each quake as a pulsing dot on a world map panel.
3. Refreshes every 60 seconds and shows a last-updated time.
4. Lets you filter by magnitude and region, turn sound on/off, and click a quake for details.

## How to use it

1. Open the site.
2. Press **Turn sound on** if you want the rumble (browsers block autoplay).
3. Try the magnitude buttons (`2.5+`, `4.0+`, `5.0+`) and region buttons.
4. Click a map dot or a row in **Recent hits** to inspect one quake.
5. Leave the tab open for a minute to watch the auto refresh.

## Run locally

From the project folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

On your phone, use your computer's local IP on the same wifi, for example `http://192.168.x.x:8000`.

## Group roles

- **Mahmood** — concept, API, publishing
- **Mohamad** — layout, CSS, slides
- **Haniyyah** — JavaScript, media, credits, video

## Files

```
index.html
css/style.css
js/script.js
images/
audio/
video/
CREDITS.txt
README.md
```

## Credits

See `CREDITS.txt` for the full list. Main data source is the USGS Earthquake Hazards Program.
