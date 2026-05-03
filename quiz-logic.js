/* quiz-logic.js */
let quizData = [];         
let filteredData = [];     
let studentName = "";
let currentIdx = 0;
let hasAnswered = false;
let isAdmin = false;
let currentDifficulty = "All";

window.onload = async () => {
    // 先嘗試找已經被標記為 active 的按鈕
    let activeTopicBtn = document.querySelector('.topic-btn.active');

    // 如果找不到，就強制抓第一個按鈕，並幫它加上 active
    if (!activeTopicBtn) {
        activeTopicBtn = document.querySelector('.topic-btn');
        if (activeTopicBtn) {
            activeTopicBtn.classList.add('active');
        }
    }

    // 防呆：如果連按鈕都沒有，才 fallback 到 Change of Subject
    const topic = activeTopicBtn ? activeTopicBtn.dataset.val : "Change of Subject";
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
            if (!studentName) {
                document.getElementById('auth-overlay').classList.add('active');
            } else {
                currentIdx = 0;
                render();
            }
        } else {
            document.getElementById('loading-text').innerText = `⚠️ 找不到課題為 "${topicName}" 的題目。`;
        }
    } catch (error) {
        document.getElementById('loading-text').innerText = "⚠️ 連線失敗，請檢查設定。";
    }
}

function updateDiffNav() {
    const nav = document.getElementById('diff-nav');
    if (!nav) return;
    const diffs = [...new Set(quizData.map(q => parseInt(q.difficulty)).filter(d => !isNaN(d) && d > 0))].sort((a, b) => a - b);
    if (diffs.length === 0) { nav.style.display = 'none'; return; }
    nav.style.display = 'flex';
    let html = `<button class="diff-btn ${currentDifficulty === 'All' ? 'active' : ''}" onclick="filterDifficulty('All')">全部難度</button>`;
    diffs.forEach(d => {
        html += `<button class="diff-btn ${currentDifficulty == d ? 'active' : ''}" onclick="filterDifficulty(${d})">${d} ⭐</button>`;
    });
    nav.innerHTML = html;
}

function filterDifficulty(val) {
    currentDifficulty = val;
    updateDiffNav(); 
    currentIdx = 0;
    applyFilter();
    render();
}

function applyFilter() {
    if (currentDifficulty === "All") { filteredData = quizData; } 
    else { filteredData = quizData.filter(q => parseInt(q.difficulty) === parseInt(currentDifficulty)); }
}

async function fetchTopicData(btn) {
    if (btn.classList.contains('active')) return; 
    document.querySelectorAll('.topic-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('loading-screen').style.display = 'flex';
    document.getElementById('loading-text').innerText = `切換至 ${btn.innerText}...`;
    await loadInitialData(btn.dataset.val);
}

async function handleAuth() {
    const input = document.getElementById('input-name').value.trim();
    const btn = document.getElementById('auth-btn');
    const err = document.getElementById('auth-error');
    if (!input) return;
    if (input === ADMIN_KEY) { isAdmin = true; studentName = "Administrator"; loginSuccess(); return; }
    btn.disabled = true; btn.innerText = "驗證中...";
    try {
        const resp = await fetch(`${SCRIPT_URL}?name=${encodeURIComponent(input)}`);
        const text = await resp.text();
        if (text.trim() !== "Unauthorized") { studentName = text.trim(); loginSuccess(); }
        else { err.innerText = "⚠️ 姓名未授權"; btn.disabled = false; btn.innerText = "進入系統"; }
    } catch (e) { err.innerText = "⚠️ 連線失敗"; btn.disabled = false; }
}

function loginSuccess() {
    document.getElementById('auth-overlay').classList.remove('active');
    document.getElementById('user-name-tag').innerText = studentName;
    const badge = document.getElementById('status-badge');
    if (isAdmin) { badge.innerText = "ADMIN 模式"; badge.classList.add('admin'); }
    else { badge.innerText = "已連線雲端"; }
    render();
}

function render() {
    if (filteredData.length === 0) {
        document.getElementById('q-text').innerText = "此難度下暫無題目。";
        document.getElementById('options-container').innerHTML = "";
        document.getElementById('progress-tag').innerText = "0 / 0";
        document.getElementById('year-nav').innerHTML = "";
        document.getElementById('q-diff-display').innerText = "";
        return;
    }
    hasAnswered = false;
    document.getElementById('explain-btn').disabled = !isAdmin;
    document.getElementById('explain-btn').innerText = isAdmin ? "📖 查看詳解" : "📖 答題後解鎖";
    const q = filteredData[currentIdx];
    document.getElementById('q-meta').innerText = q.id;
    
    // 【關鍵修復 1】：保護題目內容的 < 和 > 不被吃掉
    let safeQuestionText = String(q.text).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    document.getElementById('q-text').innerHTML = safeQuestionText;
    
    document.getElementById('progress-tag').innerText = `${currentIdx + 1} / ${filteredData.length}`;
    const diffNum = parseInt(q.difficulty);
    const stars = (!isNaN(diffNum) && diffNum > 0) ? "⭐".repeat(diffNum) : "";
    document.getElementById('q-diff-display').innerText = stars;
    
    const container = document.getElementById('options-container');
    container.innerHTML = "";
    
    q.options.forEach((opt, i) => {
        const div = document.createElement('div');
        
        // 【關鍵修復 2】：保護選項裡的 < 和 > 不被當成 HTML 標籤
        let displayOpt = String(opt).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        const hasFraction = displayOpt.includes('\\frac');
        if (hasFraction) {
            div.className = 'option has-fraction';
            displayOpt = displayOpt.replace(/\\frac/g, '\\displaystyle \\frac');
        } else {
            div.className = 'option';
        }
        div.innerHTML = `<span style="color:var(--disabled); width:30px; font-style:italic; flex-shrink:0;">${['A','B','C','D'][i]}.</span> <span style="font-family:'Times New Roman', serif; font-weight:bold; font-style:italic; line-height: 1.5;">${displayOpt}</span>`;
        div.onclick = () => checkAnswer(i, div);
        container.appendChild(div);
    });
    
    updateYearNav();
    if (window.MathJax) MathJax.typesetPromise();
}
    updateYearNav();
    if (window.MathJax) MathJax.typesetPromise();
}

function checkAnswer(idx, el) {
    if (hasAnswered && !isAdmin) return;
    const correct = filteredData[currentIdx].ans;
    const isCorrect = (idx === correct);
    document.querySelectorAll('.option').forEach(o => o.classList.remove('correct', 'wrong'));
    el.classList.add(isCorrect ? 'correct' : 'wrong');
    if (!hasAnswered) {
        hasAnswered = true;
        document.getElementById('explain-btn').disabled = false;
        document.getElementById('explain-btn').innerText = "📖 查看詳解";
        if (!isAdmin) {
            const params = new URLSearchParams({ studentName: studentName, qId: filteredData[currentIdx].id, choice: ['A','B','C','D'][idx], status: isCorrect ? "正確" : "錯誤" });
            fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: params });
        }
    }
}

function nextQuestion() {
    if (filteredData.length === 0) return;
    currentIdx = (currentIdx + 1) % filteredData.length;
    render();
}

function openModal(type) {
    if (filteredData.length === 0) return;
    const q = filteredData[currentIdx];
    document.getElementById('modal-title').innerText = type === 'hint' ? "💡 提示 (Hint)" : "📖 答案詳解 (Explanation)";
    let content = type === 'hint' ? `<span style="display:inline-block; background:#DBEAFE; color:#1E40AF; padding:4px 10px; border-radius:6px; font-weight:bold; margin-bottom:10px">${q.hint}</span>` : q.explain;
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal').classList.add('active');
    if (window.MathJax) MathJax.typesetPromise([document.getElementById('modal-body')]);
}

function closeModal() { document.getElementById('modal').classList.remove('active'); }

function updateYearNav() {
    const nav = document.getElementById('year-nav');
    nav.innerHTML = "";
    filteredData.forEach((q, i) => {
        const b = document.createElement('button');
        b.className = `year-btn ${i === currentIdx ? 'active' : ''}`;
        b.innerText = q.year;
        b.onclick = () => { currentIdx = i; render(); };
        nav.appendChild(b);
    });
    const activeBtn = document.querySelector('.year-btn.active');
    if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}
