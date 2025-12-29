// app.js
import { db, fs, auth } from "./firebase.js";

const $view = document.getElementById("view");
const $globalSearch = document.getElementById("globalSearch");

const ROLE_KR = {
  Duelist: "타격대",
  Initiator: "척후대",
  Controller: "전략가",
  Sentinel: "감시자",
  Flex: "플렉스"
};

const TYPE_KR = {
  pro: "프로",
  streamer: "스트리머"
};

const state = {
  people: [],
  gear: [],
  info: [],
  gearById: new Map(),
  globalQuery: ""
};

// Admin link: 관리자만 "관리" 메뉴 보이게 (Firestore admins/{uid} allowlist)
const $adminLink = document.querySelector('.nav a[href="./admin.html"], .nav a.mutedLink[href="./admin.html"]');
if ($adminLink) $adminLink.style.display = "none"; // 기본은 숨김(깜빡임 방지)

async function isAdmin(uid){
  try{
    const snap = await fs.getDoc(fs.doc(db, "admins", uid));
    return snap.exists();
  }catch(_e){
    return false;
  }
}

fs.onAuthStateChanged(auth, async (user) => {
  if (!$adminLink) return;
  if (!user){
    $adminLink.style.display = "none";
    return;
  }
  const ok = await isAdmin(user.uid);
  $adminLink.style.display = ok ? "" : "none";
});

function escapeHtml(s=""){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function calcEDPI(dpi, sens){
  const d = Number(dpi);
  const s = Number(sens);
  if (!Number.isFinite(d) || !Number.isFinite(s)) return null;
  return Math.round(d * s);
}

function setActiveNav(){
  const hash = location.hash || "#/";
  document.querySelectorAll(".nav a").forEach(a => a.classList.remove("active"));
  if (hash.startsWith("#/people")) document.querySelector('.nav a[href="#/people"]')?.classList.add("active");
  if (hash.startsWith("#/gear")) document.querySelector('.nav a[href="#/gear"]')?.classList.add("active");
}

async function loadAll(){
  // gear 먼저 (사람 상세에서 조립해야 해서)
  const gearSnap = await fs.getDocs(fs.collection(db, "gear"));
  state.gear = gearSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  state.gearById = new Map(state.gear.map(g => [g.id, g]));

  const peopleSnap = await fs.getDocs(fs.collection(db, "people"));
  state.people = peopleSnap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderHome(){
  const latestPeople = [...state.people]
    .sort((a,b) => (b.updatedAt?.seconds||0) - (a.updatedAt?.seconds||0))
    .slice(0, 8);

  const mouseCount = state.gear.filter(g => g.category === "mouse").length;

  $view.innerHTML = `
    <div class="panel">
      <div class="h1">VAL DB</div>
      <p class="p">프로/스트리머의 발로란트 장비와 설정을 모아두는 데이터베이스</p>
      <div class="small">현재 등록: 사람 ${state.people.length}명 · 장비 ${state.gear.length}개 · 마우스 ${mouseCount}개</div>
    </div>

    <div class="hr"></div>

    <div class="h1">최근 업데이트</div>
    <div class="grid">
      ${latestPeople.map(p => personCard(p)).join("") || `<div class="panel">아직 데이터가 없어요. Firestore에 people/gear부터 넣자.</div>`}
    </div>
  `;
}

function personCard(p){
  const nickname = escapeHtml(p.nickname || "Unknown");
  const org = escapeHtml(p.org || "");
  const role = escapeHtml(ROLE_KR[p.role] || "미기재");
  const type = escapeHtml(TYPE_KR[(p.type || "").toLowerCase()] || "");
  const avatar = p.avatarUrl ? `<img src="${escapeHtml(p.avatarUrl)}" alt="${nickname}">` : `<span class="small">NO</span>`;

  const dpi = p.settings?.dpi;
  const sens = p.settings?.sens;
  const edpi = calcEDPI(dpi, sens);

  return `
    <a class="card" href="#/people/${encodeURIComponent(p.id)}">
      <div class="row">
        <div class="avatar">${avatar}</div>
        <div>
          <p class="title">${nickname}</p>
          <p class="sub">${org}${org && role ? " · " : ""}${role}</p>
        </div>
      </div>
      <div class="tags">
        ${type ? `<span class="tag">${type}</span>` : ""}
        ${p.country ? `<span class="tag">${escapeHtml(p.country)}</span>` : ""}
        ${Number.isFinite(Number(dpi)) ? `<span class="tag">DPI ${escapeHtml(dpi)}</span>` : `<span class="tag">DPI ?</span>`}
        ${Number.isFinite(Number(sens)) ? `<span class="tag">Sens ${escapeHtml(sens)}</span>` : `<span class="tag">Sens ?</span>`}
        ${edpi !== null ? `<span class="tag">eDPI ${edpi}</span>` : `<span class="tag">eDPI ?</span>`}
      </div>
    </a>
  `;
}

function renderGlobalSearch(){
  const params = new URLSearchParams((location.hash.split("?")[1] || ""));
  const q = (params.get("q") || "").trim().toLowerCase();

  const people = state.people.filter(p => {
    const hay = `${p.nickname||""} ${p.org||""} ${p.role||""}`.toLowerCase();
    return q && hay.includes(q);
  });

  const gear = state.gear.filter(g => {
    const hay = `${g.brand||""} ${g.model||""} ${g.category||""}`.toLowerCase();
    return q && hay.includes(q);
  });

  $view.innerHTML = `
    <div class="h1">검색 결과</div>
    <p class="p">"${escapeHtml(q)}" 검색 결과입니다.</p>

    <div class="h1">프로 / 스트리머</div>
    <div class="grid">
      ${people.length
        ? people.map(p => personCard(p)).join("")
        : `<div class="panel">일치하는 프로/스트리머가 없습니다.</div>`}
    </div>

    <div class="hr"></div>

    <div class="h1">장비</div>
    <div class="grid">
      ${gear.length
        ? gear.map(g => gearCard(g)).join("")
        : `<div class="panel">일치하는 장비가 없습니다.</div>`}
    </div>
  `;
}


function renderPeopleList(){
  // local filters
  const params = new URLSearchParams((location.hash.split("?")[1] || ""));
  const q = (params.get("q") || state.globalQuery || "").trim().toLowerCase();
  const role = params.get("role") || "all";
  const type = params.get("type") || "all";

  // pagination
  const PER_PAGE = 9; // 3x3 기준
  const pageRaw = parseInt(params.get("page") || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const filtered = state.people.filter(p => {
    const hay = `${p.nickname||""} ${p.org||""} ${p.role||""}`.toLowerCase();
    const okQ = !q || hay.includes(q);
    const okRole = role === "all" || (p.role || "").toLowerCase() === role.toLowerCase();
    const okType = type === "all" || (p.type || "").toLowerCase() === type.toLowerCase();
    return okQ && okRole && okType;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const curPage = Math.min(Math.max(1, page), totalPages);
  const pageItems = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);

  const makeHash = (nextPage) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (type !== "all") sp.set("type", type);
    if (role !== "all") sp.set("role", role);
    if (nextPage > 1) sp.set("page", String(nextPage));
    return `#/people${sp.toString() ? "?" + sp.toString() : ""}`;
  };

  $view.innerHTML = `
    <div class="h1">프로/스트리머</div>
    <p class="p">프로/스트리머를 검색하고, 설정과 장비를 확인합니다.</p>

    <div class="filters">
      <input class="input" id="peopleQ" placeholder="닉네임/팀/역할 검색" value="${escapeHtml(q)}" />
      <select class="select" id="peopleType">
        <option value="all" ${type==="all"?"selected":""}>전체</option>
        <option value="pro" ${type==="pro"?"selected":""}>프로</option>
        <option value="streamer" ${type==="streamer"?"selected":""}>스트리머</option>
      </select>
      <select class="select" id="peopleRole">
        <option value="all" ${role==="all"?"selected":""}>전체</option>
        <option value="Duelist" ${role==="Duelist"?"selected":""}>타격대</option>
        <option value="Initiator" ${role==="Initiator"?"selected":""}>척후대</option>
        <option value="Controller" ${role==="Controller"?"selected":""}>전략가</option>
        <option value="Sentinel" ${role==="Sentinel"?"selected":""}>감시자</option>
        <option value="Flex" ${role==="Flex"?"selected":""}>플렉스</option>
      </select>
    </div>

    <div class="grid">
      ${pageItems.map(p => personCard(p)).join("") || `<div class="panel">조건에 맞는 사람이 없어요.</div>`}
    </div>

    <div class="pager">
      <a class="pagerBtn ${curPage===1 ? "disabled" : ""}" href="${makeHash(curPage-1)}" aria-disabled="${curPage===1}">
        ← 이전
      </a>
      <span class="pagerInfo">${curPage} / ${totalPages} · 총 ${filtered.length}명</span>
      <a class="pagerBtn ${curPage===totalPages ? "disabled" : ""}" href="${makeHash(curPage+1)}" aria-disabled="${curPage===totalPages}">
        다음 →
      </a>
    </div>
  `;

  // bind
  const $q = document.getElementById("peopleQ");
  const $type = document.getElementById("peopleType");
  const $role = document.getElementById("peopleRole");

  const push = () => {
    const sp = new URLSearchParams();
    const qv = $q.value.trim();
    const tv = $type.value;
    const rv = $role.value;

    if (qv) sp.set("q", qv);
    if (tv !== "all") sp.set("type", tv);
    if (rv !== "all") sp.set("role", rv);
    // 필터가 바뀌면 1페이지로
    location.hash = `#/people${sp.toString() ? "?" + sp.toString() : ""}`;
  };

  $q.addEventListener("input", debounce(push, 250));
  $type.addEventListener("change", push);
  $role.addEventListener("change", push);
}

function gearLabel(cat){
  switch(cat){
    case "mouse": return "마우스";
    case "mousepad": return "마우스패드";
    case "keyboard": return "키보드";
    case "headset": return "헤드셋/이어폰";
    case "monitor": return "모니터";
    default: return cat || "";
  }
}

function renderGearHome(){
  const cats = ["mouse","mousepad","keyboard","headset","monitor"];
  $view.innerHTML = `
    <div class="h1">장비</div>
    <p class="p">카테고리별 장비 목록을 보고, 누가 쓰는지까지 확인합니다.</p>

    <div class="grid">
      ${cats.map(cat => {
        const count = state.gear.filter(g => g.category === cat).length;
        return `
          <a class="card" href="#/gear/${cat}">
            <p class="title">${gearLabel(cat)}</p>
            <p class="sub">등록 ${count}개</p>
            <div class="tags">
              <span class="tag">${cat}</span>
              <span class="tag">브랜드/모델</span>
              <span class="tag">사용자 목록</span>
            </div>
          </a>
        `;
      }).join("")}
    </div>
  `;
}

function gearCard(g){
  const brand = escapeHtml(g.brand || "");
  const model = escapeHtml(g.model || "");
  const cat = escapeHtml(g.category || "");
  return `
    <a class="card" href="#/gear/${encodeURIComponent(g.category)}/${encodeURIComponent(g.id)}">
      <p class="title">${brand} ${model}</p>
      <p class="sub">${gearLabel(g.category)} · ${cat}</p>
      <div class="tags">
        <span class="tag">${brand || "brand ?"}</span>
        <span class="tag">${model || "model ?"}</span>
      </div>
    </a>
  `;
}

function renderGearList(category){
  const params = new URLSearchParams((location.hash.split("?")[1] || ""));
  const q = (params.get("q") || state.globalQuery || "").trim().toLowerCase();
  const brand = params.get("brand") || "all";

  // pagination
  const PER_PAGE_GEAR = 9; // 3x3 기준
  const pageRaw = parseInt(params.get("page") || "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const inCat = state.gear.filter(g => g.category === category);

  const brands = [...new Set(inCat.map(g => (g.brand||"").trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b));

  const filtered = inCat.filter(g => {
    const hay = `${g.brand||""} ${g.model||""}`.toLowerCase();
    const okQ = !q || hay.includes(q);
    const okBrand = brand === "all" || (g.brand||"") === brand;
    return okQ && okBrand;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE_GEAR));
  const curPage = Math.min(Math.max(1, page), totalPages);
  const pageItems = filtered.slice((curPage - 1) * PER_PAGE_GEAR, curPage * PER_PAGE_GEAR);

  const makeHash = (nextPage) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (brand !== "all") sp.set("brand", brand);
    if (nextPage > 1) sp.set("page", String(nextPage));
    return `#/gear/${category}${sp.toString() ? "?" + sp.toString() : ""}`;
  };

  $view.innerHTML = `
    <div class="h1">${gearLabel(category)}</div>
    <p class="p">장비를 검색하고, 상세 페이지에서 사용자를 확인합니다.</p>

    <div class="filters">
      <input class="input" id="gearQ" placeholder="브랜드/모델 검색" value="${escapeHtml(q)}" />
      <select class="select" id="gearBrand">
        <option value="all" ${brand==="all"?"selected":""}>전체 브랜드</option>
        ${brands.map(b => `<option value="${escapeHtml(b)}" ${b===brand?"selected":""}>${escapeHtml(b)}</option>`).join("")}
      </select>
    </div>

    <div class="grid">
      ${pageItems.map(g => gearCard(g)).join("") || `<div class="panel">조건에 맞는 장비가 없어요.</div>`}
    </div>

    <div class="row" style="justify-content:center; gap:10px; margin:14px 0 6px;">
      <a class="tag" href="${makeHash(Math.max(1, curPage-1))}" style="opacity:${curPage<=1?0.45:1}; pointer-events:${curPage<=1?'none':'auto'};">← 이전</a>
      <span class="tag">페이지 ${curPage} / ${totalPages}</span>
      <a class="tag" href="${makeHash(Math.min(totalPages, curPage+1))}" style="opacity:${curPage>=totalPages?0.45:1}; pointer-events:${curPage>=totalPages?'none':'auto'};">다음 →</a>
    </div>
  `;

  const $q = document.getElementById("gearQ");
  const $b = document.getElementById("gearBrand");

  const push = () => {
    const sp = new URLSearchParams();
    if ($q.value.trim()) sp.set("q", $q.value.trim());
    if ($b.value !== "all") sp.set("brand", $b.value);
    // ✅ 필터 변경 시 1페이지로 리셋
    location.hash = `#/gear/${category}${sp.toString() ? "?" + sp.toString() : ""}`;
  };

  $q.addEventListener("input", debounce(push, 250));
  $b.addEventListener("change", push);
}

function renderPersonDetail(id){
  const p = state.people.find(x => x.id === id);
  if (!p){
    $view.innerHTML = `<div class="panel">해당 인물을 찾을 수 없어요.</div>`;
    return;
  }

  const nickname = escapeHtml(p.nickname || "Unknown");
  const org = escapeHtml(p.org || "");
  const role = escapeHtml(ROLE_KR[p.role] || "미기재");
  const type = escapeHtml(TYPE_KR[(p.type || "").toLowerCase()] || "");
  const country = escapeHtml(p.country || "");
  const avatar = p.avatarUrl ? `<img src="${escapeHtml(p.avatarUrl)}" alt="${nickname}">` : `<span class="small">NO</span>`;

  const dpi = p.settings?.dpi;
  const sens = p.settings?.sens;
  const res = p.settings?.res;
  const edpi = calcEDPI(dpi, sens);

  const gearPairs = [
    ["mouse", "마우스"],
    ["mousepad", "마우스패드"],
    ["keyboard", "키보드"],
    ["headset", "헤드셋/이어폰"],
    ["monitor", "모니터"]
  ].map(([key,label]) => {
    const gid = p.gear?.[key];
    const g = gid ? state.gearById.get(gid) : null;
    if (!g) {
      return `<div class="item"><div class="left"><div class="title">${label}</div><div class="sub">미등록</div></div><div class="right">—</div></div>`;
    }
    return `
      <a class="item" href="#/gear/${encodeURIComponent(g.category)}/${encodeURIComponent(g.id)}">
        <div class="left">
          <div class="title">${escapeHtml(g.brand||"")} ${escapeHtml(g.model||"")}</div>
          <div class="sub">${label}</div>
        </div>
        <div class="right">상세 보기 →</div>
      </a>
    `;
  }).join("");

  const sources = Array.isArray(p.sources) ? p.sources : [];
  const sourceHtml = sources.length
    ? sources.map(s => `
        <div class="item">
          <div class="left">
            <div class="title">${escapeHtml(s.type || "source")}</div>
            <div class="sub">${escapeHtml(s.note || "")}${s.date ? ` · ${escapeHtml(s.date)}` : ""}</div>
          </div>
          <div class="right"><a href="${escapeHtml(s.url)}" target="_blank" rel="noreferrer">열기</a></div>
        </div>
      `).join("")
    : `<div class="panel small">프로/스트리머의 그 외 정보들(미작성).</div>`;

  $view.innerHTML = `
    <div class="panel">
      <div class="row">
        <div class="avatar" style="width:56px;height:56px;border-radius:16px">${avatar}</div>
        <div>
          <div class="h1" style="margin:0">${nickname}</div>
          <div class="small">${[org, role].filter(Boolean).join(" · ")}${country ? ` · ${country}` : ""}</div>
          <div class="tags">
            ${type ? `<span class="tag">${type}</span>` : ""}
            ${role ? `<span class="tag">${role}</span>` : ""}
          </div>
        </div>
      </div>

      <div class="hr"></div>

      <div class="split">
        <div>
          <div class="title">설정</div>
          <div class="kv">
            <div class="k">DPI</div><div class="v">${Number.isFinite(Number(dpi)) ? escapeHtml(dpi) : "—"}</div>
            <div class="k">감도(Sens)</div><div class="v">${Number.isFinite(Number(sens)) ? escapeHtml(sens) : "—"}</div>
            <div class="k">eDPI</div><div class="v">${edpi !== null ? edpi : "—"}</div>
            <div class="k">해상도</div><div class="v">${res ? escapeHtml(res) : "—"}</div>
          </div>
        </div>

        <div>
          <div class="title">장비</div>
          <div class="list">${gearPairs}</div>
        </div>
      </div>

      <div class="hr"></div>

      <div class="title">프로/스트리머의 그 외 정보들</div>
      <div class="list">${sourceHtml}</div>
    </div>
  `;
}

function renderGearDetail(category, id){
  const g = state.gear.find(x => x.id === id && x.category === category) || state.gearById.get(id);
  if (!g){
    $view.innerHTML = `<div class="panel">해당 장비를 찾을 수 없어요.</div>`;
    return;
  }

  const users = state.people.filter(p => Object.values(p.gear || {}).includes(g.id));

  const specs = g.specs && typeof g.specs === "object"
    ? Object.entries(g.specs).map(([k,v]) => `
        <div class="item">
          <div class="left">
            <div class="title">${escapeHtml(k)}</div>
            <div class="sub">spec</div>
          </div>
          <div class="right">${escapeHtml(v)}</div>
        </div>
      `).join("")
    : `<div class="panel small">스펙이 아직 없어요.</div>`;

  $view.innerHTML = `
    <div class="panel">
      <div class="h1">${escapeHtml(g.brand || "")} ${escapeHtml(g.model || "")}</div>
      <div class="small">${gearLabel(g.category)} · ${escapeHtml(g.category)}</div>

      <div class="hr"></div>

      <div class="split">
        <div>
          <div class="title">스펙</div>
          <div class="list">${specs}</div>
        </div>

        <div>
          <div class="title">이 장비를 쓰는 프로/스트리머</div>
          <div class="list">
            ${users.length ? users.map(p => `
              <a class="item" href="#/people/${encodeURIComponent(p.id)}">
                <div class="left">
                  <div class="title">${escapeHtml(p.nickname||"")}</div>
                  <div class="sub">${escapeHtml(p.org||"")}${p.role ? ` · ${escapeHtml(p.role)}` : ""}</div>
                </div>
                <div class="right">상세 →</div>
              </a>
            `).join("") : `<div class="panel small">아직 이 장비를 연결한 프로/스트리머가 없어요.</div>`}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderNotFound(){
  $view.innerHTML = `<div class="panel">페이지를 찾을 수 없습니다. 상단 메뉴로 이동해주세요.</div>`;
}

function route(){
  setActiveNav();

  const hash = location.hash || "#/";
  const [path, qs] = hash.split("?");
  const parts = path.replace("#","").split("/").filter(Boolean);

  // parts: [] => home
  if (parts.length === 0){
    renderHome(); return;
  }

  if (parts[0] === "search"){
  renderGlobalSearch(); return;
  }
  if (parts[0] === "people" && parts.length === 1){
    renderPeopleList(); return;
  }
  if (parts[0] === "people" && parts.length === 2){
    renderPersonDetail(decodeURIComponent(parts[1])); return;
  }

  if (parts[0] === "gear" && parts.length === 1){
    renderGearHome(); return;
  }
  if (parts[0] === "gear" && parts.length === 2){
    renderGearList(decodeURIComponent(parts[1])); return;
  }
  if (parts[0] === "gear" && parts.length === 3){
    renderGearDetail(decodeURIComponent(parts[1]), decodeURIComponent(parts[2])); return;
  }

  renderNotFound();
}

function debounce(fn, ms){
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// 글로벌 검색: 엔터 누르면 people로 보내기(기본)
$globalSearch.addEventListener("keydown", (e) => {
  if (e.key === "Enter"){
    const q = $globalSearch.value.trim();
    if (!q) return;
    location.hash = `#/search?q=${encodeURIComponent(q)}`;
  }
});

async function boot(){
  $view.innerHTML = `<div class="panel">불러오는 중...</div>`;
  try{
    await loadAll();
    window.addEventListener("hashchange", route);
    route();
  }catch(err){
    console.error(err);
    $view.innerHTML = `
      <div class="panel">
        <div class="h1">Firebase 연결 오류</div>
        <p class="p">firebase.js 설정값(프로젝트 ID 등)을 확인해줘. 콘솔 로그도 같이 확인하면 원인 찾기 쉬워.</p>
        <div class="small">${escapeHtml(err?.message || String(err))}</div>
      </div>
    `;
  }
}

boot();
