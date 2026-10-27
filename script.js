/* =====================================================
   JAVASCRIPT GUIDE

   presets        = ค่าเสียง Target A/B/C
   originalState  = ค่าตั้งต้นของเสียง Original
   exploreState   = ค่าที่ใช้ใน Part 2
   challengeState = ค่าที่ผู้เล่นปรับใน Part 3
   drawFilterGraph() = วาดกราฟ Filter
   playLive()        = เล่นเสียงวนเพื่อทดลองปรับค่า
   ===================================================== */

/* -----------------------------------------------------
   1. ค่าเริ่มต้นและ Presets ของ Target
   ----------------------------------------------------- */

// เสียง Original ยังไม่ผ่านการปรับแต่ง
const originalState = {
  cutoff: 8000,
  pitch: 0,
  reverb: 0,
  gain: 0.8
};

// ค่า Target แต่ละแบบ
const presets = {
  horror: {
    name: "Horror",
    letter: "A",
    cutoff: 300,
    pitch: -5,
    reverb: 0.62,
    gain: 0.78,
    description: "โทนต่ำ มืด และมีหางเสียงเพื่อสร้างบรรยากาศลึกลับ",
    hint: {
      Filter: "150 Hz – 450 Hz",
      Pitch: "−8 to −3 semitones",
      Reverb: "45% – 70%"
    }
  },

  soft: {
    name: "Soft",
    letter: "B",
    cutoff: 1800,
    pitch: 2,
    reverb: 0.18,
    gain: 0.48,
    description: "โทนนุ่ม ลดความแหลมและความแรงของเสียง",
    hint: {
      Filter: "1.2 kHz – 2.5 kHz",
      Pitch: "0 to +3 semitones",
      Reverb: "10% – 25%"
    }
  },

  impact: {
    name: "Impact",
    letter: "C",
    cutoff: 5200,
    pitch: -1,
    reverb: 0.08,
    gain: 1.0,
    description: "เสียงหนักแน่น เน้นแรงปะทะและความชัดของการเคาะ",
    hint: {
      Filter: "3.5 kHz – 6 kHz",
      Pitch: "−3 to +1 semitones",
      Reverb: "0% – 12%"
    }
  }
};

/*
  specs กำหนดค่าของแถบควบคุมเพิ่มเติม

  step = จำนวนที่เปลี่ยนเมื่อกดปุ่ม + หรือ -
  pitch: 1 semitone
  reverb: 0.01 หรือ 1%
  gain: 0.01
*/
const specs = [
  {
    key: "pitch",
    label: "Pitch",
    min: -12,
    max: 12,
    step: 1,
    unit: " semitones",
    help: "เปลี่ยนระดับเสียงสูง–ต่ำ"
  },
  {
    key: "reverb",
    label: "Reverb",
    min: 0,
    max: 0.8,
    step: 0.01,
    unit: "%",
    display: value => Math.round(value * 100) + "%",
    help: "ปรับปริมาณหางเสียง"
  },
  {
    key: "gain",
    label: "Volume",
    min: 0.1,
    max: 1.2,
    step: 0.01,
    unit: "×",
    display: value => value.toFixed(2) + "×",
    help: "ปรับระดับความดัง"
  }
];

/* -----------------------------------------------------
   2. ตัวแปรสถานะของเว็บไซต์และเสียง
   ----------------------------------------------------- */

// จำว่า Part 2 และ Part 3 กำลังเลือก Target ตัวไหนอยู่
let exploreTarget = "horror";
let challengeTarget = "horror";

// แยกค่าของ Part 2 และ Part 3 ออกจากกัน
let exploreState = { ...originalState };
let challengeState = { ...originalState };

// ตัวแปรสำหรับ Web Audio API
let audioCtx = null;
let originalBuffer = null;
let impulseBuffer = null;
let activeSource = null;
let activeNodes = null;

// ฟังก์ชันช่วยเรียก element จาก id
const $ = id => document.getElementById(id);

/* -----------------------------------------------------
   3. เปลี่ยนหน้าของเว็บไซต์
   ----------------------------------------------------- */

function showScreen(id) {
  // หยุดเสียงก่อนเปลี่ยนหน้า
  stopAudio();

  // ซ่อนทุกหน้า
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.add("hidden");
  });

  // เปิดเฉพาะหน้าที่เลือก
  $(id).classList.remove("hidden");

  // เลื่อนกลับไปด้านบนของหน้า
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// คัดลอก object เพื่อไม่ให้ค่า Target ถูกแก้โดยตรง
function cloneState(state) {
  return { ...state };
}

/* -----------------------------------------------------
   4. สร้างเสียงด้วย Web Audio API
   ไม่ต้องโหลดไฟล์เสียงภายนอก
   ----------------------------------------------------- */

function initAudio() {
  // สร้าง AudioContext ครั้งแรกที่มีการเล่นเสียง
  if (!audioCtx) {
    audioCtx = new (
      window.AudioContext || window.webkitAudioContext
    )();
  }

  // บางเบราว์เซอร์ต้อง resume ก่อนเล่นเสียง
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  return audioCtx;
}

// สร้างเสียงเคาะประตูจำลอง
function makeKnockBuffer() {
  const context = initAudio();
  const sampleRate = context.sampleRate;
  const duration = 1.05;
  const length = Math.floor(sampleRate * duration);

  const buffer = context.createBuffer(
    1,
    length,
    sampleRate
  );

  const data = buffer.getChannelData(0);

  // เสียงเคาะ 3 ครั้ง
  const hits = [0.04, 0.18, 0.33];

  for (let i = 0; i < length; i++) {
    const time = i / sampleRate;
    let value = 0;

    hits.forEach(hitTime => {
      const elapsed = time - hitTime;

      if (elapsed >= 0) {
        const envelope = Math.exp(-elapsed * 19);

        // ผสมความถี่หลายย่านให้คล้ายเสียงเคาะ
        value += envelope * (
          0.7 * Math.sin(2 * Math.PI * 115 * elapsed) +
          0.36 * Math.sin(2 * Math.PI * 220 * elapsed) +
          0.18 * Math.sin(2 * Math.PI * 390 * elapsed)
        );

        // เติม noise สั้น ๆ เพื่อเพิ่มลักษณะเสียงกระแทก
        value += (
          (Math.random() * 2 - 1) *
          Math.exp(-elapsed * 75) *
          0.17
        );
      }
    });

    data[i] = value * 0.65;
  }

  return buffer;
}

// สร้างเสียง Original เพียงครั้งเดียว แล้วใช้ซ้ำ
function getOriginalBuffer() {
  if (!originalBuffer) {
    originalBuffer = makeKnockBuffer();
  }

  return originalBuffer;
}

// สร้าง Impulse Response สำหรับเอฟเฟกต์ Reverb
function makeImpulse() {
  const context = initAudio();
  const sampleRate = context.sampleRate;
  const length = Math.floor(sampleRate * 2.2);

  const buffer = context.createBuffer(
    2,
    length,
    sampleRate
  );

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);

    for (let i = 0; i < length; i++) {
      const fade = Math.pow(1 - i / length, 2.5);
      data[i] = (Math.random() * 2 - 1) * fade;
    }
  }

  return buffer;
}

// สร้าง Reverb impulse เพียงครั้งเดียว
function getImpulse() {
  if (!impulseBuffer) {
    impulseBuffer = makeImpulse();
  }

  return impulseBuffer;
}

/* -----------------------------------------------------
   5. ควบคุมการเล่นและหยุดเสียง
   ----------------------------------------------------- */

// หยุดเสียงที่กำลังเล่นอยู่
function stopAudio() {
  if (activeSource) {
    try {
      activeSource.stop();
    } catch (error) {
      // หากเสียงหยุดไปแล้ว ไม่ต้องทำอะไรเพิ่ม
    }

    try {
      activeSource.disconnect();
    } catch (error) {}

    activeSource = null;
  }

  activeNodes = null;
}

/*
  สร้างเส้นทางเสียง:

  Source
    ↓
  Low-pass Filter
    ├── Dry signal ────────────┐
    └── Reverb → Wet signal ───┤
                               ↓
                             Volume
                               ↓
                            Speakers
*/
function createAudioChain(values, loop) {
  const context = initAudio();

  // แหล่งกำเนิดเสียง
  const source = context.createBufferSource();
  source.buffer = getOriginalBuffer();
  source.loop = Boolean(loop);

  // แปลง semitone เป็นอัตราการเล่นเสียง
  source.playbackRate.value = Math.pow(
    2,
    (values.pitch || 0) / 12
  );

  // Filter แบบ Low-pass
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = values.cutoff;
  filter.Q.value = 0.7;

  // สัญญาณเสียงปกติ
  const dry = context.createGain();

  // สัญญาณเสียง Reverb
  const wet = context.createGain();

  const convolver = context.createConvolver();
  convolver.buffer = getImpulse();

  // Volume สุดท้าย
  const volume = context.createGain();

  // ตั้งค่าระดับ Dry/Wet
  dry.gain.value = 1 - (values.reverb || 0) * 0.55;
  wet.gain.value = (values.reverb || 0) * 0.85;
  volume.gain.value = values.gain ?? 0.8;

  // ต่อ Audio Nodes เข้าด้วยกัน
  source.connect(filter);

  filter.connect(dry);
  dry.connect(volume);

  filter.connect(convolver);
  convolver.connect(wet);
  wet.connect(volume);

  volume.connect(context.destination);

  source.start();

  return {
    src: source,
    filter,
    dry,
    wet,
    conv: convolver,
    vol: volume
  };
}

// เล่นเสียงหนึ่งครั้ง
function playOneShot(key) {
  stopAudio();

  const values = key === "original"
    ? originalState
    : presets[key];

  const nodes = createAudioChain(values, false);

  activeSource = nodes.src;
  activeNodes = nodes;

  nodes.src.onended = () => {
    if (activeSource === nodes.src) {
      activeSource = null;
      activeNodes = null;
    }
  };
}

// เล่นเสียงวน เพื่อทดลองปรับค่าไปพร้อมกับฟังเสียง
function playLive(values) {
  stopAudio();

  const nodes = createAudioChain(values, true);

  activeSource = nodes.src;
  activeNodes = nodes;
}

function playExplore() {
  playLive(exploreState);
}

function playChallenge() {
  playLive(challengeState);
}

/*
  อัปเดตเสียงที่กำลังเล่นอยู่
  setTargetAtTime ช่วยให้การเปลี่ยนค่าไม่กระชากเกินไป
*/
function updateLiveAudio(values) {
  if (!activeNodes) return;

  const now = audioCtx.currentTime;

  activeNodes.filter.frequency.setTargetAtTime(
    values.cutoff,
    now,
    0.025
  );

  activeNodes.src.playbackRate.setTargetAtTime(
    Math.pow(2, (values.pitch || 0) / 12),
    now,
    0.025
  );

  activeNodes.dry.gain.setTargetAtTime(
    1 - (values.reverb || 0) * 0.55,
    now,
    0.025
  );

  activeNodes.wet.gain.setTargetAtTime(
    (values.reverb || 0) * 0.85,
    now,
    0.025
  );

  activeNodes.vol.gain.setTargetAtTime(
    values.gain ?? 0.8,
    now,
    0.025
  );
}

/* -----------------------------------------------------
   6. วาดกราฟ Frequency Response ของ Filter
   ----------------------------------------------------- */

/*
  แกน X = ความถี่ (Hz) แบบ logarithmic
  แกน Y = ระดับสัญญาณ (dB)

  จุดสีเขียวแสดง Cutoff Frequency
*/
function drawFilterGraph(svgId, values, stateKey) {
  const svg = $(svgId);
  if (!svg) return;

  const W = 720;
  const H = 245;

  const L = 48;
  const R = 18;
  const T = 18;
  const B = 37;

  const graphWidth = W - L - R;
  const graphHeight = H - T - B;

  // แปลงความถี่เป็นตำแหน่ง X
  const xFreq = frequency =>
    L +
    (
      Math.log10(frequency / 20) /
      Math.log10(20000 / 20)
    ) * graphWidth;

  // แปลงค่า dB เป็นตำแหน่ง Y
  const yDb = db =>
    T + (-db / 60) * graphHeight;

  let grid = "";

  // เส้นแนวนอนแสดงระดับ dB
  [0, -12, -24, -36, -48, -60].forEach(db => {
    const y = yDb(db);

    grid += `
      <line
        x1="${L}" y1="${y}"
        x2="${W - R}" y2="${y}"
        stroke="#252936"
        stroke-width="1"
      />

      <text
        x="${L - 9}"
        y="${y + 4}"
        fill="#818698"
        font-size="10"
        text-anchor="end"
      >${db}</text>
    `;
  });

  // เส้นแนวตั้งแสดงความถี่
  [20, 100, 1000, 10000, 20000].forEach(frequency => {
    const x = xFreq(frequency);

    const label = frequency >= 1000
      ? (frequency / 1000) + "k"
      : frequency;

    grid += `
      <line
        x1="${x}" y1="${T}"
        x2="${x}" y2="${H - B}"
        stroke="#252936"
        stroke-width="1"
      />

      <text
        x="${x}"
        y="${H - 13}"
        fill="#818698"
        font-size="10"
        text-anchor="middle"
      >${label}</text>
    `;
  });

  // คำนวณเส้นตอบสนองของ Low-pass Filter
  let path = "";

  for (let i = 0; i <= 180; i++) {
    const frequency = 20 * Math.pow(1000, i / 180);

    const db = -10 * Math.log10(
      1 + Math.pow(frequency / values.cutoff, 2)
    );

    const x = xFreq(frequency);
    const y = yDb(Math.max(-60, db));

    path +=
      (i ? " L" : "M") +
      x.toFixed(2) +
      " " +
      y.toFixed(2);
  }

  const cutoffX = xFreq(values.cutoff);
  const cutoffY = yDb(-3);

  // สร้างกราฟ SVG
  svg.innerHTML = `
    <defs>
      <linearGradient
        id="fill-${svgId}"
        x1="0" x2="0" y1="0" y2="1"
      >
        <stop
          offset="0%"
          stop-color="#c5fa70"
          stop-opacity=".22"
        />
        <stop
          offset="100%"
          stop-color="#c5fa70"
          stop-opacity="0"
        />
      </linearGradient>
    </defs>

    ${grid}

    <path
      d="${path} L ${W - R} ${H - B} L ${L} ${H - B} Z"
      fill="url(#fill-${svgId})"
    />

    <path
      d="${path}"
      fill="none"
      stroke="#c5fa70"
      stroke-width="3"
      stroke-linejoin="round"
    />

    <line
      x1="${cutoffX}"
      y1="${T}"
      x2="${cutoffX}"
      y2="${H - B}"
      stroke="#c5fa70"
      stroke-dasharray="4 5"
      opacity=".65"
    />

    <circle
      cx="${cutoffX}"
      cy="${cutoffY}"
      r="7"
      fill="#c5fa70"
      stroke="#10120d"
      stroke-width="3"
    />

    <text
      x="${Math.min(W-R-5, Math.max(L+45, cutoffX))}"
      y="${T+12}"
      fill="#c5fa70"
      font-size="11"
      text-anchor="middle"
    >${values.cutoff} Hz</text>

    <text
      x="${L}"
      y="12"
      fill="#818698"
      font-size="10"
    >GAIN (dB)</text>

    <text
      x="${W-R}"
      y="${H-1}"
      fill="#818698"
      font-size="10"
      text-anchor="end"
    >FREQUENCY (Hz)</text>
  `;
}

/* -----------------------------------------------------
   7. อัปเดตตัวควบคุมของ Part 2 และ Part 3
   ----------------------------------------------------- */

function refreshEditor(which) {
  const isExplore = which === "explore";

  const state = isExplore
    ? exploreState
    : challengeState;

  const graph = isExplore
    ? "exploreGraph"
    : "challengeGraph";

  const cutoffInput = isExplore
    ? "exploreCutoff"
    : "challengeCutoff";

  const cutoffOutput = isExplore
    ? "exploreCutoffOut"
    : "challengeCutoffOut";

  // อัปเดตแถบ Cutoff และตัวเลข
  $(cutoffInput).value = state.cutoff;
  $(cutoffOutput).textContent = state.cutoff + " Hz";

  // วาดกราฟใหม่
  drawFilterGraph(graph, state, which);

  // สร้างแถบควบคุม Pitch, Reverb และ Volume
  renderExtraControls(
    isExplore ? "exploreControls" : "challengeControls",
    state,
    which
  );
}

// เปลี่ยนค่า Cutoff จากแถบเลื่อนหรือกราฟ
function setCutoff(which, value) {
  const state = which === "explore"
    ? exploreState
    : challengeState;

  // จำกัด Cutoff ให้อยู่ระหว่าง 200–8000 Hz
  state.cutoff = Math.max(
    200,
    Math.min(8000, Math.round(value / 10) * 10)
  );

  // อัปเดตตัวเลขและแถบเลื่อน
  $(which + "Cutoff").value = state.cutoff;
  $(which + "CutoffOut").textContent = state.cutoff + " Hz";

  // วาดกราฟใหม่ทันที
  drawFilterGraph(
    which === "explore" ? "exploreGraph" : "challengeGraph",
    state,
    which
  );

  // หากกำลังเล่นเสียง ให้เปลี่ยนเสียงตามค่าปัจจุบัน
  updateLiveAudio(state);
}

// ปุ่ม + / − ปรับ Cutoff ทีละ 100 Hz
function nudgeCutoff(which, direction) {
  const state = which === "explore"
    ? exploreState
    : challengeState;

  setCutoff(
    which,
    state.cutoff + direction * 100
  );
}

/*
  สร้างตัวควบคุม Pitch, Reverb และ Volume

  แต่ละตัวมี:
  - ปุ่ม − สำหรับลดค่า
  - แถบเลื่อนสำหรับปรับค่า
  - ปุ่ม + สำหรับเพิ่มค่า

  ค่า step จะกำหนดในตัวแปร specs ด้านบน
*/
function renderExtraControls(id, state, which) {
  const container = $(id);

  // ล้างตัวควบคุมเดิมก่อนสร้างใหม่
  container.innerHTML = "";

  specs.forEach(spec => {
    const wrap = document.createElement("div");
    wrap.className = "control";

    // สร้าง HTML ของตัวควบคุมหนึ่งชุด
    wrap.innerHTML = `
      <label for="${id}-${spec.key}">
        <span>
          ${spec.label}
          <small>${spec.help}</small>
        </span>

        <output id="${id}-${spec.key}-out"></output>
      </label>

      <div class="stepper">
        <button
          type="button"
          data-step="-1"
          aria-label="ลด ${spec.label}"
        >−</button>

        <input
          type="range"
          id="${id}-${spec.key}"
          min="${spec.min}"
          max="${spec.max}"
          step="${spec.step}"
          value="${state[spec.key]}"
        >

        <button
          type="button"
          data-step="1"
          aria-label="เพิ่ม ${spec.label}"
        >+</button>
      </div>
    `;

    container.appendChild(wrap);

    const input = wrap.querySelector("input");
    const output = wrap.querySelector("output");

    // อ่านค่าจากแถบเลื่อนและแสดงผล
    const update = () => {
      state[spec.key] = Number(input.value);

      output.textContent = spec.display
        ? spec.display(state[spec.key])
        : state[spec.key] + spec.unit;

      updateLiveAudio(state);
    };

    input.addEventListener("input", update);

    // เมื่อกด + หรือ - ให้เปลี่ยนค่าเท่ากับ step ที่กำหนด
    wrap.querySelectorAll("button[data-step]").forEach(button => {
      button.addEventListener("click", () => {
        const direction = Number(button.dataset.step);

        const next = Math.max(
          spec.min,
          Math.min(
            spec.max,
            Number(input.value) + direction * spec.step
          )
        );

        // ป้องกันทศนิยมยาวเกินไป
        input.value = String(Number(next.toFixed(4)));

        // ส่ง event input เพื่อให้ตัวเลขและเสียงอัปเดตเหมือนลากแถบ
        input.dispatchEvent(
          new Event("input", { bubbles: true })
        );
      });
    });

    // แสดงค่าเริ่มต้น
    update();
  });
}

/* -----------------------------------------------------
   8. PART 2 — เลือก Target และทดลองปรับเสียง
   ----------------------------------------------------- */

function openExplore(key) {
  stopAudio();

  exploreTarget = key;

  // ใน Part 2 โหลดค่า Target ที่เลือกมาให้ทดลอง
  exploreState = cloneState(presets[key]);

  $("exploreTitle").textContent =
    presets[key].name + " · Learn & Explore";

  $("exploreDesc").textContent =
    presets[key].description;

  $("exploreLetter").textContent =
    presets[key].letter;

  $("exploreSampleTitle").textContent =
    "Target " + presets[key].letter + " · " + presets[key].name;

  refreshEditor("explore");

  showScreen("part2DetailScreen");
}

// Reset Part 2 ให้กลับไปค่า Original
function resetExplore() {
  stopAudio();

  exploreState = cloneState(originalState);

  refreshEditor("explore");
}

/* -----------------------------------------------------
   9. PART 3 — เริ่ม Challenge จาก Original เสมอ
   ----------------------------------------------------- */

function startChallenge() {
  challengeTarget = exploreTarget;

  // สำคัญ: เริ่มจาก Original ไม่ใช่ค่า Target
  challengeState = cloneState(originalState);

  showScreen("part3Screen");

  chooseChallengeTarget(challengeTarget);

  refreshEditor("challenge");
}

// เมื่อเปลี่ยน Target ใน Part 3 ให้เริ่มจาก Original อีกครั้ง
function chooseChallengeTarget(key) {
  stopAudio();

  challengeTarget = key;
  challengeState = cloneState(originalState);

  // เปลี่ยนสีปุ่ม Target ที่เลือก
  document.querySelectorAll(".target-btn").forEach(button => {
    button.classList.remove("active");
  });

  $("t" + key[0].toUpperCase() + key.slice(1))
    .classList.add("active");

  // แสดง Hint เป็นช่วงค่าแบบสั้น
  const hints = presets[key].hint;

  $("hintLines").innerHTML = Object.entries(hints)
    .map(([name, value]) =>
      `<span class="hint-chip">${name}: ${value}</span>`
    )
    .join("");

  refreshEditor("challenge");
}

// Reset Part 3 กลับไปค่า Original
function resetChallenge() {
  stopAudio();

  challengeState = cloneState(originalState);

  refreshEditor("challenge");
}

/* -----------------------------------------------------
   10. คำนวณคะแนน Challenge
   ----------------------------------------------------- */

// คำนวณความใกล้เคียงระหว่างค่าที่ผู้เล่นปรับกับ Target
function submitChallenge() {
  stopAudio();

  const target = presets[challengeTarget];

  // ความแตกต่างของแต่ละค่าเทียบกับช่วงค่าที่เป็นไปได้
  const differences = [
    Math.abs(challengeState.cutoff - target.cutoff) / (8000 - 200),
    Math.abs(challengeState.pitch - target.pitch) / 24,
    Math.abs(challengeState.reverb - target.reverb) / 0.8
  ];

  // เฉลี่ยความแตกต่าง แล้วแปลงเป็นคะแนนเต็ม 100
  let score = Math.round(
    100 * (
      1 -
      differences.reduce((sum, value) => sum + value, 0) /
      differences.length
    )
  );

  // จำกัดคะแนนให้อยู่ในช่วง 0–100
  score = Math.max(0, Math.min(100, score));

  // แสดงผลคะแนนใน Popup
  $("scoreNumber").textContent = score;

  $("scoreTitle").textContent =
    score >= 85
      ? "Excellent match!"
      : score >= 60
        ? "Getting closer!"
        : "Keep experimenting!";

  $("scoreText").textContent =
    `Your sound was compared with Target ${target.letter} · ${target.name}. ` +
    "ลองปรับ Filter, Pitch และ Reverb แล้วฟังเปรียบเทียบอีกครั้ง";

  $("scoreModal").classList.remove("hidden");
}

// ปิดหน้าต่างคะแนน
function closeScoreModal() {
  $("scoreModal").classList.add("hidden");
}

/* -----------------------------------------------------
   11. PART 1 — สร้าง Quiz
   ----------------------------------------------------- */

// ตัวเลือกคำตอบที่ถูกต้องของแต่ละข้อ
const quizQuestions = [
  {
    key: "horror",
    label: "ข้อ 1 — เสียงแบบ Horror",
    desc: "เสียงไหนเหมาะกับฉากที่ต้องการความน่ากลัวหรือลึกลับ?",
    answer: "A"
  },
  {
    key: "soft",
    label: "ข้อ 2 — เสียงแบบ Soft",
    desc: "เสียงไหนเหมาะกับความรู้สึกนุ่มนวลและเบาสบาย?",
    answer: "B"
  },
  {
    key: "impact",
    label: "ข้อ 3 — เสียงแบบ Impact",
    desc: "เสียงไหนเหมาะกับจังหวะที่ต้องการแรงปะทะและความหนักแน่น?",
    answer: "C"
  }
];

// เก็บคำตอบที่ผู้เล่นเลือก
let answers = {};

// สร้างคำถามและปุ่มฟังเสียง A/B/C
function buildQuiz() {
  const root = $("quiz");

  root.innerHTML = "";

  quizQuestions.forEach(question => {
    const item = document.createElement("div");

    item.className = "quiz-question";

    item.innerHTML = `
      <h3>${question.label}</h3>

      <p class="sub" style="margin:0 0 10px">
        ${question.desc}
      </p>

      <div class="quiz-options">
        ${["A", "B", "C"].map(key =>
          `<button data-play="${key}">ฟัง ${key} ▶</button>`
        ).join("")}

        <span style="width:8px"></span>

        ${["A", "B", "C"].map(key =>
          `<button data-answer="${key}">${key}</button>`
        ).join("")}
      </div>

      <div class="feedback" id="feedback-${question.key}"></div>
    `;

    root.appendChild(item);
  });

  // ปุ่มฟังเสียงแต่ละ Target
  root.querySelectorAll("[data-play]").forEach(button => {
    button.addEventListener("click", () => {
      const soundKey = {
        A: "horror",
        B: "soft",
        C: "impact"
      }[button.dataset.play];

      playOneShot(soundKey);
    });
  });

  // ปุ่มตอบคำถาม
  root.querySelectorAll("[data-answer]").forEach(button => {
    button.addEventListener("click", () => {
      const item = button.closest(".quiz-question");

      const question = quizQuestions.find(q =>
        item.querySelector("h3").textContent === q.label
      );

      // บันทึกคำตอบ
      answers[question.key] = button.dataset.answer;

      // ทำเครื่องหมายปุ่มที่เลือก
      item.querySelectorAll("[data-answer]").forEach(option => {
        option.classList.toggle("chosen", option === button);
      });

      $("feedback-" + question.key).textContent =
        "เลือก " + button.dataset.answer + " แล้ว";

      const answeredCount = Object.keys(answers).length;

      $("quizStatus").textContent =
        `ตอบแล้ว ${answeredCount}/3 ข้อ`;

      // อนุญาตให้ไปต่อเมื่อครบทุกข้อ
      $("toPart2").disabled = answeredCount !== 3;
    });
  });
}

/* -----------------------------------------------------
   12. ลากกราฟเพื่อปรับ Cutoff
   ----------------------------------------------------- */

// แปลงตำแหน่ง X บนกราฟกลับเป็นความถี่แบบ logarithmic
function attachGraphDrag(svgId, which) {
  const svg = $(svgId);

  let dragging = false;

  function updateFromEvent(event) {
    const rect = svg.getBoundingClientRect();

    // ตำแหน่ง X เทียบกับความกว้าง SVG 720 หน่วย
    const x = (
      (event.clientX - rect.left) / rect.width
    ) * 720;

    const left = 48;
    const right = 18;
    const graphWidth = 720 - left - right;

    const normalized = Math.max(
      0,
      Math.min(1, (x - left) / graphWidth)
    );

    // แปลงกลับเป็นความถี่ช่วง 20–20000 Hz
    const frequency = 20 * Math.pow(1000, normalized);

    setCutoff(which, frequency);
  }

  // เริ่มลาก
  svg.addEventListener("pointerdown", event => {
    dragging = true;
    svg.setPointerCapture(event.pointerId);
    updateFromEvent(event);
  });

  // อัปเดตขณะลาก
  svg.addEventListener("pointermove", event => {
    if (dragging) {
      updateFromEvent(event);
    }
  });

  // จบการลาก
  svg.addEventListener("pointerup", () => {
    dragging = false;
  });

  svg.addEventListener("pointercancel", () => {
    dragging = false;
  });
}

/* -----------------------------------------------------
   13. เชื่อม Event และเริ่มต้นเว็บไซต์
   ----------------------------------------------------- */

// เมื่อเลื่อน Cutoff ให้เปลี่ยนค่า Filter
$("exploreCutoff").addEventListener("input", event => {
  setCutoff("explore", Number(event.target.value));
});

$("challengeCutoff").addEventListener("input", event => {
  setCutoff("challenge", Number(event.target.value));
});

// เปิดใช้งานการลากกราฟทั้ง Part 2 และ Part 3
attachGraphDrag("exploreGraph", "explore");
attachGraphDrag("challengeGraph", "challenge");

// สร้าง Quiz และแสดงตัวควบคุมเริ่มต้น
buildQuiz();

refreshEditor("explore");
refreshEditor("challenge");
