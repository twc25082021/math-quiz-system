/* test-logic.js (更新：管理員直入檢閱模式、明碼輸入、允許跳題) */

let studentInfo = {}, testData = [], originalTestData = [], testName = "", currentIdx = 0, isAdmin = false;
let testPasscode = "1234", timerInterval = null, timeLeft = 0, isReviewMode = false;
let testScore = ""; 

async function handleAuth() {
    const input = document.getElementById('input-name').value.trim();
    if (!input) return;
    
    // 管理員登入邏輯
    if (input === ADMIN_KEY) {
        isAdmin = true;
        studentInfo = { name: "老師 (管理員)", className: "STAFF", classNo: "00" };
        showCodeOverlay();
        return;
    }

    try {
        const r = await fetch(`${SCRIPT_URL}?name=${encodeURIComponent(input)}`);
        const res = await r.json();
        if (res.status === "success") { 
            studentInfo = res; 
            showCodeOverlay(); 
        } else { 
            document.getElementById('auth-error').innerText = "⚠️ 找不到該學生編號"; 
        }
    } catch (e) { 
        document.getElementById('auth-error').innerText = "連線失敗"; 
    }
}

function showCodeOverlay() {
    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('code-overlay').classList.remove('hidden');
    document.getElementById('welcome-msg').innerText = `你好，${studentInfo.name}`;
    document.getElementById('user-info-tag').innerText = `${studentInfo.className} (${studentInfo.classNo}) ${studentInfo.name}`;
}

async function fetchTest() {
    const code = document.getElementById('input-code').value.trim();
    if (!code) return;
    const btn = document.querySelector('#code-overlay .btn-main');
    btn.innerText = "讀取中...";
    btn.disabled = true;

    try {
        const r = await fetch(`${SCRIPT_URL}?action=getTestQuestions&testCode=${encodeURIComponent(code)}`);
        const res = await r.json();
        if (res.status === "success") {
            testPasscode = res.passcode || "1234";
            testName = res.testName;
            
            // 處理題目數據
            let processed = res.data.map((q, qIndex) => {
                let opts = q.options.map((text, oIdx) => ({ text: text, originalIdx: oIdx }));
                // 學生才打亂選項，管理員對卷不打亂
                if (!isAdmin) {
                    for (let i = opts.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [opts[i], opts[j]] = [opts[j], opts[i]];
                    }
                }
                return { ...q, displayOptions: opts, userAns: null, originalIndex: qIndex }; 
            });

            originalTestData = [...processed].sort((a, b) => a.originalIndex - b.originalIndex);
            
            // 介面初始化
            document.getElementById('test-name-tag').innerText = testName;
            document.getElementById('code-overlay').classList.add('hidden');
            document.getElementById('test-footer').classList.remove('hidden');
            document.getElementById('top-nav').classList.remove('hidden');

            // --- 核心改動：管理員直跳檢閱模式 ---
            if (isAdmin) {
                isReviewMode = true;
                testData = [...originalTestData]; // 管理員使用原始順序
                testScore = "管理員模式";
                renderQuestion();
                return; 
            }

            // 學生模式：打亂題目順序並開始計時
            testData = [...processed];
            for (let i = testData.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [testData[i], testData[j]] = [testData[j], testData[i]];
            }
            
            if (res.duration > 0) {
                timeLeft = res.duration * 60;
                document.getElementById('timer-display').classList.remove('hidden');
                startTimer();
            }
            renderQuestion();
        } else { 
            document.getElementById('code-error').innerText = "⚠️ 代碼錯誤";
            btn.disabled = false; btn.innerText = "開始測驗";
        }
    } catch (e) { 
        document.getElementById('code-error').innerText = "下載失敗"; 
        btn.disabled = false; btn.innerText = "開始測驗";
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        let m = Math.floor(timeLeft / 60), s = timeLeft % 60;
        document.getElementById('timer-display').innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        if (timeLeft === 300) alert("⏰ 注意：測驗時間剩餘 5 分鐘！");
        if (timeLeft <= 0) { clearInterval(timerInterval); submitTest(true); }
    }, 1000);
}

function renderTopNav() {
    const nav = document.getElementById('top-nav');
    nav.innerHTML = "";
    testData.forEach((q, i) => {
        const btn = document.createElement('div');
        let cls = "q-btn";
        if (i === currentIdx) cls += " current";
        else if (isReviewMode) {
            if (isAdmin) cls += " answered"; // 管理員模式下全部顯示為已讀
            else cls += (q.userAns === q.ans) ? " res-ok" : " res-no";
        }
        else if (q.userAns !== null) cls += " answered";
        
        btn.className = cls;
        btn.innerText = i + 1;
        btn.onclick = () => { currentIdx = i; renderQuestion(); };
        nav.appendChild(btn);
    });
}

function renderQuestion() {
    if (!testData[currentIdx]) return;
    const q = testData[currentIdx];
    document.getElementById('progress-tag').innerText = `${currentIdx + 1} / ${testData.length}`;
    
    // 頂部資訊
    let metaText = isReviewMode ? `<span style="color:var(--accent); font-weight:bold; margin-right:15px;">${testScore}</span>題號: ${q.id}` : "測驗進行中";
    document.getElementById('q-meta').innerHTML = metaText;
    
    let displayQ = String(q.text).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    if (displayQ.includes('\\frac')) displayQ = displayQ.replace(/\\frac/g, '\\displaystyle \\frac');
    document.getElementById('q-text').innerHTML = displayQ;
    
    const container = document.getElementById('options-container');
    container.innerHTML = "";
    
    q.displayOptions.forEach((opt, i) => {
        const div = document.createElement('div');
        let status = "";
        if (isReviewMode) {
            if (opt.originalIdx === q.ans) status = "correct"; 
            else if (!isAdmin && q.userAns === opt.originalIdx) status = "wrong"; 
        } else if (q.userAns === opt.originalIdx) status = "selected";
        
        div.className = `option ${status}`;
        let displayOpt = String(opt.text).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        if (displayOpt.includes('\\frac')) { 
            displayOpt = displayOpt.replace(/\\frac/g, '\\displaystyle \\frac');
            div.classList.add('has-fraction');
        }

        div.innerHTML = `<span style="color:var(--disabled); margin-right:15px; font-style:italic;">${['A','B','C','D'][i]}.</span> <span>${displayOpt}</span>`;

        if (!isReviewMode) div.onclick = () => { q.userAns = opt.originalIdx; renderQuestion(); };
        container.appendChild(div);
    });

    const nextBtn = document.getElementById('next-btn');
    if (currentIdx === testData.length - 1) nextBtn.innerHTML = isReviewMode ? '結束對卷' : '📤 提交測驗';
    else nextBtn.innerHTML = '下一題 <i class="fa-solid fa-chevron-right"></i>';

    if (isReviewMode) {
        document.getElementById('explain-btn').classList.remove('hidden');
        document.getElementById('hint-btn').classList.remove('hidden');
    }
    renderTopNav();
    if (window.MathJax) MathJax.typesetPromise();
}

function prevQuestion() { if (currentIdx > 0) { currentIdx--; renderQuestion(); } }
function nextQuestion() {
    if (isReviewMode && currentIdx === testData.length - 1) { location.reload(); return; }
    if (currentIdx < testData.length - 1) { currentIdx++; renderQuestion(); } 
    else if (!isReviewMode) submitTest();
}

function submitTest(isAuto = false) {
    clearInterval(timerInterval);
    let details = [], correct = 0;
    testData.forEach(q => { if (q.userAns === q.ans) correct++; });
    testScore = `${correct} / ${testData.length}`;

    if (!isAdmin) {
        const params = new URLSearchParams({
            action: "submitTest", name: studentInfo.name, className: studentInfo.className,
            classNo: studentInfo.classNo, testName: testName, score: testScore
        });
        fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: params });
    }
    if (isAuto) alert("⏰ 時間到！系統已自動提交。");
    showPasscodeOverlay();
}

function showPasscodeOverlay() {
    document.getElementById('test-footer').classList.add('hidden');
    document.getElementById('top-nav').classList.add('hidden'); 
    document.getElementById('main-display').innerHTML = `
        <div class="card" style="text-align:center;">
            <h2 style="color:var(--correct)">✅ 測驗已提交</h2>
            <p>請輸入解鎖碼查看分數與詳解</p>
            <input type="text" id="input-passcode" class="auth-input" placeholder="解鎖碼" style="width:80%;">
            <button class="btn btn-main" style="width:80%; margin:15px auto;" onclick="verifyPasscode()">🔓 解鎖並檢閱</button>
            <div id="passcode-error" style="color:var(--wrong); font-weight:bold;"></div>
        </div>
    `;
}

function verifyPasscode() {
    const code = document.getElementById('input-passcode').value.trim();
    if (code === testPasscode || code === ADMIN_KEY) { 
        isReviewMode = true; testData = originalTestData; currentIdx = 0;
        document.getElementById('main-display').innerHTML = `<div class="card"><div id="q-meta"></div><div id="q-text"></div><div id="options-container"></div></div>`;
        document.getElementById('test-footer').classList.remove('hidden');
        document.getElementById('top-nav').classList.remove('hidden'); 
        renderQuestion();
    } else { document.getElementById('passcode-error').innerText = "❌ 解鎖碼錯誤"; }
}

function openModal(type) {
    const q = testData[currentIdx];
    const modal = document.createElement('div');
    modal.style = "position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9000; display:flex; align-items:center; justify-content:center; padding:20px;";
    
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
            parts[i] = parts[i].replace(/\n/g, '$<br>$');
        } else {
            // 這是普通的文字，直接換行
            parts[i] = parts[i].replace(/\n/g, '<br>');
        }
    }
    safeContent = parts.join('$');

    // 4. 渲染畫面 (注意：移除了無效的 white-space: pre-wrap)
    modal.innerHTML = `
        <div style="background:white; width:100%; max-width:500px; border-radius:20px; padding:25px; max-height:80vh; overflow-y:auto;">
            <h3 style="margin-top:0;">${type==='hint'?'💡 提示':'📖 詳解'}</h3>
            <div style="margin:20px 0; line-height:1.6; word-wrap: break-word; font-size: 1.05rem;">${safeContent}</div>
            <button class="btn btn-sub" style="width:100%" onclick="this.parentElement.parentElement.remove()">關閉</button>
        </div>
    `;
    document.body.appendChild(modal);
    
    if (window.MathJax) MathJax.typesetPromise([modal]);
}
