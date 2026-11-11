// Ground Signal - CCT360 Project 2
// Live USGS earthquake feed drives colour, motion, sound, and media

const apiURL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
const refreshMs = 60000;

let allQuakes = [];
let filteredQuakes = [];
let minMagnitude = 2.5;
let regionFocus = "all";
let soundEnabled = false;
let selectedId = null;

const lastUpdatedEl = document.querySelector("#last-updated");
const feedLabelEl = document.querySelector("#feed-label");
const errorBox = document.querySelector("#error-box");
const errorMessage = document.querySelector("#error-message");
const retryBtn = document.querySelector("#retry-btn");
const soundBtn = document.querySelector("#sound-btn");
const rumbleAudio = document.querySelector("#rumble-audio");
const tickAudio = document.querySelector("#tick-audio");
const quakeMap = document.querySelector("#quake-map");
const quakeList = document.querySelector("#quake-list");
const groundVideo = document.querySelector("#ground-video");
const signalImage = document.querySelector("#signal-image");

const statCount = document.querySelector("#stat-count");
const statMax = document.querySelector("#stat-max");
const statAvg = document.querySelector("#stat-avg");
const statDepth = document.querySelector("#stat-depth");

const detailTitle = document.querySelector("#detail-title");
const detailMag = document.querySelector("#detail-mag");
const detailDepth = document.querySelector("#detail-depth");
const detailTime = document.querySelector("#detail-time");
const detailFelt = document.querySelector("#detail-felt");
const reactingTo = document.querySelector("#reacting-to");
const clipCaption = document.querySelector("#clip-caption");
const photoCaption = document.querySelector("#photo-caption");
const soundCaption = document.querySelector("#sound-caption");

// Class 8 pattern: async/await + try/catch + response.ok
async function getQuakeData() {
  try {
    const response = await fetch(apiURL);

    if (!response.ok) {
      throw new Error("Request failed");
    }

    const data = await response.json();
    hideError();
    useQuakeData(data);
  } catch (error) {
    console.error("Error:", error);
    showError("The USGS feed did not load. Your wifi might be down, or the API is busy. Try again in a minute.");
  }
}

function useQuakeData(data) {
  allQuakes = [];

  // regular for loop, like class 6
  for (let i = 0; i < data.features.length; i++) {
    const feature = data.features[i];
    const props = feature.properties;
    const coords = feature.geometry.coordinates;

    // skip weird entries with no magnitude
    if (props.mag === null || props.mag === undefined) {
      continue;
    }

    allQuakes.push({
      id: feature.id,
      mag: props.mag,
      place: props.place || "Unknown location",
      time: props.time,
      felt: props.felt,
      tsunami: props.tsunami,
      lon: coords[0],
      lat: coords[1],
      depth: coords[2]
    });
  }

  // newest first
  allQuakes.sort(function (a, b) {
    return b.time - a.time;
  });

  feedLabelEl.textContent = data.metadata.title || "USGS earthquake feed";
  lastUpdatedEl.textContent = "Last updated: " + formatClock(new Date());

  applyFilters();
}

function applyFilters() {
  filteredQuakes = [];

  for (let i = 0; i < allQuakes.length; i++) {
    const quake = allQuakes[i];
    const passesMag = quake.mag >= minMagnitude;
    const passesRegion = quakeMatchesRegion(quake, regionFocus);

    if (passesMag && passesRegion) {
      filteredQuakes.push(quake);
    }
  }

  updateStats();

  // if the quake we were looking at got filtered out, drop back to the strongest
  if (!findQuakeById(selectedId)) {
    const strongest = getStrongestQuake();
    selectedId = strongest ? strongest.id : null;
  }

  const active = getActiveQuake();
  if (active) {
    showQuakeDetails(active);
  }

  updatePageMood();
  drawMapDots();
  drawList();
  updateMediaFromData();
  updateSoundFromData();
}

function quakeMatchesRegion(quake, region) {
  if (region === "all") {
    return true;
  }

  // rough longitude bands so the filter feels useful without a real GIS library
  if (region === "americas") {
    return quake.lon <= -30 && quake.lon >= -170;
  }

  if (region === "pacific") {
    return quake.lon > 100 || quake.lon < -100;
  }

  if (region === "eurasia") {
    return quake.lon > -30 && quake.lon <= 100;
  }

  return true;
}

function updateStats() {
  const count = filteredQuakes.length;

  if (count === 0) {
    statCount.textContent = "0";
    statMax.textContent = "—";
    statAvg.textContent = "—";
    statDepth.textContent = "—";
    return;
  }

  let maxMag = filteredQuakes[0].mag;
  let totalMag = 0;
  let maxDepth = filteredQuakes[0].depth;

  for (let i = 0; i < filteredQuakes.length; i++) {
    const quake = filteredQuakes[i];
    totalMag += quake.mag;

    if (quake.mag > maxMag) {
      maxMag = quake.mag;
    }

    if (quake.depth > maxDepth) {
      maxDepth = quake.depth;
    }
  }

  const avgMag = totalMag / count;

  statCount.textContent = String(count);
  statMax.textContent = maxMag.toFixed(1);
  statAvg.textContent = avgMag.toFixed(1);
  statDepth.textContent = Math.round(maxDepth);
}

// colour and shake follow the quake you clicked, not the whole list
function updatePageMood() {
  const body = document.body;
  const mag = getActiveMagnitude();

  body.classList.remove("level-calm", "level-mild", "level-active", "level-strong", "level-severe");

  if (mag >= 6) {
    body.classList.add("level-severe");
  } else if (mag >= 5) {
    body.classList.add("level-strong");
  } else if (mag >= 4) {
    body.classList.add("level-active");
  } else if (mag >= 3) {
    body.classList.add("level-mild");
  } else {
    body.classList.add("level-calm");
  }

  // steep curve so a 5 or 6 actually rattles the page
  let shake = 0;
  if (mag > 2.5) {
    const above = mag - 2.5;
    shake = above * above * 1.7;
  }
  if (shake > 22) {
    shake = 22;
  }

  let pulse = 3.2 - (mag - 2.5) * 0.6;
  if (pulse < 0.4) {
    pulse = 0.4;
  }

  document.documentElement.style.setProperty("--shake-amount", shake.toFixed(1) + "px");
  document.documentElement.style.setProperty("--pulse-speed", pulse.toFixed(2) + "s");

  const active = getActiveQuake();
  if (!active) {
    reactingTo.textContent = "No quakes in this filter.";
    return;
  }

  reactingTo.textContent = "Reacting to mag " + active.mag.toFixed(1) + " · " + shakeWord(shake) + " shake";
}

function shakeWord(shake) {
  if (shake < 1) {
    return "still";
  }
  if (shake < 4) {
    return "light";
  }
  if (shake < 9) {
    return "medium";
  }
  if (shake < 15) {
    return "hard";
  }
  return "violent";
}

function getMaxMagnitude() {
  if (filteredQuakes.length === 0) {
    return 0;
  }

  let maxMag = filteredQuakes[0].mag;

  for (let i = 1; i < filteredQuakes.length; i++) {
    if (filteredQuakes[i].mag > maxMag) {
      maxMag = filteredQuakes[i].mag;
    }
  }

  return maxMag;
}

function getStrongestQuake() {
  if (filteredQuakes.length === 0) {
    return null;
  }

  let strongest = filteredQuakes[0];

  for (let i = 1; i < filteredQuakes.length; i++) {
    if (filteredQuakes[i].mag > strongest.mag) {
      strongest = filteredQuakes[i];
    }
  }

  return strongest;
}

function getActiveQuake() {
  const picked = findQuakeById(selectedId);
  if (picked) {
    return picked;
  }
  return getStrongestQuake();
}

function getActiveMagnitude() {
  const quake = getActiveQuake();
  if (!quake) {
    return 0;
  }
  return quake.mag;
}

function getAverageMagnitude() {
  if (filteredQuakes.length === 0) {
    return 0;
  }

  let total = 0;

  for (let i = 0; i < filteredQuakes.length; i++) {
    total += filteredQuakes[i].mag;
  }

  return total / filteredQuakes.length;
}

function drawMapDots() {
  quakeMap.innerHTML = "";

  for (let i = 0; i < filteredQuakes.length; i++) {
    const quake = filteredQuakes[i];
    const pos = lonLatToPercent(quake.lon, quake.lat);
    const size = 8 + quake.mag * 5;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "quake-dot";
    button.style.width = size + "px";
    button.style.height = size + "px";
    button.style.left = pos.x + "%";
    button.style.top = pos.y + "%";
    button.style.animationDelay = (i % 8) * 0.12 + "s";
    button.title = quake.mag.toFixed(1) + " · " + quake.place;
    button.setAttribute("aria-label", "Earthquake magnitude " + quake.mag.toFixed(1) + " near " + quake.place);

    if (quake.id === selectedId) {
      button.classList.add("is-selected");
    }

    button.addEventListener("click", function () {
      selectQuake(quake.id);
    });

    quakeMap.appendChild(button);
  }
}

function drawList() {
  quakeList.innerHTML = "";

  const limit = Math.min(filteredQuakes.length, 12);

  for (let i = 0; i < limit; i++) {
    const quake = filteredQuakes[i];
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";

    button.innerHTML =
      '<span class="mag-pill">' + quake.mag.toFixed(1) + "</span>" +
      '<span class="place">' + escapeHtml(quake.place) + "</span>" +
      '<span class="when">' + formatClock(new Date(quake.time)) + "</span>";

    button.addEventListener("click", function () {
      selectQuake(quake.id);
    });

    item.appendChild(button);
    quakeList.appendChild(item);
  }

  if (limit === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No quakes match this filter right now. Loosen the magnitude or region.";
    quakeList.appendChild(empty);
  }
}

// equirectangular projection onto the map panel
function lonLatToPercent(lon, lat) {
  const x = ((lon + 180) / 360) * 100;
  const y = ((90 - lat) / 180) * 100;
  return { x: x, y: y };
}

function selectQuake(id) {
  selectedId = id;
  const quake = findQuakeById(id);

  if (!quake) {
    return;
  }

  showQuakeDetails(quake);
  updatePageMood();
  updateMediaFromData();
  updateSoundFromData();
  drawMapDots();
  playTick();
}

function findQuakeById(id) {
  for (let i = 0; i < filteredQuakes.length; i++) {
    if (filteredQuakes[i].id === id) {
      return filteredQuakes[i];
    }
  }
  return null;
}

function showQuakeDetails(quake) {
  detailTitle.textContent = quake.place;
  detailMag.textContent = quake.mag.toFixed(1);
  detailDepth.textContent = Math.round(quake.depth) + " km";
  detailTime.textContent = formatClock(new Date(quake.time));

  if (quake.felt === null || quake.felt === undefined) {
    detailFelt.textContent = "none yet";
  } else {
    detailFelt.textContent = String(quake.felt);
  }
}

// image filter + video speed follow the quake you picked (class 7 / 8 demos)
function updateMediaFromData() {
  const mag = getActiveMagnitude();

  // coloured paper, so hue and saturation actually show up
  const hue = Math.round((mag - 2) * 22);
  const sat = Math.round(80 + mag * 28);
  const bright = Math.max(70, Math.round(125 - mag * 8));
  const contrast = Math.round(95 + mag * 10);
  signalImage.style.filter = "hue-rotate(" + hue + "deg) saturate(" + sat + "%) brightness(" + bright + "%) contrast(" + contrast + "%)";
  photoCaption.textContent = "Paper photo: hue " + hue + "°, saturation " + sat + "%";

  // playbackRate must stay in a sensible range
  let speed = 0.45 + (mag - 2.5) * 0.55;
  speed = Math.max(0.45, Math.min(speed, 2.8));
  groundVideo.playbackRate = speed;
  clipCaption.textContent = "Clip speed: " + speed.toFixed(1) + "x";

  const playPromise = groundVideo.play();
  if (playPromise !== undefined) {
    playPromise.catch(function () {
      clipCaption.textContent = "Clip speed: " + speed.toFixed(1) + "x (tap the page if it stays frozen)";
    });
  }
}

function volumeForMagnitude(mag) {
  // quiet for a small quake, full for a big one
  let volume = (mag - 2.2) / 4.2;
  volume = Math.max(0.05, Math.min(volume, 1));
  return volume;
}

function updateSoundFromData() {
  const mag = getActiveMagnitude();
  const volume = volumeForMagnitude(mag);
  const percent = Math.round(volume * 100);

  rumbleAudio.volume = volume;

  let rate = 0.75 + (mag - 2.5) * 0.18;
  rate = Math.max(0.75, Math.min(rate, 1.7));
  rumbleAudio.playbackRate = rate;

  if (!soundEnabled) {
    soundCaption.textContent = "Sound is off. This quake would play at " + percent + "% volume.";
    return;
  }

  soundCaption.textContent = "Rumble volume: " + percent + "% · speed " + rate.toFixed(2) + "x";
}

function toggleSound() {
  soundEnabled = !soundEnabled;

  if (soundEnabled) {
    soundBtn.textContent = "Turn sound off";
    rumbleAudio.currentTime = 0;
    updateSoundFromData();
    rumbleAudio.play().catch(function (error) {
      console.error("Audio play blocked:", error);
      soundEnabled = false;
      soundBtn.textContent = "Turn sound on";
    });
  } else {
    soundBtn.textContent = "Turn sound on";
    rumbleAudio.pause();
    updateSoundFromData();
  }
}

function playTick() {
  if (!soundEnabled) {
    return;
  }

  tickAudio.currentTime = 0;
  tickAudio.volume = 0.35;
  tickAudio.play().catch(function () {
    // ignore if the browser blocks a quick replay
  });
}

function showError(message) {
  errorBox.hidden = false;
  errorMessage.textContent = message;
}

function hideError() {
  errorBox.hidden = true;
}

function formatClock(dateObj) {
  return dateObj.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setupInteractions() {
  soundBtn.addEventListener("click", toggleSound);
  retryBtn.addEventListener("click", getQuakeData);

  const magButtons = document.querySelectorAll(".filter-btn");
  for (let i = 0; i < magButtons.length; i++) {
    magButtons[i].addEventListener("click", function (event) {
      const button = event.currentTarget;
      minMagnitude = Number(button.dataset.min);

      for (let j = 0; j < magButtons.length; j++) {
        magButtons[j].classList.remove("is-active");
      }
      button.classList.add("is-active");

      applyFilters();
      playTick();
    });
  }

  const regionButtons = document.querySelectorAll(".region-btn");
  for (let i = 0; i < regionButtons.length; i++) {
    regionButtons[i].addEventListener("click", function (event) {
      const button = event.currentTarget;
      regionFocus = button.dataset.region;

      for (let j = 0; j < regionButtons.length; j++) {
        regionButtons[j].classList.remove("is-active");
      }
      button.classList.add("is-active");

      applyFilters();
      playTick();
    });
  }
}

setupInteractions();
getQuakeData();
setInterval(getQuakeData, refreshMs);
