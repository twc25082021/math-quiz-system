/* quiz-logic.js (完整修復版：含換行、彈窗控制、難度選單) */
let quizData = [];         
let filteredData = [];     
let currentIdx = 0;
let hasAnswered = false;
let isAdmin = false;
let currentDifficulty = "All";

let currentUser = { id: "", name: "", className: "", classNo: "" };

window.onload = async () => {
    let activeTopicBtn = document.querySelector('.topic-btn.active');
    const topic = activeTopicBtn ? activeTopicBtn.dataset.val : "Permutation and Combination";
    await loadInitialData(topic);
};

async function loadInitialData(topicName) {
    try {
        const resp = await fetch(`${SCRIPT_URL}?action=getQuestions&topic=${encodeURIComponent(topicName)}`);
        const result = await resp.json();
        if (result.status === "success" && result.data && result.data.length > 0) {
            quizData = result.data;
            currentDifficulty = "All"; 
            updateDiffNav(); 
            applyFilter();   
            document.getElementById('loading-screen').style.display = 'none';
            if (!currentUser.name) {
                document.getElementById('auth-overlay').classList.add('active');
            } else {
                render();
            }
        }
    } catch (e) { console.error("載入失敗", e); }
}

async function handleAuth() {
    const val = document.getElementById('input-name').value.trim();
    if (!val) return;
    const errDiv = document.getElementById('auth-error');
    errDiv.innerText = "驗證中...";
    
    if (val === ADMIN_KEY) {
        isAdmin = true;
        currentUser = { id: "ADMIN", name: "管理員", className: "SYS", classNo: "00" };
        loginSuccess();
        return;
    }

    try {
        const resp = await fetch(`${SCRIPT_URL}?action=getUser&id=${val}`);
        const user = await resp.json();
        if (user.status === "success") {
            currentUser = { id: user.id, name: user.name, className: user.className, classNo: user.classNo };
            loginSuccess();
        } else {
            errDiv.innerText = "❌ 找不到此學號，請重新輸入";
        }
    } catch (e) { errDiv.innerText = "❌ 連線失敗"; }
}

function loginSuccess() {
    document.getElementById('auth-overlay').classList.remove('active');
    document.getElementById('user-name-tag').innerText = `${currentUser.className} (${currentUser.classNo}) ${currentUser.name}`;
    if (isAdmin) {
        const badge = document.getElementById('status-badge');
        badge.innerText = "ADMIN";
        badge.classList.add('admin');
    }
    render();
}

function updateDiffNav() {
    const nav = document.getElementById('diff-nav');
    const diffs = ["All", ...new Set(quizData.map(q => q.diff).filter(d => d))];
    if (diffs.length <= 1) { nav.style.display = 'none'; return; }
    nav.style.display = 'flex';
    nav.innerHTML = diffs.map(d => `<button class="diff-btn ${d === currentDifficulty ? 'active' : ''}" onclick="filterByDiff('${d}', this)">${d === 'All' ? '全部難度' : '難度 ' + d}</button>`).join('');
}

function filterByDiff(diff, btn) {
    currentDifficulty = diff;
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilter();
}

function applyFilter() {
    filteredData = currentDifficulty === "All" ? [...quizData] : quizData.filter(q => q.diff == currentDifficulty);
    currentIdx = 0;
    render();
}

function render() {
    if (filteredData.length === 0) return;
    const q = filteredData[currentIdx];
    hasAnswered = false;
    document.getElementById('progress-tag').innerText = `${currentIdx + 1} / ${filteredData.length}`;
    document.getElementById('q-meta').innerText = `${q.id} | ${q.topic}`;
    document.getElementById('q-diff-display').innerText = "★".repeat(q.diff || 0);
    document.getElementById('q-text').innerText = q.question;
    document.getElementById('explain-btn').disabled = true;

    const container = document.getElementById('options-container');
    container.innerHTML = "";
    ['A','B','C','D'].forEach(opt => {
        const div = document.createElement('div');
        div.className = 'option';
        const content = q['opt' + opt];
        if (content.includes('\\frac') || content.includes('^')) div.classList.add('has-fraction');
        div.innerText = `${opt}. ${content}`;
        div.onclick = () => checkAnswer(opt, div);
        container.appendChild(div);
    });
    updateYearNav();
    if (window.MathJax) MathJax.typesetPromise();
}

function checkAnswer(selected, element) {
    if (hasAnswered) return;
    hasAnswered = true;
    const q = filteredData[currentIdx];
    const options = document.querySelectorAll('.option');
    
    options.forEach(opt => {
        if (opt.innerText.startsWith(q.answer)) opt.classList.add('correct');
    });

    if (selected !== q.answer) {
        element.classList.add('wrong');
    }
    document.getElementById('explain-btn').disabled = false;
}

function nextQuestion() {
    currentIdx = (currentIdx + 1) % filteredData.length;
    render();
}

function openModal(type) {
    if (filteredData.length === 0) return;
    const q = filteredData[currentIdx];
    document.getElementById('modal-title').innerText = type === 'hint' ? "💡 提示" : "📖 詳解";
    
    let rawText = type === 'hint' ? (q.hint || "無提示") : (q.explain || "無詳解");
    let safeContent = String(rawText).replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
    
    document.getElementById('modal-body').innerHTML = type === 'hint' ? `<div class="quiz-hint">${safeContent}</div>` : safeContent;
    document.getElementById('modal').classList.add('active');
    if (window.MathJax) MathJax.typesetPromise([document.getElementById('modal-body')]);
}

function closeModal() { 
    document.getElementById('modal').classList.remove('active'); 
}

function updateYearNav() {
    const nav = document.getElementById('year-nav');
    nav.innerHTML = filteredData.map((q, i) => `
        <button class="year-btn ${i === currentIdx ? 'active' : ''}" onclick="jumpTo(${i})">${q.year}</button>
    `).join('');
}

function jumpTo(i) { currentIdx = i; render(); }

async function fetchTopicData(btn) {
    document.querySelectorAll('.topic-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('loading-screen').style.display = 'flex';
    document.getElementById('loading-text').innerText = "更換課題中...";
    await loadInitialData(btn.dataset.val);
}
