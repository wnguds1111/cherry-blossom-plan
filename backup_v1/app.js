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
    // Sudden Mission Pop-up Timer
    setTimeout(() => {
        const suddenModal = document.getElementById('suddenMissionModal');
        if (suddenModal) suddenModal.classList.add('active');
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

    currentSchedule.forEach((item, idx) => {
        if (item.lat && item.lng) {
            const position = new kakao.maps.LatLng(item.lat, item.lng);
            path.push(position);
            bounds.extend(position);

            var markerEl = document.createElement('div');
            markerEl.style.cssText = 'background:#ec4899; color:white; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:13px; box-shadow:0 2px 8px rgba(236,72,153,0.4); border:2px solid white; cursor:pointer; transition:transform 0.2s;';
            markerEl.innerText = (idx + 1);
            markerEl.onmouseenter = function () { this.style.transform = 'scale(1.3)'; };
            markerEl.onmouseleave = function () { this.style.transform = 'scale(1)'; };
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
        }
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

    if (path.length > 0) {
        map.setBounds(bounds);
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

    let html = '';
    items.forEach((item, idx) => {
        const num = idx + 1;
        const kakaoLink = `https://map.kakao.com/link/search/${encodeURIComponent(item.name)}`;

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
                <a href="${kakaoLink}" target="_blank" class="btn-naver-map">📍 바로가기 ↗</a>
                ${item.link ? `<div class="tl-memo">📝 ${item.link}</div>` : ''}
            </div>
        </div>`;
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

    if (editIdx > -1) {
        const item = planData.days[currentDay][editIdx];
        document.getElementById('modalTitle').innerText = '일정 상세 수정';
        document.getElementById('editItemIdx').value = editIdx;
        document.getElementById('placeTime').value = item.time;
        document.getElementById('placeName').value = item.name;
        document.getElementById('placeLink').value = item.link;
        document.getElementById('placeLat').value = item.lat;
        document.getElementById('placeLng').value = item.lng;
        document.getElementById('placeSearch').value = '';
        document.getElementById('modalSaveBtn').innerText = '일정 수정 완료';
    } else {
        document.getElementById('modalTitle').innerText = '새로운 일정 추가';
        document.getElementById('editItemIdx').value = -1;
        document.getElementById('placeTime').value = '12:00';
        document.getElementById('placeName').value = '';
        document.getElementById('placeLink').value = '';
        document.getElementById('placeLat').value = '';
        document.getElementById('placeLng').value = '';
        document.getElementById('placeSearch').value = '';
        document.getElementById('modalSaveBtn').innerText = '일정 저장하기';
    }

    modal.classList.add('active');
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
            html2 += '<div class="search-item" onclick="selectLocation(\'' + place.y + '\', \'' + place.x + '\', \'' + pname.replace(/'/g, '') + '\')">📍 <strong>' + pname + '</strong> <span style="color:#64748b; font-size:11px;">' + addr + '</span></div>';
        }
        resultsDiv.innerHTML = html2;

    } catch (e) {
        resultsDiv.innerHTML = '<div style="padding:15px; font-size:12px; color:#ef4444;">API 통신 에러가 발생했습니다.</div>';
    }
}

function selectLocation(lat, lng, name) {
    document.getElementById('placeLat').value = lat;
    document.getElementById('placeLng').value = lng;
    const nameInput = document.getElementById('placeName');

    let tidyName = name.split(',')[0];
    if (!nameInput.value) nameInput.value = tidyName;

    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '<div style="padding:10px 15px; font-size:13px; color:#ec4899; font-weight:800;">✓ 마커 좌표 연결 완료!</div>';
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
    } else {
        planData.days[currentDay].push({
            id: Date.now(),
            time: time,
            name: name,
            lat: finalLat,
            lng: finalLng,
            link: link
        });
    }

    planData.days[currentDay].sort((a, b) => a.time.localeCompare(b.time));

    closeModal();
    renderDayList();
    savePlanData();
}
