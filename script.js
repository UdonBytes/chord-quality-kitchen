const ROOTS = ["G", "Ab", "A", "Bb", "B", "C", "Db", "D", "Eb", "E", "F", "Gb"];
const ROOT_MIDIS = { G: 55, Ab: 56, A: 57, Bb: 58, B: 59, C: 60, Db: 61, D: 62, Eb: 63, E: 64, F: 65, Gb: 66 };
const ROOT_MENU_OPTIONS = ["random", ...ROOTS];
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const FLAT_SAMPLE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const INGREDIENTS = [
  { id: "root", label: "Soup Base", theory: "Root", role: "Broth", group: "broth", color: "#ffe79a", vessel: "bowl", food: "base" },
  { id: "major3", label: "Springy Noodles", theory: "Major 3rd", role: "Noodle", group: "noodle", color: "#ffdccb", vessel: "scoop", food: "springy-noodle" },
  { id: "minor3", label: "Soft Noodles", theory: "Minor 3rd", role: "Noodle", group: "noodle", color: "#f6dfcf", vessel: "scoop", food: "soft-noodles" },
  { id: "perfect5", label: "Meat", theory: "Perfect 5th", role: "Protein", group: "meat", color: "#f0b990", vessel: "plate", food: "steak-bite" },
  { id: "dim5", label: "Seafood", theory: "Diminished 5th", role: "Protein", group: "meat", color: "#ffd9b5", vessel: "plate", food: "seafood-bite" },
  { id: "aug5", label: "Tofu", theory: "Augmented 5th", role: "Protein", group: "meat", color: "#fff0c7", vessel: "plate", food: "tofu" },
  { id: "minor7", label: "Spring Onion", theory: "Minor 7th", role: "Topping", group: "topping", color: "#f3b9c8", vessel: "cup", food: "spring-onion" },
  { id: "dim7", label: "Spicy Peppers", theory: "Diminished 7th", role: "Topping", group: "topping", color: "#f9d7df", vessel: "cup", food: "spicy-peppers" }
];

const INGREDIENT_GROUPS = [
  { id: "broth", label: "Broth" },
  { id: "noodle", label: "Noodle" },
  { id: "meat", label: "Protein" },
  { id: "topping", label: "Topping" }
];

const INTERVALS = {
  root: { semitones: 0, degree: 0 },
  major3: { semitones: 4, degree: 2 },
  minor3: { semitones: 3, degree: 2 },
  perfect5: { semitones: 7, degree: 4 },
  dim5: { semitones: 6, degree: 4 },
  aug5: { semitones: 8, degree: 4 },
  minor7: { semitones: 10, degree: 6 },
  dim7: { semitones: 9, degree: 6 }
};

const CHORD_QUALITIES = [
  {
    id: "major",
    display: "Major triad",
    sentence: "major triad",
    recipe: ["root", "major3", "perfect5"]
  },
  {
    id: "minor",
    display: "Minor triad",
    sentence: "minor triad",
    recipe: ["root", "minor3", "perfect5"]
  },
  {
    id: "dominant7",
    display: "Dominant 7th",
    sentence: "dominant 7th",
    recipe: ["root", "major3", "perfect5", "minor7"]
  },
  {
    id: "diminished7",
    display: "Diminished 7th",
    sentence: "diminished 7th",
    recipe: ["root", "minor3", "dim5", "dim7"]
  },
  {
    id: "augmented",
    display: "Augmented triad",
    sentence: "augmented triad",
    recipe: ["root", "major3", "aug5"]
  }
];

const QUALITY_IDS = CHORD_QUALITIES.map((quality) => quality.id);
const QUALITY_STORAGE_KEY = "cqk-enabled-qualities";
const SOLD_OUT_PATH_MESSAGE = "This soup is sold out now - reset or choose another ingredient.";
const MOBILE_RECIPE_BOARD_QUERY = "(max-width: 760px)";

function loadEnabledQualityIds() {
  try {
    localStorage.removeItem(QUALITY_STORAGE_KEY);
  } catch (error) {
    console.warn("Could not clear recipe filter storage", error);
  }
  return QUALITY_IDS;
}

const state = {
  current: null,
  selected: new Set(),
  rootMode: "random",
  rootMenuOpen: false,
  rootBadgeClickTimer: null,
  rootBadgeLastClickTime: 0,
  orderServed: false,
  recipeBoardCollapsed: window.matchMedia(MOBILE_RECIPE_BOARD_QUERY).matches,
  enabledQualityIds: new Set(loadEnabledQualityIds()),
  soldOutAnimationQualityId: null,
  soldOutAnimationTimer: null,
  soldOutExitQualityId: null,
  soldOutExitTimer: null,
  audioContext: null,
  sampleBuffers: new Map(),
  sampleOnsetOffsets: new Map(),
  sampleMetadata: new Map(),
  sampleErrors: [],
  preloadPromise: null,
  noodleFadeTimer: null,
  potChipSequence: 0,
  exitingPotIngredients: new Set(),
  exitPotTimers: new Map(),
  activeSources: [],
  activeNoteGains: [],
  activeGain: null,
  activeCueSources: [],
  activeCueGains: [],
  audioReady: false,
  samplesReady: false
};

const els = {
  rootNote: document.querySelector("#rootNote"),
  rootBadge: document.querySelector("#rootBadge"),
  rootLockState: document.querySelector("#rootLockState"),
  rootMenu: document.querySelector("#rootMenu"),
  roundPrompt: document.querySelector("#roundPrompt"),
  audioStatus: document.querySelector("#audioStatus"),
  playButton: document.querySelector("#playButton"),
  ladleButton: document.querySelector("#ladleButton"),
  submitButton: document.querySelector("#submitButton"),
  resetButton: document.querySelector("#resetButton"),
  nextButton: document.querySelector("#nextButton"),
  ingredientGrid: document.querySelector("#ingredientGrid"),
  potIngredients: document.querySelector("#potIngredients"),
  noodleLayer: document.querySelector(".noodle-layer"),
  recipeBoardShell: document.querySelector(".recipe-board"),
  recipeBoardToggle: document.querySelector("#recipeBoardToggle"),
  recipeBoard: document.querySelector("#recipeBoard"),
  feedback: document.querySelector("#feedback"),
  recipe: document.querySelector("#recipe"),
  potWrap: document.querySelector("#potWrap"),
  sparkles: document.querySelector("#sparkles")
};

function pitchClass(note) {
  return ((note % 12) + 12) % 12;
}

function rootPitchClass(root) {
  return pitchClass(ROOT_MIDIS[root]);
}

function spellNote(root, intervalId) {
  const interval = INTERVALS[intervalId];
  const rootLetter = root[0];
  const rootLetterIndex = LETTERS.indexOf(rootLetter);
  const targetLetter = LETTERS[(rootLetterIndex + interval.degree) % LETTERS.length];
  const targetPitch = pitchClass(rootPitchClass(root) + interval.semitones);
  const naturalPitch = NATURAL_PITCH[targetLetter];
  let accidental = targetPitch - naturalPitch;

  if (accidental > 6) accidental -= 12;
  if (accidental < -6) accidental += 12;

  const accidentalText = accidental === 2 ? "##" :
    accidental === 1 ? "#" :
    accidental === -1 ? "b" :
    accidental === -2 ? "bb" : "";

  return `${targetLetter}${accidentalText}`;
}

function getChordNotes(root, quality) {
  return quality.recipe.map((ingredientId) => ({
    ingredientId,
    spelling: spellNote(root, ingredientId),
    midi: ROOT_MIDIS[root] + INTERVALS[ingredientId].semitones
  }));
}

function sampleNameForMidi(midi) {
  const octave = Math.floor(midi / 12) - 1;
  return `Piano.mf.${FLAT_SAMPLE_NAMES[pitchClass(midi)]}${octave}`;
}

function samplePathsForMidi(midi) {
  const name = sampleNameForMidi(midi);
  return [`piano_samples/${name}.wav`, `piano_samples/${name}.aiff`];
}

function displayNoteName(note) {
  return note.replace(/b/g, "♭").replace(/#/g, "♯");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function displayNoteNameHtml(note) {
  const display = displayNoteName(note);
  return escapeHtml(display).replace(/♯/g, '<span class="sharp-symbol">♯</span>');
}

function renderNoteLabel(element, note) {
  const display = displayNoteName(note);
  const match = display.match(/^([A-G])([♭♯]*)$/);
  if (!match) {
    element.textContent = display;
    return;
  }
  element.innerHTML = `<span class="root-note-content" data-note="${note}" data-has-accidental="${String(Boolean(match[2]))}"><span class="root-letter">${match[1]}</span>${match[2] ? `<span class="flat-symbol">${match[2]}</span>` : ""}</span>`;
}

function rootMenuLabel(value) {
  return value === "random" ? "Random" : displayNoteName(value);
}

function getAvailableQualities() {
  return CHORD_QUALITIES.filter((quality) => state.enabledQualityIds.has(quality.id));
}

function chooseRoot() {
  if (ROOTS.includes(state.rootMode)) return state.rootMode;
  return ROOTS[Math.floor(Math.random() * ROOTS.length)];
}

function chooseRound() {
  const root = chooseRoot();
  const qualityPool = getAvailableQualities();
  if (!qualityPool.length) {
    state.enabledQualityIds = new Set(QUALITY_IDS);
    qualityPool.push(...getAvailableQualities());
  }
  const quality = qualityPool[Math.floor(Math.random() * qualityPool.length)];
  state.current = { root, quality, notes: getChordNotes(root, quality) };
  state.selected.clear();
  state.orderServed = false;
  clearPotIngredientExits();
  els.potIngredients.innerHTML = "";
  renderNoteLabel(els.rootNote, root);
  renderRootSelector();
  if (els.roundPrompt) {
    els.roundPrompt.textContent = "Listen to the chord. Tap ingredients to hear their sound and add them to the pot, then mix!";
  }
  els.feedback.textContent = "";
  els.feedback.className = "feedback";
  els.recipe.hidden = true;
  els.recipe.innerHTML = "";
  clearAnimations();
  renderIngredients();
  renderPotIngredients();
  renderRecipeBoard();
  updateResetButton();
  updateNextButton();
}

function renderRootSelector() {
  els.rootLockState.textContent = state.rootMode === "random" ? "Random" : "Locked";
  els.rootBadge.setAttribute("aria-expanded", String(state.rootMenuOpen));
  els.rootBadge.setAttribute(
    "aria-label",
    `Root ${displayNoteName(state.current?.root || "C")}. ${state.rootMode === "random" ? "Random root" : "Locked root"}. Click to choose a root. Double click to ${state.rootMode === "random" ? "lock current root" : "unlock root"}.`
  );

  els.rootMenu.hidden = !state.rootMenuOpen;
  els.rootMenu.innerHTML = "";

  ROOT_MENU_OPTIONS.forEach((value) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "root-option";
    option.dataset.rootValue = value;
    option.setAttribute("role", "menuitemradio");
    option.setAttribute("aria-checked", String(state.rootMode === value));
    option.textContent = rootMenuLabel(value);
    option.addEventListener("click", (event) => {
      event.stopPropagation();
      setRootMode(value);
    });
    els.rootMenu.appendChild(option);
  });
}

function setRootMenuOpen(open) {
  state.rootMenuOpen = open;
  renderRootSelector();
}

function setRootMode(value) {
  if (state.rootBadgeClickTimer) {
    window.clearTimeout(state.rootBadgeClickTimer);
    state.rootBadgeClickTimer = null;
  }
  state.rootMode = value;
  state.rootBadgeLastClickTime = 0;
  state.rootMenuOpen = false;
  stopActiveChord();
  chooseRound();
}

function toggleRootLock() {
  const nextMode = state.rootMode === "random" ? state.current.root : "random";
  setRootMode(nextMode);
}

function renderIngredients() {
  els.ingredientGrid.innerHTML = "";

  INGREDIENT_GROUPS.forEach((group) => {
    const section = document.createElement("section");
    section.className = "ingredient-group";
    section.dataset.group = group.id;

    const heading = document.createElement("h3");
    heading.textContent = group.label;
    section.appendChild(heading);

    const groupList = document.createElement("div");
    groupList.className = "ingredient-group-list";

    INGREDIENTS.filter((ingredient) => ingredient.group === group.id).forEach((ingredient) => {
      const selected = state.selected.has(ingredient.id);
      const available = selected || canAddIngredient(ingredient.id);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "ingredient-card";
      card.dataset.id = ingredient.id;
      card.dataset.vessel = ingredient.vessel;
      card.dataset.food = ingredient.food;
      card.dataset.group = ingredient.group;
      card.dataset.unavailable = String(state.audioReady && !available);
      card.style.setProperty("--card-color", ingredient.color);
      card.disabled = !state.audioReady || !available;
      card.setAttribute("aria-pressed", String(selected));
      card.setAttribute("aria-label", available ? ingredient.label : `${ingredient.label} is not in this soup path`);
      card.innerHTML = `
        <span class="food-mark" aria-hidden="true"><span></span></span>
        <span class="ingredient-name">${ingredient.label}</span>
        <span class="ingredient-theory">${ingredient.theory}</span>
      `;
      card.addEventListener("click", () => toggleIngredient(ingredient.id));
      groupList.appendChild(card);
    });

    section.appendChild(groupList);
    els.ingredientGrid.appendChild(section);
  });
}

function toggleIngredient(id) {
  if (!state.audioReady) {
    els.audioStatus.textContent = "Piano samples are still loading. Try again in a moment.";
    return;
  }

  if (!state.selected.has(id) && !canAddIngredient(id)) {
    els.feedback.textContent = "That ingredient is not in this soup path.";
    els.feedback.className = "feedback bad";
    return;
  }

  playIngredientCue(id);

  if (state.selected.has(id)) {
    state.selected.delete(id);
    startPotIngredientExit(id);
  } else {
    state.selected.add(id);
    cancelPotIngredientExit(id);
  }
  renderIngredients();
  renderPotIngredients();
  renderRecipeBoard();
  updateResetButton();
}

function isPotFoodIngredient(id) {
  return !["root", "major3", "minor3"].includes(id);
}

function startPotIngredientExit(id) {
  if (!isPotFoodIngredient(id)) return;
  window.clearTimeout(state.exitPotTimers.get(id));
  state.exitingPotIngredients.add(id);
  state.exitPotTimers.set(id, window.setTimeout(() => {
    state.exitingPotIngredients.delete(id);
    state.exitPotTimers.delete(id);
    if (!state.selected.has(id)) {
      els.potIngredients.querySelector(`.pot-ingredient-chip[data-id="${id}"]`)?.remove();
    }
  }, 320));
}

function cancelPotIngredientExit(id) {
  window.clearTimeout(state.exitPotTimers.get(id));
  state.exitPotTimers.delete(id);
  state.exitingPotIngredients.delete(id);
}

function clearPotIngredientExits() {
  state.exitPotTimers.forEach((timer) => window.clearTimeout(timer));
  state.exitPotTimers.clear();
  state.exitingPotIngredients.clear();
}

function canAddIngredient(id) {
  const nextSelected = new Set(state.selected);
  nextSelected.add(id);
  return hasAvailableRecipePath(nextSelected);
}

function hasAvailableRecipePath(selectedIngredients = state.selected) {
  return getAvailableQualities().some((quality) => isSubset(selectedIngredients, new Set(quality.recipe)));
}

function renderPotIngredients() {
  els.potWrap.dataset.hasBase = String(state.selected.has("root"));
  const noodleType = state.selected.has("major3")
    ? "springy"
    : state.selected.has("minor3")
      ? "soft"
      : "none";
  els.potWrap.dataset.noodle = noodleType;
  updateNoodleLayer(noodleType);

  const placements = [
    { left: "17%", top: "48px", tilt: "-9deg", size: "48px", swirlX: "14px", swirlY: "-8px" },
    { left: "32%", top: "42px", tilt: "7deg", size: "50px", swirlX: "10px", swirlY: "10px" },
    { left: "47%", top: "49px", tilt: "-5deg", size: "48px", swirlX: "-12px", swirlY: "8px" },
    { left: "59%", top: "70px", tilt: "8deg", size: "46px", swirlX: "-10px", swirlY: "-10px" }
  ];
  const placementOverrides = {
    perfect5: { left: "19%", top: "88px", tilt: "-7deg", size: "150px", swirlX: "11px", swirlY: "-7px" },
    dim5: { left: "10%", top: "84px", tilt: "-2deg", size: "190px", swirlX: "12px", swirlY: "-8px" },
    aug5: { left: "48%", top: "85px", tilt: "-2deg", size: "190px", swirlX: "8px", swirlY: "-6px" },
    minor7: { left: "50%", top: "53px", tilt: "0deg", size: "100%", swirlX: "0px", swirlY: "0px" },
    dim7: { left: "50%", top: "53px", tilt: "0deg", size: "100%", swirlX: "0px", swirlY: "0px" }
  };

  const visualIds = [...new Set([...state.selected, ...state.exitingPotIngredients])]
    .filter((id) => isPotFoodIngredient(id));
  els.potIngredients.querySelectorAll(".pot-ingredient-chip").forEach((chip) => {
    if (!visualIds.includes(chip.dataset.id)) {
      chip.remove();
    }
  });

  visualIds.forEach((id, index) => {
    const ingredient = INGREDIENTS.find((item) => item.id === id);
    let chip = els.potIngredients.querySelector(`.pot-ingredient-chip[data-id="${id}"]`);
    if (!chip) {
      chip = document.createElement("span");
      chip.className = "pot-ingredient-chip";
      chip.dataset.id = id;
      chip.dataset.created = String(++state.potChipSequence);

      const art = document.createElement("span");
      art.className = "pot-food-art";
      chip.appendChild(art);
      els.potIngredients.appendChild(chip);
      chip.classList.add("entering");
      window.setTimeout(() => {
        chip.classList.remove("entering");
      }, 380);
    }

    chip.dataset.food = ingredient.food;
    const art = chip.querySelector(".pot-food-art");
    if (ingredient.food === "seafood-bite") {
      ["seafood-fish", "seafood-shrimp seafood-shrimp-1", "seafood-shrimp seafood-shrimp-2"].forEach((className) => {
        const primaryClass = className.split(" ")[0] === "seafood-shrimp" ? className.split(" ")[1] : className;
        if (!art.querySelector(`.${primaryClass}`)) {
          const piece = document.createElement("span");
          piece.className = `seafood-piece ${className}`;
          art.appendChild(piece);
        }
      });
      art.querySelectorAll(".tofu-piece").forEach((piece) => piece.remove());
    } else if (ingredient.food === "tofu") {
      ["tofu-cube-1", "tofu-cube-2", "tofu-cube-3", "tofu-cube-4"].forEach((className) => {
        if (!art.querySelector(`.${className}`)) {
          const piece = document.createElement("span");
          piece.className = `tofu-piece ${className}`;
          art.appendChild(piece);
        }
      });
      art.querySelectorAll(".seafood-piece").forEach((piece) => piece.remove());
    } else if (ingredient.food === "spicy-peppers") {
      Array.from({ length: 58 }, (_, flakeIndex) => `pepper-flake-${flakeIndex + 1}`).forEach((className) => {
        if (!art.querySelector(`.${className}`)) {
          const piece = document.createElement("span");
          piece.className = `pepper-flake ${className}`;
          art.appendChild(piece);
        }
      });
      art.querySelectorAll(".seafood-piece, .tofu-piece, .spring-onion-piece").forEach((piece) => piece.remove());
    } else if (ingredient.food === "spring-onion") {
      Array.from({ length: 42 }, (_, pieceIndex) => `spring-onion-piece-${pieceIndex + 1}`).forEach((className) => {
        if (!art.querySelector(`.${className}`)) {
          const piece = document.createElement("span");
          piece.className = `spring-onion-piece ${className}`;
          art.appendChild(piece);
        }
      });
      art.querySelectorAll(".seafood-piece, .tofu-piece, .pepper-flake").forEach((piece) => piece.remove());
    } else {
      art.querySelectorAll(".seafood-piece, .tofu-piece, .pepper-flake, .spring-onion-piece").forEach((piece) => piece.remove());
    }
    chip.classList.toggle("exiting", state.exitingPotIngredients.has(id) && !state.selected.has(id));
    chip.setAttribute("aria-label", ingredient.label);
    chip.title = ingredient.label;

    const placement = placementOverrides[id] || placements[index % placements.length];
    chip.style.left = placement.left;
    chip.style.top = "calc(var(--pot-chip-top) + var(--pot-chip-y-offset, 0px))";
    chip.style.setProperty("--pot-chip-top", placement.top);
    chip.style.setProperty("--tilt", placement.tilt);
    chip.style.setProperty("--pot-food-size", placement.size);
    chip.style.setProperty("--swirl-x", placement.swirlX);
    chip.style.setProperty("--swirl-y", placement.swirlY);
  });
}

function updateNoodleLayer(noodleType) {
  window.clearTimeout(state.noodleFadeTimer);

  if (noodleType === "none") {
    els.noodleLayer.classList.remove("show");
    state.noodleFadeTimer = window.setTimeout(() => {
      if (!els.noodleLayer.classList.contains("show")) {
        els.noodleLayer.dataset.noodle = "none";
      }
    }, 380);
    return;
  }

  els.noodleLayer.dataset.noodle = noodleType;
  window.requestAnimationFrame(() => {
    els.noodleLayer.classList.add("show");
  });
}

function updateResetButton() {
  els.resetButton.disabled = state.selected.size === 0;
}

function updateNextButton() {
  els.nextButton.disabled = !state.orderServed;
}

function isMobileRecipeBoardLayout() {
  return window.matchMedia(MOBILE_RECIPE_BOARD_QUERY).matches;
}

function updateRecipeBoardCollapse() {
  const collapsed = isMobileRecipeBoardLayout() && state.recipeBoardCollapsed;
  els.recipeBoardShell.dataset.collapsed = String(collapsed);
  els.recipeBoardToggle.setAttribute("aria-expanded", String(!collapsed));
  els.recipeBoardToggle.querySelector("em").textContent = collapsed ? "Show" : "Hide";
}

function resetIngredients() {
  state.selected.clear();
  clearPotIngredientExits();
  els.potIngredients.innerHTML = "";
  els.feedback.textContent = "";
  els.feedback.className = "feedback";
  els.recipe.hidden = true;
  els.recipe.innerHTML = "";
  clearAnimations();
  renderIngredients();
  renderPotIngredients();
  renderRecipeBoard();
  updateResetButton();
}

function renderRecipeBoard() {
  els.recipeBoard.innerHTML = "";

  const boardOrder = ["major", "minor", "dominant7", "augmented", "diminished7"];
  const boardQualities = boardOrder.map((id) => CHORD_QUALITIES.find((quality) => quality.id === id));

  boardQualities.forEach((quality) => {
    const soldOut = !state.enabledQualityIds.has(quality.id);
    const isExiting = state.soldOutExitQualityId === quality.id;
    const item = document.createElement("button");
    item.type = "button";
    item.className = "recipe-board-item";
    item.dataset.quality = quality.id;
    item.dataset.possible = String(!soldOut && isRecipePossible(quality));
    item.dataset.soldOut = String(soldOut);
    item.dataset.soldOutAnimate = String(soldOut && state.soldOutAnimationQualityId === quality.id);
    item.dataset.soldOutExit = String(isExiting);
    item.setAttribute("aria-pressed", String(soldOut));
    item.setAttribute("aria-label", `${soldOut ? "Enable" : "Disable"} ${quality.display}`);

    const name = document.createElement("strong");
    name.textContent = quality.display;

    const ingredients = document.createElement("div");
    ingredients.className = "recipe-board-ingredients";
    quality.recipe.forEach((ingredientId) => {
      const ingredient = INGREDIENTS.find((item) => item.id === ingredientId);
      const chip = document.createElement("span");
      chip.className = "recipe-ingredient";
      chip.dataset.ingredient = ingredientId;
      chip.dataset.selected = String(state.selected.has(ingredientId));
      chip.textContent = ingredient.label;
      ingredients.appendChild(chip);
    });

    item.appendChild(name);
    item.appendChild(ingredients);
    item.addEventListener("click", () => toggleRecipeAvailability(quality.id));
    els.recipeBoard.appendChild(item);
  });
  updateRecipeBoardCollapse();
}

function toggleRecipeAvailability(qualityId) {
  let shouldRefreshCurrentTarget = false;

  if (state.enabledQualityIds.has(qualityId)) {
    if (state.enabledQualityIds.size === 1) {
      els.feedback.textContent = "Keep at least one recipe available!";
      els.feedback.className = "feedback bad";
      return;
    }
    state.enabledQualityIds.delete(qualityId);
    shouldRefreshCurrentTarget = state.current?.quality.id === qualityId;
    state.soldOutAnimationQualityId = qualityId;
    if (state.soldOutExitQualityId === qualityId) {
      state.soldOutExitQualityId = null;
      window.clearTimeout(state.soldOutExitTimer);
    }
    window.clearTimeout(state.soldOutAnimationTimer);
    state.soldOutAnimationTimer = window.setTimeout(() => {
      if (state.soldOutAnimationQualityId === qualityId) {
        state.soldOutAnimationQualityId = null;
        const item = els.recipeBoard.querySelector(`.recipe-board-item[data-quality="${qualityId}"]`);
        if (item) item.dataset.soldOutAnimate = "false";
      }
    }, 820);
  } else {
    state.enabledQualityIds.add(qualityId);
    if (state.soldOutAnimationQualityId === qualityId) {
      state.soldOutAnimationQualityId = null;
      window.clearTimeout(state.soldOutAnimationTimer);
    }
    state.soldOutExitQualityId = qualityId;
    window.clearTimeout(state.soldOutExitTimer);
    state.soldOutExitTimer = window.setTimeout(() => {
      if (state.soldOutExitQualityId === qualityId) {
        state.soldOutExitQualityId = null;
        const item = els.recipeBoard.querySelector(`.recipe-board-item[data-quality="${qualityId}"]`);
        if (item) item.dataset.soldOutExit = "false";
      }
    }, 520);
  }

  if (shouldRefreshCurrentTarget) {
    stopActiveChord();
    chooseRound();
    return;
  }

  if (state.selected.size && !hasAvailableRecipePath()) {
    els.feedback.textContent = SOLD_OUT_PATH_MESSAGE;
    els.feedback.className = "feedback bad";
  } else if (els.feedback.textContent === SOLD_OUT_PATH_MESSAGE) {
    els.feedback.textContent = "";
    els.feedback.className = "feedback";
  }

  renderIngredients();
  renderRecipeBoard();
  updateResetButton();
}

function isRecipePossible(quality) {
  return isSubset(state.selected, new Set(quality.recipe));
}

async function ensureAudioContext(shouldResume = true) {
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (shouldResume && state.audioContext.state === "suspended") {
    await state.audioContext.resume();
  }
  return state.audioContext;
}

async function preloadSamples() {
  if (state.preloadPromise) return state.preloadPromise;

  els.playButton.disabled = true;
  updateResetButton();
  els.audioStatus.textContent = "Piano samples loading...";

  state.preloadPromise = preloadAllSamples();
  return state.preloadPromise;
}

async function preloadAllSamples() {
  try {
    const neededMidis = new Set();
    ROOTS.forEach((root) => {
      CHORD_QUALITIES.forEach((quality) => {
        getChordNotes(root, quality).forEach((note) => neededMidis.add(note.midi));
      });
    });

    const requiredMidis = [...neededMidis];
    await Promise.all(requiredMidis.map((midi) => loadSample(midi)));

    const missingMidis = requiredMidis.filter((midi) => !state.sampleBuffers.get(midi));
    if (missingMidis.length) {
      console.warn("Sample preload incomplete:", missingMidis.map(sampleNameForMidi));
      state.audioReady = false;
      state.samplesReady = false;
      els.playButton.disabled = true;
      updateResetButton();
      els.audioStatus.textContent = "Piano samples loading...";
      return;
    }

    const sortedSampleMetadata = [...state.sampleMetadata.values()]
      .sort((a, b) => b.onsetMs - a.onsetMs);
    const lateSamples = sortedSampleMetadata
      .filter((item) => item.onsetMs > 18)
      .map((item) => `${item.name} onset ${item.onsetMs.toFixed(1)} ms, offset ${item.onsetOffsetMs.toFixed(1)} ms`);
    state.audioReady = true;
    state.samplesReady = true;
    els.playButton.disabled = false;
    els.audioStatus.textContent = "";
    renderIngredients();
    updateResetButton();
  } catch (error) {
    console.warn("Sample preload failed:", error);
    state.audioReady = false;
    state.samplesReady = false;
    els.playButton.disabled = true;
    els.audioStatus.textContent = "Piano samples loading...";
    renderIngredients();
    updateResetButton();
  }
}

async function loadSample(midi) {
  if (state.sampleBuffers.has(midi)) return state.sampleBuffers.get(midi);
  const ctx = await ensureAudioContext(false);

  for (const path of samplePathsForMidi(midi)) {
    try {
      const response = await fetch(path);
      if (!response.ok) continue;
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const onsetInfo = detectOnsetOffset(audioBuffer);
      state.sampleBuffers.set(midi, audioBuffer);
      state.sampleOnsetOffsets.set(midi, onsetInfo.offsetSeconds);
      state.sampleMetadata.set(midi, {
        midi,
        name: sampleNameForMidi(midi),
        path,
        durationSeconds: audioBuffer.duration,
        onsetMs: onsetInfo.onsetSeconds * 1000,
        onsetOffsetMs: onsetInfo.offsetSeconds * 1000
      });
      return audioBuffer;
    } catch (error) {
      // Try the next extension or synth fallback.
    }
  }

  state.sampleBuffers.set(midi, null);
  state.sampleOnsetOffsets.set(midi, 0);
  state.sampleErrors.push(sampleNameForMidi(midi));
  return null;
}

function detectOnsetOffset(buffer, threshold = 0.01) {
  const onsetFrame = findOnsetFrame(buffer, threshold);
  const preRollSeconds = 0.003;
  const onsetSeconds = onsetFrame / buffer.sampleRate;
  const offsetSeconds = Math.max(0, onsetSeconds - preRollSeconds);

  return { onsetSeconds, offsetSeconds };
}

function findOnsetFrame(buffer, threshold) {
  for (let frame = 0; frame < buffer.length; frame += 1) {
    if (frameAmplitude(buffer, frame) >= threshold) {
      return frame;
    }
  }
  return 0;
}

function frameAmplitude(buffer, frame) {
  let amplitude = 0;
  for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
    amplitude = Math.max(amplitude, Math.abs(buffer.getChannelData(channelIndex)[frame]));
  }
  return amplitude;
}

function sampleOnsetOffset(midi) {
  const buffer = state.sampleBuffers.get(midi);
  const offset = state.sampleOnsetOffsets.get(midi) || 0;
  if (!buffer) return 0;
  return Math.min(offset, Math.max(0, buffer.duration - 0.01));
}

function stopActiveChord() {
  const ctx = state.audioContext;
  if (ctx && state.activeGain) {
    const now = ctx.currentTime;
    state.activeGain.gain.cancelScheduledValues(now);
    state.activeGain.gain.setValueAtTime(Math.max(state.activeGain.gain.value, 0.0001), now);
    state.activeGain.gain.linearRampToValueAtTime(0.0001, now + 0.08);
    state.activeSources.forEach((source) => {
      try {
        source.stop(now + 0.1);
      } catch (error) {
        // A source can only be stopped once.
      }
    });
  }
  state.activeSources = [];
  state.activeNoteGains = [];
  state.activeGain = null;
}

function stopActiveCue() {
  const ctx = state.audioContext;
  if (ctx && state.activeCueSources.length) {
    const now = ctx.currentTime;
    state.activeCueGains.forEach((gain) => {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.05);
    });
    state.activeCueSources.forEach((source) => {
      try {
        source.stop(now + 0.12);
      } catch (error) {
        // A source can only be stopped once.
      }
    });
  }

  state.activeCueSources = [];
  state.activeCueGains = [];
}

function midiForIngredient(root, ingredientId) {
  return ROOT_MIDIS[root] + INTERVALS[ingredientId].semitones;
}

async function playIngredientCue(ingredientId) {
  if (!state.audioReady || !state.samplesReady) {
    console.warn("Ingredient cue blocked because samples are not ready.");
    return;
  }

  const ctx = await ensureAudioContext();
  if (ctx.state !== "running") {
    console.warn("Ingredient cue blocked because the audio context is not running.");
    return;
  }

  const ingredientMidi = midiForIngredient(state.current.root, ingredientId);
  const ingredientBuffer = state.sampleBuffers.get(ingredientMidi);
  const ingredient = INGREDIENTS.find((item) => item.id === ingredientId);

  if (!ingredientBuffer) {
    console.warn("Ingredient cue blocked because the sample is missing:", sampleNameForMidi(ingredientMidi));
    els.audioStatus.textContent = "Piano samples loading...";
    return;
  }

  stopActiveCue();
  stopActiveChord();

  const startTime = ctx.currentTime + 0.08;
  const duration = 0.9;
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = ingredientBuffer;

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(0.42, startTime + 0.008);
  gain.gain.setValueAtTime(0.42, startTime + duration - 0.14);
  gain.gain.linearRampToValueAtTime(0.0001, startTime + duration);

  source.connect(gain);
  gain.connect(ctx.destination);

  state.activeCueSources = [source];
  state.activeCueGains = [gain];

  const onsetOffset = sampleOnsetOffset(ingredientMidi);
  source.start(startTime, onsetOffset);
  source.stop(startTime + duration + 0.04);
}

async function playChord() {
  if (!state.audioReady || !state.samplesReady) {
    els.audioStatus.textContent = "Piano samples are still loading. Try again in a moment.";
    console.warn("Chord playback blocked because samples are not ready.");
    return;
  }

  const ctx = await ensureAudioContext();
  if (ctx.state !== "running") {
    console.warn("Chord playback blocked because the audio context is not running.");
    els.audioStatus.textContent = "Tap Hear Order again to wake audio.";
    return;
  }

  const missingNotes = state.current.notes.filter((note) => !state.sampleBuffers.get(note.midi));
  if (missingNotes.length) {
    console.warn("Chord blocked because one or more samples are missing:", missingNotes.map((note) => sampleNameForMidi(note.midi)));
    els.audioStatus.textContent = "Piano samples loading...";
    return;
  }

  stopActiveCue();
  stopActiveChord();

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.setValueAtTime(0.9, ctx.currentTime + 0.08);
  master.connect(ctx.destination);

  state.activeGain = master;
  state.activeSources = [];
  state.activeNoteGains = [];

  const startTime = ctx.currentTime + 0.08;
  const stopTime = startTime + 1.55;
  const scheduledNodes = state.current.notes.map((note) => {
    const source = ctx.createBufferSource();
    const noteGain = ctx.createGain();
    source.buffer = state.sampleBuffers.get(note.midi);
    const onsetOffset = sampleOnsetOffset(note.midi);

    noteGain.gain.setValueAtTime(0.0001, startTime);
    noteGain.gain.linearRampToValueAtTime(0.34, startTime + 0.008);
    noteGain.gain.setValueAtTime(0.34, startTime + 1.22);
    noteGain.gain.linearRampToValueAtTime(0.0001, stopTime);

    source.connect(noteGain);
    noteGain.connect(master);

    return { source, noteGain, onsetOffset };
  });

  state.activeSources = scheduledNodes.map((node) => node.source);
  state.activeNoteGains = scheduledNodes.map((node) => node.noteGain);

  scheduledNodes.forEach(({ source, onsetOffset }) => {
    source.start(startTime, onsetOffset);
    source.stop(stopTime + 0.05);
  });
}

async function playSelectedSoup() {
  if (!state.selected.size) {
    els.feedback.textContent = "Add ingredients first!";
    els.feedback.className = "feedback";
    return;
  }

  if (!state.audioReady || !state.samplesReady) {
    els.audioStatus.textContent = "Piano samples are still loading. Try again in a moment.";
    console.warn("Soup playback blocked because samples are not ready.");
    return;
  }

  const ctx = await ensureAudioContext();
  if (ctx.state !== "running") {
    console.warn("Soup playback blocked because the audio context is not running.");
    els.audioStatus.textContent = "Click the ladle again to wake audio.";
    return;
  }

  const selectedNotes = [...state.selected].map((ingredientId) => {
    const ingredient = INGREDIENTS.find((item) => item.id === ingredientId);
    return {
      ingredientId,
      spelling: ingredient ? ingredient.label : ingredientId,
      midi: midiForIngredient(state.current.root, ingredientId)
    };
  });
  const missingNotes = selectedNotes.filter((note) => !state.sampleBuffers.get(note.midi));
  if (missingNotes.length) {
    console.warn("Soup playback blocked because one or more samples are missing:", missingNotes.map((note) => sampleNameForMidi(note.midi)));
    els.audioStatus.textContent = "Piano samples loading...";
    return;
  }

  stopActiveCue();
  stopActiveChord();

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.setValueAtTime(0.82, ctx.currentTime + 0.08);
  master.connect(ctx.destination);

  state.activeGain = master;
  state.activeSources = [];
  state.activeNoteGains = [];

  const startTime = ctx.currentTime + 0.08;
  const stopTime = startTime + 1.35;
  const noteGainLevel = Math.min(0.42, 0.72 / Math.sqrt(selectedNotes.length));
  const scheduledNodes = selectedNotes.map((note) => {
    const source = ctx.createBufferSource();
    const noteGain = ctx.createGain();
    source.buffer = state.sampleBuffers.get(note.midi);
    const onsetOffset = sampleOnsetOffset(note.midi);

    noteGain.gain.setValueAtTime(0.0001, startTime);
    noteGain.gain.linearRampToValueAtTime(noteGainLevel, startTime + 0.008);
    noteGain.gain.setValueAtTime(noteGainLevel, startTime + 1.02);
    noteGain.gain.linearRampToValueAtTime(0.0001, stopTime);

    source.connect(noteGain);
    noteGain.connect(master);

    return { source, noteGain, onsetOffset };
  });

  state.activeSources = scheduledNodes.map((node) => node.source);
  state.activeNoteGains = scheduledNodes.map((node) => node.noteGain);

  scheduledNodes.forEach(({ source, onsetOffset }) => {
    source.start(startTime, onsetOffset);
    source.stop(stopTime + 0.05);
  });
}

function animateStir(hasIngredients) {
  els.potWrap.classList.remove("stirring", "empty-stir");
  void els.potWrap.offsetWidth;
  els.potWrap.classList.add(hasIngredients ? "stirring" : "empty-stir");
  const cleanupDelay = hasIngredients ? 920 : 540;
  window.setTimeout(() => {
    els.potWrap.classList.remove("stirring", "empty-stir");
  }, cleanupDelay);
}

async function tryMySoup(source = "button") {
  const hasIngredients = state.selected.size > 0;
  if (source === "ladle") {
    animateStir(hasIngredients);
  }
  if (hasIngredients && els.feedback.textContent === "Add ingredients first!") {
    els.feedback.textContent = "";
    els.feedback.className = "feedback";
  }
  await playSelectedSoup();
}

function submitAnswer() {
  const correct = setsEqual(state.selected, new Set(state.current.quality.recipe));
  state.orderServed = true;
  updateNextButton();
  clearAnimations();
  els.feedback.className = "feedback";
  void els.feedback.offsetWidth;
  els.recipe.hidden = true;
  els.recipe.innerHTML = "";

  if (correct) {
    els.feedback.innerHTML = formatCorrectFeedbackHtml();
    els.feedback.className = "feedback good";
    els.potWrap.classList.add("celebrate");
    els.sparkles.classList.add("show");
  } else {
    els.feedback.textContent = "Something tastes off - check the 3rd, 5th, or 7th.";
    els.feedback.className = "feedback bad";
    els.potWrap.classList.add("wobble");
  }
}

function formatCorrectFeedbackHtml() {
  const { root, quality, notes } = state.current;
  const article = usesAnArticle(root) ? "an" : "a";
  const noteNames = notes.map((note) => displayNoteNameHtml(note.spelling)).join(" ");
  return `Yum! That's ${article} ${displayNoteNameHtml(root)} ${escapeHtml(quality.display)} (${noteNames}).`;
}

function usesAnArticle(root) {
  return /^[AEFHILMNORSX]/.test(root);
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  return isSubset(a, b);
}

function isSubset(a, b) {
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

function clearAnimations() {
  els.potWrap.classList.remove("celebrate", "wobble", "stirring", "empty-stir");
  els.sparkles.classList.remove("show");
  void els.potWrap.offsetWidth;
}

els.playButton.addEventListener("click", playChord);
els.ladleButton.addEventListener("click", () => tryMySoup("ladle"));
els.ladleButton.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    tryMySoup("ladle");
  }
});
els.submitButton.addEventListener("click", submitAnswer);
els.resetButton.addEventListener("click", resetIngredients);
els.nextButton.addEventListener("click", () => {
  if (!state.orderServed) return;
  stopActiveChord();
  chooseRound();
});

els.recipeBoardToggle.addEventListener("click", () => {
  if (!isMobileRecipeBoardLayout()) return;
  state.recipeBoardCollapsed = !state.recipeBoardCollapsed;
  updateRecipeBoardCollapse();
});

window.addEventListener("resize", updateRecipeBoardCollapse);

els.rootBadge.addEventListener("click", (event) => {
  event.stopPropagation();
  const now = Date.now();
  const isDoubleClick = now - state.rootBadgeLastClickTime < 320;
  state.rootBadgeLastClickTime = now;

  if (isDoubleClick) {
    if (state.rootBadgeClickTimer) {
      window.clearTimeout(state.rootBadgeClickTimer);
      state.rootBadgeClickTimer = null;
    }
    toggleRootLock();
    return;
  }

  state.rootBadgeClickTimer = window.setTimeout(() => {
    state.rootBadgeClickTimer = null;
    setRootMenuOpen(!state.rootMenuOpen);
  }, 220);
});

document.addEventListener("click", () => {
  if (state.rootMenuOpen) {
    setRootMenuOpen(false);
  }
});

chooseRound();
renderRecipeBoard();
preloadSamples();

window.ChordQualityKitchen = {
  spellNote,
  getChordNotes,
  INGREDIENTS,
  CHORD_QUALITIES,
  ROOTS
};
