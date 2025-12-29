import { db, fs, auth, googleProvider } from "./firebase.js";

const $log = document.getElementById("log");
const log = (m) => ($log.textContent += m + "\n");

const $authState = document.getElementById("authState");
const $uidBox = document.getElementById("uidBox");

const $btnLogin = document.getElementById("btnLogin");
const $btnLogout = document.getElementById("btnLogout");

// Tabs
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tabPanel").forEach(p => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove("hidden");
  });
});

// Form elements - Gear
const $gearId = document.getElementById("gearId");
const $gearCategory = document.getElementById("gearCategory");
const $gearBrand = document.getElementById("gearBrand");
const $gearModel = document.getElementById("gearModel");
const $gearImageUrl = document.getElementById("gearImageUrl");
const $gearSpecs = document.getElementById("gearSpecs");
const $gearMsg = document.getElementById("gearMsg");
const $btnGearSave = document.getElementById("btnGearSave");
const $btnGearReset = document.getElementById("btnGearReset");

// Form elements - People
const $peopleId = document.getElementById("peopleId");
const $peopleType = document.getElementById("peopleType");
const $peopleNickname = document.getElementById("peopleNickname");
const $peopleOrg = document.getElementById("peopleOrg");
const $peopleRole = document.getElementById("peopleRole");
const $peopleCountry = document.getElementById("peopleCountry");
const $peopleAvatarUrl = document.getElementById("peopleAvatarUrl");
const $peopleDpi = document.getElementById("peopleDpi");
const $peopleSens = document.getElementById("peopleSens");
const $peopleRes = document.getElementById("peopleRes");
const $peopleSources = document.getElementById("peopleSources");

const $peopleGearMouse = document.getElementById("peopleGearMouse");
const $peopleGearMousepad = document.getElementById("peopleGearMousepad");
const $peopleGearKeyboard = document.getElementById("peopleGearKeyboard");
const $peopleGearHeadset = document.getElementById("peopleGearHeadset");
const $peopleGearMonitor = document.getElementById("peopleGearMonitor");

const $peopleMsg = document.getElementById("peopleMsg");
const $btnPeopleSave = document.getElementById("btnPeopleSave");
const $btnPeopleReset = document.getElementById("btnPeopleReset");

// Manage
const $peopleList = document.getElementById("peopleList");
const $gearList = document.getElementById("gearList");
const $managePeopleSearch = document.getElementById("managePeopleSearch");
const $manageGearSearch = document.getElementById("manageGearSearch");
const $btnDeleteSelected = document.getElementById("btnDeleteSelected");
const $manageMsg = document.getElementById("manageMsg");

// Sources UI
const $srcType = document.getElementById("srcType");
const $srcDate = document.getElementById("srcDate");
const $srcUrl = document.getElementById("srcUrl");
const $srcNote = document.getElementById("srcNote");
const $btnSrcAdd = document.getElementById("btnSrcAdd");
const $btnSrcClear = document.getElementById("btnSrcClear");
const $srcList = document.getElementById("srcList");

// Links UI (방송/채널 링크)
const $linkPlatform = document.getElementById("linkPlatform");
const $linkLabel = document.getElementById("linkLabel");
const $linkUrl = document.getElementById("linkUrl");
const $btnLinkAdd = document.getElementById("btnLinkAdd");
const $btnLinkClear = document.getElementById("btnLinkClear");
const $linkList = document.getElementById("linkList");
const $peopleLinks = document.getElementById("peopleLinks");

let currentUser = null;
let cacheGear = [];
let cachePeople = [];
let selected = { type: null, id: null }; // {type: "gear"|"people", id}
let sourcesState = []; // ✅ 사람 폼의 sources를 여기서 관리
let linksState = [];   // ✅ 사람 폼의 방송/채널 링크 관리

function escapeHtml(s=""){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function todayYYYYMMDD(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function isValidUrl(u){
  try { new URL(u); return true; } catch { return false; }
}

function syncSourcesTextarea(){
  // 숨겨진 peopleSources textarea에 JSON으로 동기화(백업/호환)
  $peopleSources.value = JSON.stringify(sourcesState, null, 2);
}

function renderSources(){
  if (!Array.isArray(sourcesState) || sourcesState.length === 0){
    $srcList.innerHTML = `<div class="panel small">출처가 없습니다. 최소 1개 넣으면 신뢰도가 확 올라갑니다.</div>`;
    syncSourcesTextarea();
    return;
  }

  $srcList.innerHTML = sourcesState.map((s, idx) => {
    const t = escapeHtml(s.type || "other");
    const date = escapeHtml(s.date || "");
    const note = escapeHtml(s.note || "");
    const url = escapeHtml(s.url || "");
    const urlLabel = url ? `<a href="${url}" target="_blank" rel="noreferrer">열기</a>` : "—";

    return `
      <div class="item">
        <div class="left">
          <div class="title">${t}${date ? ` · ${date}` : ""}</div>
          <div class="sub">${note || "(메모 없음)"}</div>
          ${url ? `<div class="small">${url}</div>` : ``}
        </div>
        <div class="right" style="display:flex; gap:10px; align-items:center;">
          ${urlLabel}
          <button class="btn ghost" data-src-del="${idx}" style="padding:8px 10px;">삭제</button>
        </div>
      </div>
    `;
  }).join("");

  // delete bind
  $srcList.querySelectorAll("[data-src-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.srcDel);
      if (!Number.isFinite(i)) return;
      sourcesState.splice(i, 1);
      renderSources();
      setMsg($peopleMsg, "출처가 삭제되었습니다.");
    });
  });

  syncSourcesTextarea();
}

function clearSourceInputs(){
  $srcType.value = "youtube";
  $srcDate.value = "";
  $srcUrl.value = "";
  $srcNote.value = "";
}


function mustBeLoggedIn(){
  if (!currentUser) {
    throw new Error("로그인이 필요합니다. 오른쪽 위에서 구글 로그인하세요.");
  }
}

function parseJsonOrEmptyObject(text){
  const t = (text || "").trim();
  if (!t) return {};
  try { return JSON.parse(t); }
  catch { throw new Error("specs JSON이 올바르지 않습니다."); }
}

function parseJsonArrayOrEmpty(text){
  const t = (text || "").trim();
  if (!t) return [];
  try {
    const v = JSON.parse(t);
    if (!Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new Error("sources는 JSON 배열([])이어야 합니다.");
  }
}

function setMsg($el, msg, isError=false){
  $el.textContent = msg;
  $el.style.color = isError ? "rgba(255,95,95,.9)" : "rgba(159,176,192,.95)";
}

async function refreshCaches(){
  // Gear
  const gearSnap = await fs.getDocs(fs.collection(db, "gear"));
  cacheGear = gearSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => `${a.brand||""} ${a.model||""}`.localeCompare(`${b.brand||""} ${b.model||""}`));

  // People
  const peopleSnap = await fs.getDocs(fs.collection(db, "people"));
  cachePeople = peopleSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (a.nickname||"").localeCompare(b.nickname||""));

  renderGearDropdowns();
  renderManageLists();
}

function buildOption(value, label){
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  return opt;
}

function fillSelect($select, items, placeholder="(미등록)"){
  $select.innerHTML = "";
  $select.appendChild(buildOption("", placeholder));
  for (const it of items){
    const label = `${it.brand || ""} ${it.model || ""}`.trim() || it.id;
    $select.appendChild(buildOption(it.id, label));
  }
}

function renderGearDropdowns(){
  fillSelect($peopleGearMouse, cacheGear.filter(g=>g.category==="mouse"), "(미등록)");
  fillSelect($peopleGearMousepad, cacheGear.filter(g=>g.category==="mousepad"), "(미등록)");
  fillSelect($peopleGearKeyboard, cacheGear.filter(g=>g.category==="keyboard"), "(미등록)");
  fillSelect($peopleGearHeadset, cacheGear.filter(g=>g.category==="headset"), "(미등록)");
  fillSelect($peopleGearMonitor, cacheGear.filter(g=>g.category==="monitor"), "(미등록)");
}

function renderManageLists(){
  const pQ = ($managePeopleSearch.value || "").trim().toLowerCase();
  const gQ = ($manageGearSearch.value || "").trim().toLowerCase();

  const peopleFiltered = cachePeople.filter(p => {
    const hay = `${p.nickname||""} ${p.org||""} ${p.role||""}`.toLowerCase();
    return !pQ || hay.includes(pQ);
  });

  const gearFiltered = cacheGear.filter(g => {
    const hay = `${g.brand||""} ${g.model||""} ${g.category||""}`.toLowerCase();
    return !gQ || hay.includes(gQ);
  });

  $peopleList.innerHTML = peopleFiltered.map(p => `
    <div class="item ${selected.type==="people" && selected.id===p.id ? "selected" : ""}" data-type="people" data-id="${escapeHtml(p.id)}">
      <div class="left">
        <div class="title">${escapeHtml(p.nickname||p.id)}</div>
        <div class="sub">${escapeHtml([p.org, p.role].filter(Boolean).join(" · "))}</div>
      </div>
      <div class="right">${escapeHtml(p.type||"")}</div>
    </div>
  `).join("") || `<div class="panel small">사람이 없습니다.</div>`;

  $gearList.innerHTML = gearFiltered.map(g => `
    <div class="item ${selected.type==="gear" && selected.id===g.id ? "selected" : ""}" data-type="gear" data-id="${escapeHtml(g.id)}">
      <div class="left">
        <div class="title">${escapeHtml(`${g.brand||""} ${g.model||""}`.trim() || g.id)}</div>
        <div class="sub">${escapeHtml(g.category||"")}</div>
      </div>
      <div class="right">${escapeHtml(g.brand||"")}</div>
    </div>
  `).join("") || `<div class="panel small">장비가 없습니다.</div>`;

  // bind click
  [...$peopleList.querySelectorAll(".item[data-type]"), ...$gearList.querySelectorAll(".item[data-type]")].forEach(el => {
    el.addEventListener("click", () => {
      selected = { type: el.dataset.type, id: el.dataset.id };
      setMsg($manageMsg, `선택됨: ${selected.type} / ${selected.id}`);
      renderManageLists();
      loadSelectedIntoForm();
    });
  });
}

function syncLinksTextarea(){
  if (!$peopleLinks) return;
  $peopleLinks.value = JSON.stringify(linksState, null, 2);
}

function platformLabel(p){
  switch((p || "").toLowerCase()){
    case "chzzk": return "치지직";
    case "youtube": return "유튜브";
    case "twitch": return "트위치";
    case "soop": return "SOOP";
    default: return p || "other";
  }
}

function renderLinks(){
  if (!$linkList) return;

  if (!Array.isArray(linksState) || linksState.length === 0){
    $linkList.innerHTML = `<div class="panel small">링크가 없습니다. (선택)</div>`;
    syncLinksTextarea();
    return;
  }

  $linkList.innerHTML = linksState.map((l, idx) => {
    const platform = escapeHtml(l.platform || "other");
    const label = escapeHtml(l.label || "");
    const url = escapeHtml(l.url || "");

    return `
      <div class="item">
        <div class="left">
          <div class="title">${escapeHtml(platformLabel(platform))}${label ? ` · ${label}` : ""}</div>
          ${url ? `<div class="small">${url}</div>` : `<div class="sub">(URL 없음)</div>`}
        </div>
        <div class="right" style="display:flex; gap:10px; align-items:center;">
          ${url ? `<a href="${url}" target="_blank" rel="noreferrer">열기</a>` : "—"}
          <button class="btn ghost" data-link-del="${idx}" style="padding:8px 10px;">삭제</button>
        </div>
      </div>
    `;
  }).join("");

  $linkList.querySelectorAll("[data-link-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.linkDel);
      if (!Number.isFinite(i)) return;
      linksState.splice(i, 1);
      renderLinks();
      setMsg($peopleMsg, "링크가 삭제되었습니다.");
    });
  });

  syncLinksTextarea();
}

function clearLinkInputs(){
  if ($linkPlatform) $linkPlatform.value = "chzzk";
  if ($linkLabel) $linkLabel.value = "";
  if ($linkUrl) $linkUrl.value = "";
}

function loadSelectedIntoForm(){
  if (!selected.type || !selected.id) return;

  if (selected.type === "gear"){
    const g = cacheGear.find(x => x.id === selected.id);
    if (!g) return;

    // 탭 이동
    document.querySelector('.tab[data-tab="gear"]').click();

    $gearId.value = g.id;
    $gearCategory.value = g.category || "mouse";
    $gearBrand.value = g.brand || "";
    $gearModel.value = g.model || "";
    $gearImageUrl.value = g.imageUrl || "";
    $gearSpecs.value = g.specs ? JSON.stringify(g.specs, null, 2) : "";
    setMsg($gearMsg, `로드됨: gear/${g.id}`);
  }

  if (selected.type === "people"){
    const p = cachePeople.find(x => x.id === selected.id);
    if (!p) return;

    document.querySelector('.tab[data-tab="people"]').click();

    $peopleId.value = p.id;
    $peopleType.value = p.type || "pro";
    $peopleNickname.value = p.nickname || "";
    $peopleOrg.value = p.org || "";
    $peopleRole.value = p.role || "";
    $peopleCountry.value = p.country || "";
    $peopleAvatarUrl.value = p.avatarUrl || "";

    $peopleDpi.value = p.settings?.dpi ?? "";
    $peopleSens.value = p.settings?.sens ?? "";
    $peopleRes.value = p.settings?.res ?? "";

    $peopleGearMouse.value = p.gear?.mouse || "";
    $peopleGearMousepad.value = p.gear?.mousepad || "";
    $peopleGearKeyboard.value = p.gear?.keyboard || "";
    $peopleGearHeadset.value = p.gear?.headset || "";
    $peopleGearMonitor.value = p.gear?.monitor || "";

    sourcesState = Array.isArray(p.sources) ? p.sources : [];
    renderSources();

    linksState = Array.isArray(p.links) ? p.links : [];
    renderLinks();

    setMsg($peopleMsg, `로드됨: people/${p.id}`);
  }
}

// Search events
$managePeopleSearch.addEventListener("input", () => renderManageLists());
$manageGearSearch.addEventListener("input", () => renderManageLists());

// Auth
$btnLogin.addEventListener("click", async () => {
  try{
    const res = await fs.signInWithPopup(auth, googleProvider);
    log(`✅ 로그인: ${res.user.email}`);
  }catch(e){
    log(`❌ 로그인 실패: ${e.message}`);
  }
});

$btnLogout.addEventListener("click", async () => {
  try{
    await fs.signOut(auth);
    log("✅ 로그아웃");
  }catch(e){
    log(`❌ 로그아웃 실패: ${e.message}`);
  }
});

fs.onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  if (currentUser){
    $authState.textContent = `${currentUser.email}`;
    $uidBox.textContent = currentUser.uid;
    log(`Auth: logged in as ${currentUser.email}`);
  } else {
    $authState.textContent = "로그아웃 상태";
    $uidBox.textContent = "—";
    log("Auth: logged out");
  }
});

// Save Gear
$btnGearSave.addEventListener("click", async () => {
  try{
    mustBeLoggedIn();
    setMsg($gearMsg, "저장 중...");

    const id = $gearId.value.trim();
    const category = $gearCategory.value;
    const brand = $gearBrand.value.trim();
    const model = $gearModel.value.trim();
    const imageUrl = $gearImageUrl.value.trim();
    const specs = parseJsonOrEmptyObject($gearSpecs.value);

    if (!brand || !model) throw new Error("브랜드/모델은 필수입니다.");

    const payload = {
      category, brand, model,
      imageUrl: imageUrl || "",
      specs: specs || {},
      updatedAt: fs.serverTimestamp()
    };

    if (id){
      await setDocSafe("gear", id, payload);
      setMsg($gearMsg, `✅ 저장됨: gear/${id}`);
      log(`saved gear/${id}`);
    } else {
      const ref = await fs.addDoc(fs.collection(db, "gear"), payload);
      setMsg($gearMsg, `✅ 저장됨: gear/${ref.id} (자동 ID)`);
      log(`saved gear/${ref.id}`);
      $gearId.value = ref.id; // 로딩 편하게
    }

    await refreshCaches();
  } catch(e){
    setMsg($gearMsg, `❌ ${e.message}`, true);
    log(`ERR gear save: ${e.message}`);
  }
});

async function setDocSafe(col, id, data){
  // setDoc를 직접 import하지 않고, addDoc/updateDoc을 섞지 않기 위해
  // firebase-firestore에서 setDoc을 여기서 재-import하는 대신,
  // updateDoc을 쓰려면 문서 존재 체크가 필요함.
  // 가장 단순: Firestore setDoc을 CDN에서 다시 가져오기.
  const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
  return setDoc(fs.doc(db, col, id), data, { merge: true });
}

// Reset gear form
$btnGearReset.addEventListener("click", () => {
  $gearId.value = "";
  $gearCategory.value = "mouse";
  $gearBrand.value = "";
  $gearModel.value = "";
  $gearImageUrl.value = "";
  $gearSpecs.value = "";
  setMsg($gearMsg, "폼 초기화됨");
});

// Save People
$btnPeopleSave.addEventListener("click", async () => {
  try{
    mustBeLoggedIn();
    setMsg($peopleMsg, "저장 중...");

    const id = $peopleId.value.trim();
    const type = $peopleType.value;
    const nickname = $peopleNickname.value.trim();
    const org = $peopleOrg.value.trim();
    const role = $peopleRole.value;
    const country = $peopleCountry.value.trim();
    const avatarUrl = $peopleAvatarUrl.value.trim();

    if (!nickname) throw new Error("닉네임은 필수입니다.");

    const dpi = $peopleDpi.value === "" ? null : Number($peopleDpi.value);
    const sens = $peopleSens.value === "" ? null : Number($peopleSens.value);
    const res = $peopleRes.value.trim() || null;

    const sources = Array.isArray(sourcesState) ? sourcesState : [];
    const links = Array.isArray(linksState) ? linksState : [];

    const gear = {
      mouse: $peopleGearMouse.value || null,
      mousepad: $peopleGearMousepad.value || null,
      keyboard: $peopleGearKeyboard.value || null,
      headset: $peopleGearHeadset.value || null,
      monitor: $peopleGearMonitor.value || null,
    };

    const payload = {
      nickname,
      type,
      org,
      role,
      links,
      country,
      avatarUrl: avatarUrl || "",
      settings: { dpi, sens, res },
      gear,
      sources,
      updatedAt: fs.serverTimestamp()
    };

    if (id){
      await setDocSafe("people", id, payload);
      setMsg($peopleMsg, `✅ 저장됨: people/${id}`);
      log(`saved people/${id}`);
    } else {
      const ref = await fs.addDoc(fs.collection(db, "people"), payload);
      setMsg($peopleMsg, `✅ 저장됨: people/${ref.id} (자동 ID)`);
      log(`saved people/${ref.id}`);
      $peopleId.value = ref.id;
    }

    await refreshCaches();
  } catch(e){
    setMsg($peopleMsg, `❌ ${e.message}`, true);
    log(`ERR people save: ${e.message}`);
  }
});

$btnSrcAdd.addEventListener("click", () => {
  try{
    const type = ($srcType.value || "other").trim();
    const date = ($srcDate.value || "").trim() || todayYYYYMMDD();
    const url = ($srcUrl.value || "").trim();
    const note = ($srcNote.value || "").trim();

    if (!url) throw new Error("URL은 필수입니다.");
    if (!isValidUrl(url)) throw new Error("URL 형식이 올바르지 않습니다.");
    // date 형식 엄격 체크는 옵션. 최소 길이 체크만.
    if (date.length !== 10) throw new Error("date는 YYYY-MM-DD 형식으로 입력하세요. (비우면 자동으로 오늘)");

    sourcesState.unshift({ type, url, note, date }); // 최신이 위로
    renderSources();
    setMsg($peopleMsg, "✅ 출처가 추가되었습니다.");

    clearSourceInputs();
  }catch(e){
    setMsg($peopleMsg, `❌ ${e.message}`, true);
  }
});

$btnSrcClear.addEventListener("click", () => {
  clearSourceInputs();
  setMsg($peopleMsg, "출처 입력칸이 초기화되었습니다.");
});

$btnLinkAdd?.addEventListener("click", () => {
  try{
    const platform = ($linkPlatform?.value || "other").trim();
    const label = ($linkLabel?.value || "").trim();
    const url = ($linkUrl?.value || "").trim();

    if (!url) throw new Error("URL은 필수입니다.");
    if (!isValidUrl(url)) throw new Error("URL 형식이 올바르지 않습니다.");

    const dupe = (Array.isArray(linksState) ? linksState : []).some(x => (x.url || "") === url);
    if (dupe) throw new Error("이미 같은 URL이 등록되어 있습니다.");

    linksState.unshift({ platform, url, label });
    renderLinks();
    setMsg($peopleMsg, "✅ 링크가 추가되었습니다.");
    clearLinkInputs();
  }catch(e){
    setMsg($peopleMsg, `❌ ${e.message}`, true);
  }
});

$btnLinkClear?.addEventListener("click", () => {
  clearLinkInputs();
  setMsg($peopleMsg, "링크 입력칸이 초기화되었습니다.");
});

$btnPeopleReset.addEventListener("click", () => {
  $peopleId.value = "";
  $peopleType.value = "pro";
  $peopleNickname.value = "";
  $peopleOrg.value = "";
  $peopleRole.value = "";
  $peopleCountry.value = "";
  $peopleAvatarUrl.value = "";
  $peopleDpi.value = "";
  $peopleSens.value = "";
  $peopleRes.value = "";
  $peopleSources.value = "[]";
  sourcesState = [];
  renderSources();

  if ($peopleLinks) $peopleLinks.value = "[]";
  linksState = [];
  renderLinks();

  $peopleGearMouse.value = "";
  $peopleGearMousepad.value = "";
  $peopleGearKeyboard.value = "";
  $peopleGearHeadset.value = "";
  $peopleGearMonitor.value = "";

  setMsg($peopleMsg, "폼 초기화됨");
});

// Delete selected
$btnDeleteSelected.addEventListener("click", async () => {
  try{
    mustBeLoggedIn();
    if (!selected.type || !selected.id) throw new Error("삭제할 항목이 선택되지 않았습니다.");

    const ok = confirm(`정말 삭제할까요?\n${selected.type}/${selected.id}`);
    if (!ok) return;

    await fs.deleteDoc(fs.doc(db, selected.type === "gear" ? "gear" : "people", selected.id));
    setMsg($manageMsg, `✅ 삭제됨: ${selected.type}/${selected.id}`);
    log(`deleted ${selected.type}/${selected.id}`);

    selected = { type: null, id: null };
    await refreshCaches();
  } catch(e){
    setMsg($manageMsg, `❌ ${e.message}`, true);
    log(`ERR delete: ${e.message}`);
  }
});

// Boot
(async function boot(){
  try{
    log("Boot: loading data...");
    await refreshCaches();
    setMsg($gearMsg, "대기 중");
    setMsg($peopleMsg, "대기 중");
    setMsg($manageMsg, "대기 중");
    log("Boot: ready");
  }catch(e){
    log(`❌ boot error: ${e.message}`);
  }
})();
