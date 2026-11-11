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
  updatePageMood();
  drawMapDots();
  drawList();
  updateMediaFromData();
  updateSoundFromData();

  // keep selected quake visible if it still passes the filter
  if (selectedId) {
    const stillThere = findQuakeById(selectedId);
    if (stillThere) {
      showQuakeDetails(stillThere);
    }
  }
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

// colour / shake class on body is driven by the strongest quake showing
function updatePageMood() {
  const body = document.body;
  body.classList.remove("level-calm", "level-active", "level-strong", "level-severe");

  const maxMag = getMaxMagnitude();

  if (maxMag >= 6) {
    body.classList.add("level-severe");
  } else if (maxMag >= 5) {
    body.classList.add("level-strong");
  } else if (maxMag >= 4) {
    body.classList.add("level-active");
  } else {
    body.classList.add("level-calm");
  }
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

// image filter + video speed follow the data (class 7 / 8 demos)
function updateMediaFromData() {
  const maxMag = getMaxMagnitude();
  const avgMag = getAverageMagnitude();

  // stronger quakes push the texture toward a harsher look
  const gray = Math.min(90, Math.round(maxMag * 12));
  const bright = Math.max(55, 110 - Math.round(maxMag * 8));
  const contrast = 90 + Math.round(maxMag * 6);
  signalImage.style.filter = "grayscale(" + gray + "%) brightness(" + bright + "%) contrast(" + contrast + "%)";

  // playbackRate must stay in a sensible range
  let speed = avgMag / 2.2;
  speed = Math.max(0.5, Math.min(speed, 2.8));
  groundVideo.playbackRate = speed;

  // try to keep the clip running after refresh
  const playPromise = groundVideo.play();
  if (playPromise !== undefined) {
    playPromise.catch(function () {
      // autoplay can fail on some phones until the user taps; that is fine
    });
  }
}

function updateSoundFromData() {
  if (!soundEnabled) {
    return;
  }

  const maxMag = getMaxMagnitude();
  // volume has to stay between 0 and 1
  let volume = maxMag / 7;
  volume = Math.max(0.08, Math.min(volume, 1));
  rumbleAudio.volume = volume;
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
