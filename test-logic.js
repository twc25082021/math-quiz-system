/* test-logic.js (課堂測驗專屬：支援計時、全卷提交、rawScore回傳與分數放大) */

let studentInfo = {}, testData = [], originalTestData = [], testName = "", currentIdx = 0, isAdmin = false;
let testPasscode = "1234", timerInterval = null, timeLeft = 0, isReviewMode = false;

async function handleAuth() {
    const input = document.getElementById('input-name').value.trim();
    if (!input) return;
    if (input === ADMIN_KEY) {
        isAdmin = true;
        studentInfo = { name: "管理員", className: "ADMIN", classNo: "00" };
        document.querySelectorAll('.btn-admin').forEach(b => b.classList.remove('hidden'));
        showCodeOverlay();
        return;
    }
    try {
        const r = await fetch(`${SCRIPT_URL}?name=${encodeURIComponent(input)}`);
        const res = await r.json();
        if (res.status === "success") { studentInfo = res; showCodeOverlay(); } 
        else { document.getElementById('auth-error').innerText = "⚠️ 找不到該學生編號"; }
    } catch (e) { document.getElementById('auth-error').innerText = "連線失敗"; }
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
            
            let processed = res.data.map((q, qIndex) => {
                let opts = q.options.map((text, oIdx) => ({ text: text, originalIdx: oIdx }));
                for (let i = opts.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [opts[i], opts[j]] = [opts[j], opts[i]];
                }
                return { ...q, displayOptions: opts, userAns: null, originalIndex: qIndex }; 
            });

            originalTestData = [...processed].sort((a, b) => a.originalIndex - b.originalIndex);
            testData = [...processed];
            for (let i = testData.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [testData[i], testData[j]] = [testData[j], testData[i]];
            }

            document.getElementById('test-name-tag').innerText = testName;
            document.getElementById('code-overlay').classList.add('hidden');
            document.getElementById('test-footer').classList.remove('hidden');
            document.getElementById('top-nav').classList.remove('hidden');
            
            if (res.duration > 0 && !isAdmin) {
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
            cls += (q.userAns === q.ans) ? " res-ok" : " res-no";
        } else if (q.userAns !== null) cls += " answered";
        
        btn.className = cls;
        btn.innerText = i + 1;
        btn.onclick = () => { currentIdx = i; renderQuestion(); };
        nav.appendChild(btn);
        
        if (i === currentIdx) {
            setTimeout(() => {
                btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }, 50);
        }
    });
}

function renderQuestion() {
    if (!testData[currentIdx]) return;
    const q = testData[currentIdx];
    document.getElementById('warning-msg').innerText = ""; 
    document.getElementById('progress-tag').innerText = `${currentIdx + 1} / ${testData.length}`;
    
    let metaText = isReviewMode ? `題號: ${q.id} (檢閱中)` : "測驗進行中";
    if (isReviewMode && q.userAns === null) metaText += ` <span style="color:var(--wrong); margin-left:10px;">[ 未作答 ]</span>`;
    document.getElementById('q-meta').innerHTML = metaText;
    
    // 【處理題目換行與 \displaystyle】
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
            else if (q.userAns === opt.originalIdx) status = "wrong"; 
        } else if (q.userAns === opt.originalIdx) status = "selected";
        
        div.className = `option ${status}`;
        
        // 【處理選項換行與 \displaystyle】
        let displayOpt = String(opt.text).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        let hasFraction = false;
        if (displayOpt.includes('\\frac')) {
            displayOpt = displayOpt.replace(/\\frac/g, '\\displaystyle \\frac');
            hasFraction = true;
        }

        div.innerHTML = `<span style="color:var(--disabled); margin-right:15px; font-style:italic;">${['A','B','C','D'][i]}.</span> <span style="font-family:'Times New Roman', serif; font-weight:bold; font-style:italic; line-height: 1.5;">${displayOpt}</span>`;
        
        // 【套用分數加大樣式】
        if (hasFraction) div.classList.add('has-fraction');

        if (!isReviewMode) div.onclick = () => { q.userAns = opt.originalIdx; renderQuestion(); };
        container.appendChild(div);
    });

    const nextBtn = document.getElementById('next-btn');
    if (currentIdx === testData.length - 1) {
        nextBtn.innerHTML = isReviewMode ? '結束檢閱' : '📤 提交測驗';
    } else {
        nextBtn.innerHTML = '下一題 <i class="fa-solid fa-chevron-right"></i>';
    }

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
    if (!isReviewMode && testData[currentIdx].userAns === null && !isAdmin) {
        document.getElementById('warning-msg').innerText = "⚠️ 請先選擇答案！"; return;
    }
    if (currentIdx < testData.length - 1) { currentIdx++; renderQuestion(); } 
    else if (!isReviewMode) submitTest();
}

function submitTest(isAuto = false) {
    clearInterval(timerInterval);
    document.getElementById('next-btn').disabled = true;
    document.getElementById('next-btn').innerText = "上傳中...";
    
    let details = [], correct = 0;
    const sorted = [...testData].sort((a, b) => a.originalIndex - b.originalIndex);
    sorted.forEach(q => {
        const ok = (q.userAns === q.ans);
        if (ok) correct++;
        details.push(`${q.id} (${ok ? "✓" : "✗"})`);
    });

    const score = `${correct} / ${testData.length}`;
    if (!isAdmin) {
        const params = new URLSearchParams({
            action: "submitTest", 
            name: studentInfo.name, 
            className: studentInfo.className,
            classNo: studentInfo.classNo, 
            testName: testName, 
            score: score, 
            rawScore: correct, // 【確保上傳純分子】
            details: JSON.stringify(details)
        });
        fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: params });
    }
    if (isAuto) alert("⏰ 時間到！系統已自動提交答案。");
    showPasscodeOverlay(score);
}

function showPasscodeOverlay(score) {
    document.getElementById('test-footer').classList.add('hidden');
    document.getElementById('timer-display').classList.add('hidden');
    document.getElementById('top-nav').classList.add('hidden'); 
    
    document.getElementById('main-display').innerHTML = `
        <div class="card" style="text-align:center;">
            <h2 style="color:var(--correct)">✅ 測驗完成</h2>
            <p>請輸入解鎖碼查看檢閱結果</p>
            <input type="password" id="input-passcode" class="auth-input" placeholder="解鎖碼" style="border:2px solid #E2E8F0; width: 80%;">
            <button class="btn btn-main" style="width:80%; margin:15px auto;" onclick="verifyPasscode()">🔓 解鎖並檢閱</button>
            <div id="passcode-error" style="color:var(--wrong); font-weight:bold;"></div>
        </div>
    `;
}

function verifyPasscode() {
    const code = document.getElementById('input-passcode').value.trim();
    if (code === testPasscode || code === ADMIN_KEY) { 
        isReviewMode = true;
        testData = originalTestData; 
        currentIdx = 0;
        document.getElementById('next-btn').disabled = false;
        document.getElementById('main-display').innerHTML = `
            <div class="card">
                <div id="q-meta" style="color:var(--disabled); font-size:0.8rem; margin-bottom:10px;">題號: --</div>
                <div id="q-text" style="font-size:1.1rem; font-weight:bold; margin-bottom:20px;">載入中...</div>
                <div id="options-container"></div>
                <div id="warning-msg" style="color:var(--wrong); font-weight:bold; text-align:center; margin-top:10px; min-height:20px; font-size:0.9rem;"></div>
            </div>
        `;
        document.getElementById('test-footer').classList.remove('hidden');
        document.getElementById('top-nav').classList.remove('hidden'); 
        renderQuestion();
    } else {
        document.getElementById('passcode-error').innerText = "❌ 解鎖碼錯誤";
    }
}

function openModal(type) {
    const q = testData[currentIdx];
    const modal = document.createElement('div');
    modal.style = "position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9000; display:flex; align-items:center; justify-content:center; padding:20px;";
    modal.innerHTML = `
        <div style="background:white; width:100%; max-width:500px; border-radius:20px; padding:25px; max-height:80vh; overflow-y:auto;">
            <h3 style="margin-top:0;">${type==='hint'?'💡 提示':'📖 詳解'}</h3>
            <div style="margin:20px 0; line-height:1.6;">${String(type==='hint'?q.hint:q.explain).replace(/\n/g,'<br>')}</div>
            <button class="btn btn-sub" style="width:100%" onclick="this.parentElement.parentElement.remove()">關閉</button>
        </div>
    `;
    document.body.appendChild(modal);
    if (window.MathJax) MathJax.typesetPromise([modal]);
}
