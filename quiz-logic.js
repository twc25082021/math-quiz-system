/* quiz-logic.js (保留原始邏輯 + 分數放大 + 隔行支援) */

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
    
    // 【加入強制 \displaystyle 轉換，保留原本的 <br> 邏輯】
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
        
        let displayOpt = String(opt).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        
        // 【處理選項的分數放大】
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
                action: "submitPractice", 
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
    document.getElementById('modal-title').innerText = type === 'hint' ? "💡 提示 (Hint)" : "📖 答案詳解 (Explanation)";
    
    // 1. 取得原始文字
    let rawText = type === 'hint' ? (q.hint || "無提示") : (q.explain || "無詳解");
    
    // 2. 清除可能殘留的 HTML，並將字串的 \n 轉為真實換行符號
    let safeContent = String(rawText).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    safeContent = safeContent.replace(/\\n/g, '\n'); 
    
    // 3. 【核心修復：聰明換行器，絕對保護 MathJax 的 $ 符號】
    let parts = safeContent.split('$');
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 1) { 
            // 這是 $ ... $ 裡面的數學公式
            // 遇到換行時：關閉公式 -> 換行 -> 重新開啟公式
            parts[i] = parts[i].replace(/\n/g, '$<br>$');
        } else {
            // 這是普通的文字，直接換行
            parts[i] = parts[i].replace(/\n/g, '<br>');
        }
    }
    // 把處理好的段落重新用 $ 拼回去
    safeContent = parts.join('$');
    
    // 4. 渲染到畫面上
    let finalHTML = type === 'hint' 
        ? `<div class="quiz-hint" style="text-align: left; line-height: 1.6;">${safeContent}</div>` 
        : `<div style="text-align: left; line-height: 1.6;">${safeContent}</div>`;
        
    document.getElementById('modal-body').innerHTML = finalHTML;
    document.getElementById('modal').classList.add('active');
    
    if (window.MathJax) MathJax.typesetPromise([document.getElementById('modal-body')]);
}
function closeModal() { 
    document.getElementById('modal').classList.remove('active'); 
}

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
