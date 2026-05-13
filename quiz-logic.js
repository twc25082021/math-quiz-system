/* quiz-logic.js (加入換行支援、班別學號與數學分數放大支援) */

let quizData = [];         
let filteredData = [];     
let currentIdx = 0;
let hasAnswered = false;
let isAdmin = false;
let currentDifficulty = "All";

let currentUser = {
    id: "", name: "", className: "", classNo: ""
};

window.onload = async () => {
    let activeTopicBtn = document.querySelector('.topic-btn.active');
    if (!activeTopicBtn) {
        activeTopicBtn = document.querySelector('.topic-btn');
        if (activeTopicBtn) activeTopicBtn.classList.add('active');
    }
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
            
            if (!currentUser.name) {
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
        let stars = "⭐".repeat(d);
        html += `<button class="diff-btn ${currentDifficulty == d ? 'active' : ''}" onclick="filterDifficulty(${d})">${stars}</button>`;
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
    
    if (input === ADMIN_KEY) { 
        isAdmin = true; 
        currentUser = { name: "Administrator", className: "ADMIN", classNo: "00" }; 
        loginSuccess(); 
        return; 
    }
    
    btn.disabled = true; btn.innerText = "驗證中...";
    try {
        const resp = await fetch(`${SCRIPT_URL}?name=${encodeURIComponent(input)}`);
        const result = await resp.json();
        if (result.status === "success") { 
            currentUser = { id: result.id, name: result.name, className: result.className, classNo: result.classNo };
            loginSuccess(); 
        } else { 
            err.innerText = "⚠️ 找不到該學號或未授權"; 
            btn.disabled = false; btn.innerText = "進入系統"; 
        }
    } catch (e) { 
        err.innerText = "⚠️ 連線失敗"; 
        btn.disabled = false; btn.innerText = "進入系統";
    }
}

function loginSuccess() {
    document.getElementById('auth-overlay').classList.remove('active');
    let displayStr = isAdmin ? currentUser.name : `${currentUser.className} (${currentUser.classNo}) ${currentUser.name}`;
    if(currentUser.className === "未知班別" || !currentUser.className) displayStr = currentUser.name;
    document.getElementById('user-name-tag').innerText = displayStr;
    const badge = document.getElementById('status-badge');
    if (isAdmin) { badge.innerText = "ADMIN 模式"; badge.classList.add('admin'); }
    else { badge.innerText = "已連線雲端"; }
    render();
}

function render() {
    if (filteredData.length === 0) {
        document.getElementById('q-text').innerText = "此難度下暫無題目。";
        document.getElementById('options-container').innerHTML = "";
        return;
    }
    hasAnswered = false;
    document.getElementById('explain-btn').disabled = !isAdmin;
    document.getElementById('explain-btn').innerText = isAdmin ? "📖 查看詳解" : "📖 答題後解鎖";
    const q = filteredData[currentIdx];
    document.getElementById('q-meta').innerText = q.id;
    
    // 【加入換行支援與強制 \displaystyle 轉換】
    let safeQuestionText = String(q.text).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    if (safeQuestionText.includes('\\frac')) {
         safeQuestionText = safeQuestionText.replace(/\\frac/g, '\\displaystyle \\frac');
    }
    document.getElementById('q-text').innerHTML = safeQuestionText;
    
    document.getElementById('progress-tag').innerText = `${currentIdx + 1} / ${filteredData.length}`;
    const diffNum = parseInt(q.difficulty);
    document.getElementById('q-diff-display').innerText = (!isNaN(diffNum) && diffNum > 0) ? "⭐".repeat(diffNum) : "";
    
    const container = document.getElementById('options-container');
    container.innerHTML = "";
    
    q.options.forEach((opt, i) => {
        const div = document.createElement('div');
        // 【加入換行支援與強制 \displaystyle 轉換】
        let displayOpt = String(opt).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        
        if (displayOpt.includes('\\frac')) {
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

function checkAnswer(idx, el) {
    if (hasAnswered && !isAdmin) return;
    const q = filteredData[currentIdx];
    const isCorrect = (idx === q.ans);
    document.querySelectorAll('.option').forEach(o => o.classList.remove('correct', 'wrong'));
    el.classList.add(isCorrect ? 'correct' : 'wrong');
    
    if (!hasAnswered) {
        hasAnswered = true;
        document.getElementById('explain-btn').disabled = false;
        document.getElementById('explain-btn').innerText = "📖 查看詳解";
        if (!isAdmin) {
            const params = new URLSearchParams({ 
                action: "submitPractice", // 標記為練習
                studentName: currentUser.name, 
                className: currentUser.className, 
                classNo: currentUser.classNo,     
                qId: q.id, 
                choice: ['A','B','C','D'][idx], 
                status: isCorrect ? "正確" : "錯誤",
                topic: q.topic,
                difficulty: q.difficulty
            });
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
    
    // 保持你原本的標題邏輯
    document.getElementById('modal-title').innerText = type === 'hint' ? "💡 提示 (Hint)" : "📖 答案詳解 (Explanation)";
    
    let rawText = type === 'hint' ? (q.hint || "") : (q.explain || "");
    
    // 移除可能存在的 span 標籤
    rawText = String(rawText).replace(/<span[^>]*>/gi, '').replace(/<\/span>/gi, '');
    
    // 安全過濾 < > 符號
    let safeContent = rawText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // 【核心修正】保持你原本的 quiz-hint Class，但加上 white-space: pre-wrap 支援隔行
    let finalHTML = type === 'hint' 
        ? `<div class="quiz-hint" style="white-space: pre-wrap; text-align: left; line-height: 1.6;">${safeContent}</div>` 
        : `<div style="white-space: pre-wrap; text-align: left; line-height: 1.6;">${safeContent}</div>`;
    
    document.getElementById('modal-body').innerHTML = finalHTML;
    document.getElementById('modal').classList.add('active');
    
    // 確保數學公式依然能跑
    if (window.MathJax) MathJax.typesetPromise([document.getElementById('modal-body')]);
}
