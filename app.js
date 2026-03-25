// --- Cookie Helpers ---
function setCookie(name, value, hours) {
    var d = new Date();
    d.setTime(d.getTime() + (hours * 60 * 60 * 1000));
    document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/';
}
function getCookie(name) {
    var v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return v ? v.pop() : '';
}

// --- Core State & Data ---
let map;
let polyline;
let markers = [];
let currentDay = 1;
let currentBag = 1;
let petalScore = 0;
let petalGameClears = 0;
let wishlistItems = [];

// 기본 초기 데이터 (DB에 아무것도 없을 때만 사용)
const defaultPlanData = {
    title: "🌸 진해 & 부산 여행",
    dates: "2026.04.02(목) - 04.04(토)",
    checklist1: [
        { id: 1, text: "신분증 / KTX 티켓", done: true },
        { id: 2, text: "카메라 & 렌즈", done: true },
        { id: 3, text: "얇은 가디건", done: false }
    ],
    checklist2: [
        { id: 5, text: "숙소 예약 바우처", done: true },
        { id: 6, text: "필름 용지", done: false },
        { id: 7, text: "여분 보조배터리", done: false },
    ],
    memos: [],
    days: {
        1: [
            { id: 101, time: "09:30", name: "진해 여좌천 로망스다리", lat: 35.1517, lng: 128.6657, link: "벚꽃 터널 감상 필수! 사람 많기 전에 아침 일찍 갈것 🌸" },
            { id: 102, time: "11:30", name: "경화역 벚꽃길", lat: 35.1504, lng: 128.6826, link: "폐역 기차와 벚꽃 조합 포토존 📸 인생샷 찍기" },
            { id: 103, time: "14:00", name: "속천항 카페거리", lat: 35.1387, lng: 128.6631, link: "바다 뷰 카페에서 커피 한잔하며 쉬어가기 ☕" }
        ],
        2: [
            { id: 201, time: "10:00", name: "광안리 해수욕장", lat: 35.1531, lng: 129.1189, link: "바다 산책하고 낮 드론 구경하기 🌊" },
            { id: 202, time: "13:00", name: "민락수변공원 밀레니엄회센터", lat: 35.1554, lng: 129.1259, link: "신선한 회 포장해서 스페셜 런치 🐟" },
            { id: 203, time: "16:00", name: "해운대 달맞이길", lat: 35.1633, lng: 129.1764, link: "여기에도 벚꽃이 엄청 예뻐요. 산책코스 강추!" }
        ],
        3: [
            { id: 301, time: "11:00", name: "해동용궁사", lat: 35.1883, lng: 129.2232, link: "바다 위에 있는 절 구경하고 마무리 🙏" },
            { id: 302, time: "14:00", name: "부산역", lat: 35.1152, lng: 129.0422, link: "KTX 탑승 전 씨앗호떡이랑 어묵 포장하기 🚄" }
        ]
    }
};

let planData = JSON.parse(JSON.stringify(defaultPlanData));

let draggedItemIndex = null;

let ddayInterval;

// --- Firebase Setup ---
const firebaseConfig = {
    apiKey: "AIzaSyBmwX1khTABQH4oVvsuXtJkiz6jczsNHLs",
    authDomain: "plan-8844c.firebaseapp.com",
    projectId: "plan-8844c",
    storageBucket: "plan-8844c.firebasestorage.app",
    messagingSenderId: "526233022174",
    appId: "1:526233022174:web:ff4e91d595adf6a62a9c4f"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- Firebase 데이터 저장/불러오기 ---
let saveTimeout = null;
function savePlanData() {
    // 디바운스: 연속 저장 방지 (300ms 내 여러 변경 시 마지막 1회만 저장)
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        db.collection("planData").doc("main").set({
            title: planData.title,
            dates: planData.dates,
            checklist1: planData.checklist1,
            checklist2: planData.checklist2,
            memos: planData.memos,
            days: planData.days,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            console.log("✅ planData 저장 완료");
        }).catch(err => {
            console.error("❌ planData 저장 실패:", err);
        });
    }, 300);
}

async function loadPlanData() {
    try {
        const doc = await db.collection("planData").doc("main").get();
        if (doc.exists) {
            const data = doc.data();
            planData.title = data.title || defaultPlanData.title;
            planData.dates = data.dates || defaultPlanData.dates;
            planData.checklist1 = data.checklist1 || defaultPlanData.checklist1;
            planData.checklist2 = data.checklist2 || defaultPlanData.checklist2;
            planData.memos = data.memos || defaultPlanData.memos;
            planData.days = data.days || defaultPlanData.days;
            console.log("✅ DB에서 planData 불러오기 완료");
        } else {
            // DB에 데이터가 없으면 기본값 저장
            planData = JSON.parse(JSON.stringify(defaultPlanData));
            savePlanData();
            console.log("📝 기본 데이터를 DB에 최초 저장");
        }
    } catch (err) {
        console.error("❌ planData 불러오기 실패, 기본값 사용:", err);
        planData = JSON.parse(JSON.stringify(defaultPlanData));
    }
}

// --- Init ---
document.addEventListener("DOMContentLoaded", async () => {
    // Firebase Realtime Listener for Wishlist
    db.collection("wishlist").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
        wishlistItems = [];
        snapshot.forEach((doc) => {
            wishlistItems.push({ id: doc.id, ...doc.data() });
        });
        renderWishlist();
    });

    // DB에서 planData 불러오기 (새로고침해도 유지!)
    await loadPlanData();

    // 제목/날짜를 DB 값으로 반영
    const titleEl = document.getElementById('tripTitle');
    const datesEl = document.getElementById('tripDates');
    if (titleEl) titleEl.innerText = planData.title;
    if (datesEl) datesEl.innerText = planData.dates;

    initBlossoms();
    initMap();
    // Sudden Mission Pop-up Timer (PC only, 12시간에 1번)
    setTimeout(() => {
        // 모바일이면 안 보여줌
        if (window.innerWidth <= 950) return;

        const lastShown = localStorage.getItem('suddenMissionLastShown');
        const now = Date.now();
        const TWELVE_HOURS = 12 * 60 * 60 * 1000;

        if (lastShown && (now - parseInt(lastShown)) < TWELVE_HOURS) return;

        const suddenModal = document.getElementById('suddenMissionModal');
        if (suddenModal) {
            suddenModal.classList.add('active');
            localStorage.setItem('suddenMissionLastShown', String(now));
        }
    }, 10000);
    renderChecklists();
    renderMemos();
    renderTabs();
    renderDayList();

    // Session logic
    const hasSeenInvite = sessionStorage.getItem('hasSeenInvite');
    if (hasSeenInvite === 'true') {
        const inv = document.getElementById('invitationScreen');
        inv.classList.add('opened');
        inv.style.display = 'none';
        document.body.classList.add('unlocked');
    }

    startDDayCountdown();
});

function startDDayCountdown() {
    const inviteEl = document.getElementById('realtimeDDay');
    const dashEl = document.getElementById('dashboardCountdown');

    const target = new Date("2026-04-02T06:00:00").getTime();

    const update = () => {
        const now = new Date().getTime();
        const diff = target - now;
        if (diff <= 0) {
            var doneText = "💖 오늘 출발!";
            if (inviteEl) inviteEl.innerText = doneText;
            if (dashEl) dashEl.innerText = doneText;
            clearInterval(ddayInterval);
            return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        var timeText = d + '일 ' + h + '시간 ' + m + '분 ' + String(s).padStart(2, '0') + '초';
        if (inviteEl) inviteEl.innerText = timeText;
        if (dashEl) dashEl.innerText = '⏳ ' + timeText;
    };

    update();
    ddayInterval = setInterval(update, 1000);
}

// --- Invitation Screen Logic ---
function openInvitation() {
    sessionStorage.setItem('hasSeenInvite', 'true');
    // Shoot massive confetti effect when accepted!
    if (typeof confetti === 'function') {
        const duration = 2000;
        const end = Date.now() + duration;

        (function frame() {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#ffb8d9', '#ec4899', '#ffffff']
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#ffb8d9', '#ec4899', '#ffffff']
            });

            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    }

    document.getElementById('invitationScreen').classList.add('opened');
    document.body.classList.add('unlocked');
    setTimeout(() => {
        document.getElementById('invitationScreen').style.display = 'none';
    }, 1500); // Wait for the 1.5s CSS transition hook to finish
}

function revisitInvitation() {
    const inv = document.getElementById('invitationScreen');
    inv.style.display = 'flex';
    // 강제 리플로우로 상태 초기화 인식
    void inv.offsetWidth;
    inv.classList.remove('opened');
    document.body.classList.remove('unlocked');
    sessionStorage.removeItem('hasSeenInvite');
}

// --- Cherry Blossom Animation & Mini-game ---
function initBlossoms() {
    const container = document.getElementById('blossomContainer');
    const petalCount = 15; // Decreased frequency

    for (let i = 0; i < petalCount; i++) {
        createPetal(container);
    }
}

function createPetal(container) {
    const petal = document.createElement('div');
    petal.classList.add('petal');

    const colors = ['#f472b6', '#ec4899', '#db2777', '#be185d', '#d946ef', '#f43f5e'];
    const myColor = colors[Math.floor(Math.random() * colors.length)];

    const isSpecial = Math.random() > 0.4;

    if (isSpecial) {
        petal.classList.add('catchable');
        petal.style.backgroundColor = myColor;
        petal.dataset.myColor = myColor;

        petal.onclick = (e) => {
            e.preventDefault();
            if (petal.classList.contains('caught')) return;

            catchPetal(petal);

            // Generate visual effect exactly at mouse coords
            const textPopup = document.createElement('div');
            textPopup.classList.add('toggle-text-absolute');
            textPopup.innerHTML = "✨ 찾았습니다!";
            textPopup.style.left = e.clientX + 'px';
            textPopup.style.top = e.clientY + 'px';
            document.body.appendChild(textPopup);

            setTimeout(() => {
                if (textPopup) textPopup.remove();
            }, 800);

            // Hide and remove petal directly
            petal.style.display = 'none';
            petal.classList.add('caught');

            setTimeout(() => {
                petal.remove();
                createPetal(container);
            }, 800);
        };
    }

    const size = Math.random() * 12 + 8;
    const left = Math.random() * 100;
    const animDuration = Math.random() * 8 + 8; // Slower falling speed
    const delay = Math.random() * -10;

    petal.style.width = isSpecial ? `${size * 1.5}px` : `${size}px`;
    petal.style.height = isSpecial ? `${size * 1.2}px` : `${size * 0.8}px`;
    petal.style.left = `${left}vw`;
    petal.style.animationDuration = `${animDuration}s`;
    petal.style.animationDelay = `${delay}s`;

    if (!isSpecial) {
        petal.style.backgroundColor = '#ffd1e8';
    }

    container.appendChild(petal);

    petal.addEventListener('animationiteration', () => {
        petal.style.left = `${Math.random() * 100}vw`;
    });
}

function catchPetal(petal) {
    if (petal.classList.contains('caught')) return;

    petal.classList.add('caught');
    petalScore++;

    const scoreEl = document.getElementById('petalScore');
    const basketMsg = document.getElementById('basketMsg');
    const basketDropzone = document.getElementById('basketDropzone');
    const basketStack = document.getElementById('basketStack');

    if (scoreEl) {
        scoreEl.innerText = petalScore;
        scoreEl.style.transform = 'scale(1.5)';
        setTimeout(() => scoreEl.style.transform = 'scale(1)', 200);
    }

    // Show encouraging message and stack
    if (basketMsg) {
        const msgs = ["나이스 캐치! 🎉", "훌륭해요! 🌸", "조금만 더 힘내세요! 🔥", "완벽해요! ✨", "거의 다 왔어요! 🎁"];
        const cheer = msgs[Math.floor(Math.random() * msgs.length)];
        basketMsg.innerHTML = `<strong style="font-size:14px; color:#ec4899">${cheer}</strong>`;
    }

    if (basketDropzone) {
        basketDropzone.classList.remove('bounce');
        void basketDropzone.offsetWidth;
        basketDropzone.classList.add('bounce');
    }

    if (basketStack) {
        const bg = petal.dataset.myColor || '#ec4899';
        basketStack.innerHTML += `<div class="stacked-petal" style="background-color: ${bg};"></div>`;
    }

    if (typeof confetti === 'function') {
        const rect = petal.getBoundingClientRect();
        const x = (rect.left + rect.width / 2) / window.innerWidth;
        const y = (rect.top + rect.height / 2) / window.innerHeight;

        confetti({ particleCount: 20, spread: 40, origin: { x, y }, colors: ['#ec4899', '#ffffff'], ticks: 50, gravity: 0.5 });
    }

    if (petalScore === 5) {
        petalGameClears++;
        setTimeout(() => {
            document.getElementById('gameClearModal').classList.add('active');
            confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, colors: ['#ffb8d9', '#ec4899', '#ffffff'] });

            if (petalGameClears < 3) {
                petalScore = 0;
                document.getElementById('petalScore').innerText = 0;
                const basketStack = document.getElementById('basketStack');
                const basketMsg = document.getElementById('basketMsg');
                if (basketStack) basketStack.innerHTML = '';
                if (basketMsg) basketMsg.innerHTML = '<strong style="font-size:14px; color:#ec4899">미션 성공! 계속해서 새 벚꽃을 찾아주세요! (' + petalGameClears + '/3)</strong>';
            } else {
                const minigameUI = document.getElementById('minigameUI');
                if (minigameUI) minigameUI.style.display = 'none';
            }
        }, 500);
    }
}

// --- Heart Clicker Game Logic ---
let heartScore = 0;
let heartTimer = null;
let heartTimeLeft = 2.0;
let heartGameActive = false;

function startHeartGame() {
    heartScore = 0;
    heartTimeLeft = 2.0;
    heartGameActive = true;
    document.getElementById('heartBtn').disabled = false;
    document.getElementById('heartStartBtn').style.display = 'none';
    document.getElementById('heartResult').innerText = '';
    document.getElementById('suddenMissionCloseBtn').style.display = 'none';
    updateHeartUI();
    document.getElementById('heartBtn').classList.add('beating');
    if (heartTimer) clearInterval(heartTimer);
    heartTimer = setInterval(() => {
        heartTimeLeft -= 0.1;
        if (heartTimeLeft <= 0) { heartTimeLeft = 0; endHeartGame(); }
        updateHeartUI();
    }, 100);
}

function clickHeart() {
    if (!heartGameActive) return;
    heartScore += 5;
    if (heartScore >= 100) { heartScore = 100; endHeartGame(); }
    updateHeartUI();
}

function updateHeartUI() {
    const bar = document.getElementById('heartProgressBar');
    const text = document.getElementById('heartProgressText');
    const timer = document.getElementById('heartTimerLabel');
    if (bar) bar.style.width = heartScore + '%';
    if (text) text.innerText = heartScore + '℃';
    if (timer) timer.innerText = '⏱️ ' + heartTimeLeft.toFixed(1) + '초';
}

function endHeartGame() {
    heartGameActive = false;
    if (heartTimer) clearInterval(heartTimer);
    document.getElementById('heartBtn').disabled = true;
    document.getElementById('heartBtn').classList.remove('beating');
    const resultEl = document.getElementById('heartResult');
    document.getElementById('suddenMissionCloseBtn').style.display = 'block';

    if (heartScore >= 100) {
        resultEl.innerHTML = "🎉 <span style='color:#f43f5e;'>미션 대성공!</span> 불타는 사랑 인정!<br><span style='font-size:13px; color:#64748b; font-weight:600; display:block; margin-top:5px; padding:8px; background:#f1f5f9; border-radius:8px;'>🎁 <b style='color:#db2777;'>보상</b>: 위시리스트 추가권이 열립니다!</span>";
        if (typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#f43f5e', '#ef4444', '#ffffff'], zIndex: 999999 });
        }
        setTimeout(() => {
            document.getElementById('suddenMissionModal').classList.remove('active');
            document.getElementById('gameClearModal').classList.add('active');
        }, 2500);
    } else {
        const btn = document.getElementById('heartStartBtn');
        btn.style.display = 'block';
        btn.innerText = '다시 뽀뽀 걸고 도전하기 🔄';
        resultEl.innerHTML = "🥶 <b>시간 초과!</b> 고작 <span style='color:#3b82f6;'>" + Math.floor(heartScore) + "℃</span> 라니요!<br><span style='color:#ef4444; font-size:16px;'>💋 당장 뽀뽀 10번 실시!!</span>";
    }
}

function addWishlistItem() {
    const name = document.getElementById('wishItemName').value.trim();
    const link = document.getElementById('wishItemLink').value.trim();

    if (!name) {
        alert("사고 싶은 선물을 입력해 주세요! 🎁🥺");
        return;
    }

    // DB에 저장 (동기화)
    db.collection("wishlist").add({
        name: name,
        link: link || '#',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 비우기
    document.getElementById('wishItemName').value = '';
    document.getElementById('wishItemLink').value = '';

    document.getElementById('gameClearModal').classList.remove('active');

    // 우측 하단 토글 버튼 띄우기
    document.getElementById('wishlistToggleBtn').classList.remove('hidden');

    // 완료하면 벚꽃 미니게임 UI는 끄고 지도와 다이어리에 집중
    // game persists

    // 위시리스트 플로팅 메뉴 열기
    setTimeout(() => {
        if (!document.getElementById('wishlistFloating').classList.contains('active')) {
            toggleWishlist();
        }
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 }, colors: ['#f43f5e', '#ec4899', '#ffffff'] });
    }, 300);
}

function removeWishlistItem(id) {
    if (confirm("정말 이 위시리스트 항목을 지울까요?")) {
        db.collection("wishlist").doc(id).delete();
    }
}

function toggleWishlist() {
    const floatMenu = document.getElementById('wishlistFloating');
    floatMenu.classList.toggle('active');
}

function renderWishlist() {
    const body = document.getElementById('wishlistBody');
    const badge = document.getElementById('wishBadge');

    badge.innerText = wishlistItems.length;

    if (wishlistItems.length === 0) {
        body.innerHTML = `<div class="wishlist-empty" id="wishlistEmpty">아직 담긴 선물이 없어요! 🌸</div>`;
        return;
    }

    body.innerHTML = '';
    wishlistItems.forEach((item, idx) => {
        let linkHtml = '';
        if (item.link !== '#') {
            const targetUrl = item.link.startsWith('http') ? item.link : 'https://' + item.link;
            linkHtml = `<a href="${targetUrl}" target="_blank" class="wish-link">🔗 구경가기</a>`;
        } else {
            linkHtml = `<span class="wish-link" style="color:#94a3b8; font-weight:400; font-size:11px;">(링크 없음)</span>`;
        }

        body.innerHTML += `
            <div class="wish-item">
                <div class="wish-icon">🎁</div>
                <div class="wish-content">
                    <div class="wish-name">${item.name}</div>
                    ${linkHtml}
                </div>
                <button onclick="removeWishlistItem('${item.id}')" style="background:none; border:none; color:#cbd5e1; cursor:pointer; padding:5px; font-size:16px;">✕</button>
            </div>
        `;
    });
}


function saveMetaData() {
    planData.title = document.getElementById('tripTitle').innerText;
    planData.dates = document.getElementById('tripDates').innerText;
    savePlanData();
}

// --- Memo Posting Board ---
function renderMemos() {
    const board = document.getElementById('memoBoard');
    let html = '';
    planData.memos.forEach((m) => {
        html += `
        <div class="memo-card">
            ${m.text}
            <span class="memo-time">${m.time}</span>
        </div>`;
    });
    if (planData.memos.length === 0) {
        html = `<div style="text-align:center; padding:20px; color:#cbd5e1; font-size:13px; font-weight:700;">아직 대화가 없어요! 먼저 수다를 걸어보세요 💬</div>`;
    }
    board.innerHTML = html;
    board.scrollTop = board.scrollHeight;
}

function handleMemoKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        postMemo();
    }
}

function postMemo() {
    const input = document.getElementById('memoInput');
    const txt = input.value.trim();
    if (!txt) return;

    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${mm}.${dd} ${hh}:${min}`;

    planData.memos.push({ text: txt, time: timeStr });
    input.value = '';
    renderMemos();
    savePlanData();
}


// --- 2 Bags Checklist Logic ---
function switchBag(num) {
    currentBag = num;
    document.getElementById('tabBag1').classList.remove('active');
    document.getElementById('tabBag2').classList.remove('active');
    document.getElementById('tabBag' + num).classList.add('active');

    document.getElementById('checklistContainer1').style.display = num === 1 ? 'flex' : 'none';
    document.getElementById('checklistContainer2').style.display = num === 2 ? 'flex' : 'none';
}

function renderChecklists() {
    ['checklist1', 'checklist2'].forEach((listKey, index) => {
        const num = index + 1;
        const cl = document.getElementById('checklistContainer' + num);
        let html = '';
        planData[listKey].forEach((item) => {
            html += `
            <div class="check-item ${item.done ? 'done' : ''}">
                <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleCheck(${num}, ${item.id})">
                <span class="c-text" contenteditable="true" onblur="updateCheckText(${num}, ${item.id}, this)">${item.text}</span>
                <button class="btn-icon" style="background:transparent; font-size:16px; color:#cbd5e1; width:20px; height:20px;" onclick="deleteCheck(${num}, ${item.id})">✕</button>
            </div>`;
        });
        cl.innerHTML = html;
    });
}

function toggleCheck(bagNum, id) {
    const list = bagNum === 1 ? planData.checklist1 : planData.checklist2;
    const item = list.find(x => x.id === id);
    if (item) item.done = !item.done;
    renderChecklists();
    savePlanData();
}

function updateCheckText(bagNum, id, el) {
    const list = bagNum === 1 ? planData.checklist1 : planData.checklist2;
    const item = list.find(x => x.id === id);
    if (item) item.text = el.innerText;
    savePlanData();
}

function deleteCheck(bagNum, id) {
    if (bagNum === 1) planData.checklist1 = planData.checklist1.filter(x => x.id !== id);
    else planData.checklist2 = planData.checklist2.filter(x => x.id !== id);
    renderChecklists();
    savePlanData();
}

function addChecklistItem() {
    const list = currentBag === 1 ? planData.checklist1 : planData.checklist2;
    list.push({ id: Date.now(), text: "추가할 물품...", done: false });
    renderChecklists();
    savePlanData();
}

// --- Dynamic Tabs ---
function renderTabs() {
    const tabsDiv = document.getElementById('dayTabs');
    let html = '';
    const dayKeys = Object.keys(planData.days);

    dayKeys.forEach(dayStr => {
        const d = parseInt(dayStr);
        if (dayStr === 'pikmin') {
            html += `<div class="day-tab ${currentDay === 'pikmin' ? 'active' : ''}" onclick="switchDay('pikmin')" style="color:#a855f7;">🌱 피크민</div>`;
        } else {
            html += `<div class="day-tab ${d === currentDay ? 'active' : ''}" onclick="switchDay(${d})">Day ${d}</div>`;
        }
    });

    // 피크민 탭이 아직 없으면 추가 버튼 표시
    if (!planData.days['pikmin']) {
        html += `<div class="day-tab" onclick="addPikminDay()" style="color:#a855f7; cursor:pointer;">🌱 피크민</div>`;
    }
    tabsDiv.innerHTML = html;
}

function switchDay(d) {
    currentDay = d;
    renderTabs();
    renderDayList();
}

function addDay() {
    const numericKeys = Object.keys(planData.days).filter(k => k !== 'pikmin');
    const newDay = numericKeys.length + 1;
    planData.days[newDay] = [];
    switchDay(newDay);
    savePlanData();
}

function addPikminDay() {
    if (!planData.days['pikmin']) {
        planData.days['pikmin'] = [];
        savePlanData();
    }
    switchDay('pikmin');
}

// --- Map Logic --- (Kakao Maps)
function initMap() {
    const mapContainer = document.getElementById('mapContainer');
    if (typeof kakao === 'undefined' || !kakao.maps) {
        mapContainer.innerHTML = "<div style='display:flex; height:100%; flex-direction:column; align-items:center; justify-content:center; padding:40px; background:#f1f5f9; text-align:center;'><div style='font-size:30px; margin-bottom:10px;'>🗺️</div><h3 style='color:#334155; margin-bottom:5px;'>카카오 지도를 로드할 수 없습니다</h3><p style='font-size:12px; color:#64748b;'>(로컬 도메인이 카카오 디벨로퍼스에 등록되었는지 확인하세요!)</p></div>";
        return;
    }

    try {
        const options = {
            center: new kakao.maps.LatLng(35.1531696, 129.118666),
            level: 7
        };
        map = new kakao.maps.Map(mapContainer, options);
        updateMapMarkers();
    } catch (e) {
        console.error('Kakao Map init error:', e);
    }
}

function updateMapMarkers() {
    if (!map || typeof kakao === 'undefined' || !kakao.maps) return;

    markers.forEach(m => m.setMap(null));
    if (polyline) polyline.setMap(null);
    markers = [];

    const bounds = new kakao.maps.LatLngBounds();
    const currentSchedule = planData.days[currentDay] || [];
    const path = [];
    let validCount = 0;

    currentSchedule.forEach((item, idx) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lng);

        // 좌표 유효성 검증 (한국 범위: lat 33~39, lng 124~132)
        if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0 ||
            lat < 20 || lat > 50 || lng < 100 || lng > 150) {
            console.warn(`Day ${currentDay} #${idx+1} "${item.name}" 좌표 이상:`, item.lat, item.lng);
            return; // 이 마커 건너뛰기
        }

        const position = new kakao.maps.LatLng(lat, lng);
        path.push(position);
        bounds.extend(position);
        validCount++;

        const isPikmin = (currentDay === 'pikmin');

        var markerEl = document.createElement('div');
        if (isPikmin) {
            // 피크민: 작은 보라색 도트만 노출
            markerEl.style.cssText = 'background:#a855f7; width:14px; height:14px; border-radius:50%; box-shadow:0 2px 6px rgba(168,85,247,0.5); border:2px solid white; cursor:pointer; transition:transform 0.2s;';
            markerEl.onmouseenter = function () { this.style.transform = 'scale(1.5)'; };
            markerEl.onmouseleave = function () { this.style.transform = 'scale(1)'; };
        } else {
            markerEl.style.cssText = 'background:#ec4899; color:white; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:13px; box-shadow:0 2px 8px rgba(236,72,153,0.4); border:2px solid white; cursor:pointer; transition:transform 0.2s;';
            markerEl.innerText = (idx + 1);
            markerEl.onmouseenter = function () { this.style.transform = 'scale(1.3)'; };
            markerEl.onmouseleave = function () { this.style.transform = 'scale(1)'; };
        }
        (function (pos, placeName) {
            markerEl.onclick = function () { onMarkerClick(pos, placeName); };
        })(position, item.name);

        const customOverlay = new kakao.maps.CustomOverlay({
            position: position,
            content: markerEl,
            yAnchor: 0.5,
            xAnchor: 0.5
        });
        customOverlay.setMap(map);
        markers.push(customOverlay);
    });

    if (path.length > 1) {
        polyline = new kakao.maps.Polyline({
            path: path,
            strokeWeight: 4,
            strokeColor: '#f472b6',
            strokeOpacity: 0.8,
            strokeStyle: 'solid'
        });
        polyline.setMap(map);
    }

    if (validCount > 0 && path.length > 0) {
        map.setBounds(bounds);
    } else if (currentSchedule.length > 0 && validCount === 0) {
        // 모든 좌표가 이상한 경우 기본 위치로
        console.warn(`Day ${currentDay}: 유효한 좌표 없음, 기본 위치로 이동`);
        map.setCenter(new kakao.maps.LatLng(35.1531696, 129.118666));
        map.setLevel(7);
    }
}

// 현재 열려있는 라벨 오버레이 추적
let currentLabelOverlay = null;

function onMarkerClick(position, name) {
    if (!map || typeof kakao === 'undefined') return;
    // 기존 라벨 닫기
    if (currentLabelOverlay) {
        currentLabelOverlay.setMap(null);
        currentLabelOverlay = null;
    }
    // 해당 위치로 확대 이동
    map.setCenter(position);
    map.setLevel(3);
    // 장소명 라벨 표시
    var labelContent = '<div style="background:white; padding:8px 14px; border-radius:20px; font-size:13px; font-weight:800; color:#0f172a; box-shadow:0 4px 15px rgba(0,0,0,0.15); border:2px solid #ec4899; white-space:nowrap; transform:translateY(-40px);">' + name + '</div>';
    currentLabelOverlay = new kakao.maps.CustomOverlay({
        position: position,
        content: labelContent,
        yAnchor: 1.5,
        xAnchor: 0.5
    });
    currentLabelOverlay.setMap(map);
}

// --- Timelist Rendering & Drag Logic ---
function renderDayList() {
    const list = document.getElementById('timelineList');
    const items = planData.days[currentDay] || [];

    const dragIcon = `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm12-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"></path></svg>`;

    const isPikmin = (currentDay === 'pikmin');

    let html = '';
    items.forEach((item, idx) => {
        const num = idx + 1;
        const kakaoLink = `https://map.kakao.com/link/search/${encodeURIComponent(item.name)}`;
        const menuCount = (item.menus && item.menus.length > 0) ? item.menus.length : 0;
        const menuBadge = menuCount > 0 ? '<span style="background:#ec4899; color:#fff; font-size:10px; font-weight:900; padding:2px 6px; border-radius:10px; margin-left:4px;">' + menuCount + '</span>' : '';
        const goUrl = item.goLink || kakaoLink;

        if (isPikmin) {
            // 피크민 탭: 간소화 뷰 (도트 번호, 장소명, 메모만)
            html += `
            <div class="tl-item" draggable="true" ondragstart="handleDragStart(event, ${idx})" ondragleave="handleDragLeave(event)" ondragover="handleDragOver(event, ${idx})" ondrop="handleDrop(event, ${idx})" ondragend="handleDragEnd(event)">
                <div class="drag-handle">${dragIcon}</div>
                <div style="width:14px; height:14px; border-radius:50%; background:#a855f7; flex-shrink:0; margin-top:2px;"></div>
                <div class="tl-content">
                    <div class="tl-header">
                        <div class="tl-actions">
                            <button onclick="openModal(${idx})">수정</button>
                            <button style="color:#ef4444;" onclick="deletePlace(${item.id})">삭제</button>
                        </div>
                    </div>
                    <div class="tl-title">${item.name}</div>
                    ${item.link ? `<div class="tl-memo">📝 ${item.link.replace(/\n/g, '<br>')}</div>` : ''}
                </div>
            </div>`;
        } else {
            html += `
        <div class="tl-item" draggable="true" ondragstart="handleDragStart(event, ${idx})" ondragleave="handleDragLeave(event)" ondragover="handleDragOver(event, ${idx})" ondrop="handleDrop(event, ${idx})" ondragend="handleDragEnd(event)">
            <div class="drag-handle">${dragIcon}</div>
            <div class="tl-num">${num}</div>
            <div class="tl-content">
                <div class="tl-header">
                    <span class="tl-time">${item.time}</span>
                    <div class="tl-actions">
                        <button onclick="openModal(${idx})">수정</button>
                        <button style="color:#ef4444;" onclick="deletePlace(${item.id})">삭제</button>
                    </div>
                </div>
                <div class="tl-title">${item.name}</div>
                <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:5px; align-items:center;">
                    <a href="${goUrl}" target="_blank" class="btn-naver-map" style="margin-top:0;">📍 바로가기 ↗</a>
                    ${item.menuVote === 'Y' ? (function(){
                        var isV = item.useVoting !== 'N';
                        var bg = isV ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'linear-gradient(135deg, #3b82f6, #0ea5e9)';
                        var bd = '';
                        if (isV && item.menus && item.menus.length > 0 && !item.menus.some(function(m){return m.done;})) {
                            bd = '<span onclick="openMenuPopup(' + idx + ')" style="position:absolute; top:-14px; right:-10px; font-size:11px; font-weight:900; color:#fff; background:#ec4899; padding:3px 10px; border-radius:12px; white-space:nowrap; cursor:pointer; animation:menuBounce 1.5s ease-in-out infinite; box-shadow:0 3px 8px rgba(236,72,153,0.3);">메뉴 골라주세요!</span>';
                        } else if (!isV && item.menus && item.menus.length > 0 && !getCookie('menuSeen_' + currentDay + '_' + idx)) {
                            bd = '<span onclick="openMenuPopup(' + idx + ')" style="position:absolute; top:-14px; right:-10px; font-size:11px; font-weight:900; color:#fff; background:#0ea5e9; padding:3px 10px; border-radius:12px; white-space:nowrap; cursor:pointer; animation:menuBounce 1.5s ease-in-out infinite; box-shadow:0 3px 8px rgba(14,165,233,0.3);">확인해주세요!</span>';
                        }
                        return '<div style="position:relative; display:inline-flex;"><button onclick="openMenuPopup(' + idx + ')" style="display:inline-flex; align-items:center; gap:4px; padding:8px 14px; background:' + bg + '; color:#fff; border-radius:20px; font-size:12px; font-weight:800; border:none; cursor:pointer; transition:0.2s; letter-spacing:0.3px;" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'">🍽 ' + (item.menuLabel || '메뉴') + menuBadge + '</button>' + bd + '</div>';
                    })() : ''}
                </div>
                ${item.link ? `<div class="tl-memo">📝 ${item.link.replace(/\n/g, '<br>')}</div>` : ''}
            </div>
        </div>`;
        } // end else (non-pikmin)
    });

    if (items.length === 0) {
        html = `<div style="text-align:center; padding:40px 20px; color:#94a3b8; font-size:14px; font-weight:700;">등록된 스케줄이 없습니다. 새로운 방문 장소를 더해보세요!</div>`;
    }

    list.innerHTML = html;
    updateMapMarkers();
}

function handleDragStart(e, idx) {
    draggedItemIndex = idx;
    setTimeout(() => {
        e.target.classList.add('dragging');
    }, 0);
}

function handleDragOver(e, idx) {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === idx) return;
    const currentTarget = e.currentTarget;
    currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e, targetIdx) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    if (draggedItemIndex === null || draggedItemIndex === targetIdx) return;

    let items = planData.days[currentDay];
    const draggedItem = items.splice(draggedItemIndex, 1)[0];
    items.splice(targetIdx, 0, draggedItem);

    renderDayList();
    savePlanData();
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedItemIndex = null;
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

// --- Specific Modal Logic ---
function openModal(editIdx = -1) {
    const modal = document.getElementById('addModal');
    document.getElementById('searchResults').classList.remove('active');

    const isPikmin = (currentDay === 'pikmin');
    // 피크민 탭: 시간/메뉴투표 폼 숨기기
    document.getElementById('placeTime').closest('.form-group').style.display = isPikmin ? 'none' : '';
    document.querySelectorAll('.form-group').forEach(fg => {
        if (fg.querySelector('#menuVoteY')) fg.style.display = isPikmin ? 'none' : '';
    });

    if (editIdx > -1) {
        const item = planData.days[currentDay][editIdx];
        document.getElementById('modalTitle').innerText = isPikmin ? '🌱 피크민 스팟 수정' : '일정 상세 수정';
        document.getElementById('editItemIdx').value = editIdx;
        document.getElementById('placeTime').value = item.time;
        document.getElementById('placeName').value = item.name;
        document.getElementById('placeLink').value = item.link;
        document.getElementById('placeLat').value = item.lat;
        document.getElementById('placeLng').value = item.lng;
        document.getElementById('placeSearch').value = item.name;
        document.getElementById('modalSaveBtn').innerText = isPikmin ? '스팟 수정 완료' : '일정 수정 완료';
        document.getElementById('goLinkInput').value = item.goLink || '';

        // 좌표 기반 도로명 주소 역지오코딩
        if (item.lat && item.lng) {
            fetchRoadAddress(item.lat, item.lng, item.name);
        }
        if (!isPikmin) {
            // 메뉴 투표 토글 상태
            var mv = item.menuVote === 'Y' ? 'Y' : 'N';
            document.getElementById('menuVoteToggle').value = mv;
            document.getElementById('menuLabelInput').value = item.menuLabel || '';
            document.getElementById('menuLabelWrap').style.display = mv === 'Y' ? 'flex' : 'none';
            var uv = item.useVoting === 'N' ? 'N' : 'Y';
            document.getElementById('useVotingToggle').value = uv;
            setUseVotingUI(uv);
            setMenuVoteUI(mv);
        }
    } else {
        document.getElementById('modalTitle').innerText = isPikmin ? '🌱 피크민 스팟 추가' : '새로운 일정 추가';
        document.getElementById('editItemIdx').value = -1;
        document.getElementById('placeTime').value = '12:00';
        document.getElementById('placeName').value = '';
        document.getElementById('placeLink').value = '';
        document.getElementById('goLinkInput').value = '';
        document.getElementById('placeLat').value = '';
        document.getElementById('placeLng').value = '';
        document.getElementById('placeSearch').value = '';
        document.getElementById('modalSaveBtn').innerText = isPikmin ? '스팟 저장하기' : '일정 저장하기';
        document.getElementById('menuVoteToggle').value = 'N';
        document.getElementById('menuLabelInput').value = '';
        document.getElementById('menuLabelWrap').style.display = 'none';
        document.getElementById('useVotingToggle').value = 'Y';
        setUseVotingUI('Y');
        setMenuVoteUI('N');
    }

    modal.classList.add('active');
}

function setMenuVoteUI(val) {
    var yBtn = document.getElementById('menuVoteY');
    var nBtn = document.getElementById('menuVoteN');
    if (val === 'Y') {
        yBtn.style.borderColor = '#ec4899'; yBtn.style.background = '#fdf2f8'; yBtn.style.color = '#ec4899';
        nBtn.style.borderColor = '#e2e8f0'; nBtn.style.background = ''; nBtn.style.color = '';
    } else {
        nBtn.style.borderColor = '#ec4899'; nBtn.style.background = '#fdf2f8'; nBtn.style.color = '#ec4899';
        yBtn.style.borderColor = '#e2e8f0'; yBtn.style.background = ''; yBtn.style.color = '';
    }
}

function setUseVotingUI(val) {
    var yBtn = document.getElementById('useVotingY');
    var nBtn = document.getElementById('useVotingN');
    if (val === 'Y') {
        yBtn.style.borderColor = '#ec4899'; yBtn.style.background = '#fdf2f8'; yBtn.style.color = '#ec4899';
        nBtn.style.borderColor = '#e2e8f0'; nBtn.style.background = ''; nBtn.style.color = '';
    } else {
        nBtn.style.borderColor = '#ec4899'; nBtn.style.background = '#fdf2f8'; nBtn.style.color = '#ec4899';
        yBtn.style.borderColor = '#e2e8f0'; yBtn.style.background = ''; yBtn.style.color = '';
    }
}

function closeModal() {
    document.getElementById('addModal').classList.remove('active');
}

function deletePlace(id) {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    planData.days[currentDay] = planData.days[currentDay].filter(x => x.id !== id);
    renderDayList();
    savePlanData();
}

// --- 좌표 기반 도로명 주소 역지오코딩 ---
async function fetchRoadAddress(lat, lng, placeName) {
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '<div style="padding:10px 15px; font-size:12px;">📍 등록된 마커 정보 조회 중...</div>';
    resultsDiv.classList.add('active');

    try {
        const res = await fetch('https://dapi.kakao.com/v2/local/geo/coord2address.json?x=' + lng + '&y=' + lat, {
            headers: { 'Authorization': 'KakaoAK a96127e47451de372f4520daa831fde9' }
        });
        const data = await res.json();

        if (data.documents && data.documents.length > 0) {
            const doc = data.documents[0];
            const roadAddr = doc.road_address ? doc.road_address.address_name : '';
            const jibunAddr = doc.address ? doc.address.address_name : '';
            const displayAddr = roadAddr || jibunAddr || '주소 정보 없음';

            resultsDiv.innerHTML = `
                <div style="padding:12px 15px;">
                    <div style="font-size:13px; font-weight:800; color:#ec4899; margin-bottom:6px;">✓ 현재 등록된 마커 정보</div>
                    <div style="font-size:13px; font-weight:700; color:#1e293b; margin-bottom:4px;">📍 ${placeName}</div>
                    ${roadAddr ? '<div style="font-size:12px; color:#334155; margin-bottom:2px;">🛣️ 도로명: ' + roadAddr + '</div>' : ''}
                    ${jibunAddr ? '<div style="font-size:12px; color:#64748b;">📌 지번: ' + jibunAddr + '</div>' : ''}
                    <div style="font-size:11px; color:#94a3b8; margin-top:4px;">좌표: ${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}</div>
                </div>`;
        } else {
            resultsDiv.innerHTML = `
                <div style="padding:12px 15px;">
                    <div style="font-size:13px; font-weight:800; color:#ec4899; margin-bottom:4px;">✓ 현재 등록된 마커</div>
                    <div style="font-size:13px; font-weight:700; color:#1e293b;">📍 ${placeName}</div>
                    <div style="font-size:11px; color:#94a3b8; margin-top:4px;">좌표: ${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}</div>
                </div>`;
        }
    } catch (e) {
        resultsDiv.innerHTML = `
            <div style="padding:12px 15px;">
                <div style="font-size:13px; font-weight:800; color:#ec4899; margin-bottom:4px;">✓ 현재 등록된 마커</div>
                <div style="font-size:13px; font-weight:700; color:#1e293b;">📍 ${placeName}</div>
                <div style="font-size:11px; color:#94a3b8; margin-top:4px;">좌표: ${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}</div>
            </div>`;
    }
}

async function searchLocation() {
    var q = document.getElementById('placeSearch').value;
    if (!q) return alert("검색어를 입력해 주세요.");

    var resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '<div style="padding:15px; font-size:12px;">카카오 지도에서 검색 중...</div>';
    resultsDiv.classList.add('active');

    try {
        var res = await fetch('https://dapi.kakao.com/v2/local/search/keyword.json?query=' + encodeURIComponent(q) + '&size=5', {
            headers: { 'Authorization': 'KakaoAK a96127e47451de372f4520daa831fde9' }
        });
        var data = await res.json();

        if (!data.documents || data.documents.length === 0) {
            var res2 = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q) + '&accept-language=ko');
            var data2 = await res2.json();
            if (data2.length === 0) {
                resultsDiv.innerHTML = '<div style="padding:15px; font-size:12px; color:#ef4444;">검색 결과가 없습니다.</div>';
                return;
            }
            var html = '';
            for (var i = 0; i < Math.min(data2.length, 5); i++) {
                var item = data2[i];
                var shortName = item.display_name.split(',').slice(0, 3).join(', ');
                html += '<div class="search-item" onclick="selectLocation(\'' + item.lat + '\', \'' + item.lon + '\', \'' + shortName.replace(/'/g, '') + '\')">📍 ' + shortName + '</div>';
            }
            resultsDiv.innerHTML = html;
            return;
        }

        var html2 = '';
        for (var j = 0; j < data.documents.length; j++) {
            var place = data.documents[j];
            var pname = place.place_name;
            var addr = place.road_address_name || place.address_name || '';
            html2 += '<div class="search-item" onclick="selectLocation(\'' + place.y + '\', \'' + place.x + '\', \'' + pname.replace(/'/g, '') + '\', \'' + addr.replace(/'/g, '') + '\')">📍 <strong>' + pname + '</strong> <span style="color:#64748b; font-size:11px;">' + addr + '</span></div>';
        }
        resultsDiv.innerHTML = html2;

    } catch (e) {
        resultsDiv.innerHTML = '<div style="padding:15px; font-size:12px; color:#ef4444;">API 통신 에러가 발생했습니다.</div>';
    }
}

function selectLocation(lat, lng, name, addr) {
    document.getElementById('placeLat').value = lat;
    document.getElementById('placeLng').value = lng;
    const nameInput = document.getElementById('placeName');

    let tidyName = name.split(',')[0];
    if (!nameInput.value) nameInput.value = tidyName;

    const resultsDiv = document.getElementById('searchResults');
    let addrHtml = '';
    if (addr) {
        addrHtml = '<div style="padding:4px 15px 0; font-size:12px; color:#64748b;">📌 ' + addr + '</div>';
    }
    resultsDiv.innerHTML = '<div style="padding:10px 15px; font-size:13px; color:#ec4899; font-weight:800;">✓ 마커 좌표 연결 완료!</div>' + addrHtml;
}

function savePlace() {
    const idxStr = document.getElementById('editItemIdx').value;
    const isEdit = idxStr !== "-1";

    const time = document.getElementById('placeTime').value || "12:00";
    const name = document.getElementById('placeName').value;
    const link = document.getElementById('placeLink').value;
    const lat = document.getElementById('placeLat').value;
    const lng = document.getElementById('placeLng').value;

    if (!name) return alert("장소명을 필수로 입력해 주세요.");

    let finalLat = parseFloat(lat);
    let finalLng = parseFloat(lng);

    if (!lat || !lng) {
        finalLat = 35.15 + (Math.random() * 0.02 - 0.01);
        finalLng = 129.11 + (Math.random() * 0.04 - 0.02);
    }

    if (isEdit) {
        const item = planData.days[currentDay][parseInt(idxStr)];
        item.time = time;
        item.name = name;
        item.link = link;
        item.lat = finalLat;
        item.lng = finalLng;
        item.menuVote = document.getElementById('menuVoteToggle').value;
        item.menuLabel = document.getElementById('menuLabelInput').value.trim();
        item.useVoting = document.getElementById('useVotingToggle').value;
        item.goLink = document.getElementById('goLinkInput').value.trim();
    } else {
        planData.days[currentDay].push({
            id: Date.now(),
            time: time,
            name: name,
            lat: finalLat,
            lng: finalLng,
            link: link,
            menuVote: document.getElementById('menuVoteToggle').value,
            menuLabel: document.getElementById('menuLabelInput').value.trim(),
            useVoting: document.getElementById('useVotingToggle').value,
            goLink: document.getElementById('goLinkInput').value.trim(),
            menus: []
        });
    }

    // 피크민 탭이면 시간 정렬 안 함
    if (currentDay !== 'pikmin') {
        planData.days[currentDay].sort((a, b) => a.time.localeCompare(b.time));
    }

    closeModal();
    renderDayList();
    savePlanData();
}

// --- Menu Popup Logic ---
let menuPopupIdx = -1;

function openMenuPopup(idx) {
    menuPopupIdx = idx;
    const item = planData.days[currentDay][idx];
    if (!item.menus) item.menus = [];
    // 투표N이면 쿠키 설정 (확인해주세요 배지 숨김)
    if (item.useVoting === 'N') {
        setCookie('menuSeen_' + currentDay + '_' + idx, '1', 24 * 30);
        renderDayList();
    }
    document.getElementById('menuPopupTitle').innerText = '🍽 ' + (item.menuLabel || '메뉴') + ' 리스트';
    renderMenuPopup(item);
    document.getElementById('menuPopupModal').classList.add('active');
}

function closeMenuPopup() {
    document.getElementById('menuPopupModal').classList.remove('active');
    menuPopupIdx = -1;
}

function renderMenuPopup(item) {
    const listEl = document.getElementById('menuPopupList');
    if (!item.menus || item.menus.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8; font-size:13px; font-weight:700;">아직 메뉴가 없어요! 아래에서 추가해보세요 🍽</div>';
        return;
    }
    const isVoting = item.useVoting !== 'N';
    let html = '';

    if (isVoting) {
        const hasSelected = item.menus.some(m => m.done);
        if (!hasSelected) {
            html += `<div style="text-align:center; padding:12px; margin-bottom:8px; background:linear-gradient(135deg, #fdf2f8, #fff1f2); border-radius:12px; border:1px dashed #ec4899; animation:menuBounce 1.5s ease-in-out infinite;">
                <span style="font-size:14px; font-weight:900; color:#ec4899;">💕 쇠돌이가 정한거에서 골라주세요!</span>
            </div>`;
        }
        item.menus.forEach((m, i) => {
            const checked = m.done ? 'checked' : '';
            const selectedStyle = m.done ? 'background:#fdf2f8; border-color:#ec4899;' : '';
            const selectedLabel = m.done ? '<span style="display:block; font-size:11px; color:#ec4899; font-weight:900; margin-top:3px;">✅ 희진이 선택 완료</span>' : '';
            const linkBtn = m.link ? `<a href="${m.link}" target="_blank" style="font-size:11px; color:#3b82f6; font-weight:700; text-decoration:none; margin-left:6px;">🔗 링크</a>` : '';
            html += `<div style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px; transition:0.2s; border:1px solid #e2e8f0; margin-bottom:6px; ${selectedStyle}">
                <input type="radio" name="menuSelect" ${checked} onchange="toggleMenuItem(${i})" style="width:18px; height:18px; accent-color:#ec4899; cursor:pointer; flex-shrink:0;">
                <div style="flex:1;">
                    <span style="font-size:14px; font-weight:700; color:#1e293b;">${m.name}${linkBtn}</span>
                    ${selectedLabel}
                </div>
                <button onclick="deleteMenuItem(${i})" style="background:#fee2e2; border:none; color:#ef4444; width:24px; height:24px; border-radius:50%; cursor:pointer; font-weight:900; font-size:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">×</button>
            </div>`;
        });
    } else {
        // 단순 리스트 모드 (투표 없음)
        item.menus.forEach((m, i) => {
            const linkBtn = m.link ? `<a href="${m.link}" target="_blank" style="font-size:11px; color:#3b82f6; font-weight:700; text-decoration:none; margin-left:6px;">🔗 링크</a>` : '';
            html += `<div style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:6px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                <span style="color:#0ea5e9; font-weight:900; font-size:14px; flex-shrink:0;">•</span>
                <span style="flex:1; font-size:14px; font-weight:700; color:#1e293b;">${m.name}${linkBtn}</span>
                <button onclick="deleteMenuItem(${i})" style="background:#fee2e2; border:none; color:#ef4444; width:24px; height:24px; border-radius:50%; cursor:pointer; font-weight:900; font-size:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">×</button>
            </div>`;
        });
    }
    listEl.innerHTML = html;
}

function addMenuItem() {
    const nameInput = document.getElementById('menuItemName');
    const linkInput = document.getElementById('menuItemLink');
    const name = nameInput.value.trim();
    if (!name) return alert('메뉴 이름을 입력해주세요.');

    const item = planData.days[currentDay][menuPopupIdx];
    if (!item.menus) item.menus = [];
    item.menus.push({ name: name, link: linkInput.value.trim(), done: false });
    nameInput.value = '';
    linkInput.value = '';
    renderMenuPopup(item);
    renderDayList();
    savePlanData();
}

function toggleMenuItem(menuIdx) {
    const item = planData.days[currentDay][menuPopupIdx];
    // 라디오 로직: 다른 항목은 모두 해제, 선택한 항목만 done
    item.menus.forEach((m, i) => {
        m.done = (i === menuIdx);
    });
    renderMenuPopup(item);
    renderDayList();
    savePlanData();
}

function deleteMenuItem(menuIdx) {
    const item = planData.days[currentDay][menuPopupIdx];
    item.menus.splice(menuIdx, 1);
    renderMenuPopup(item);
    renderDayList();
    savePlanData();
}
