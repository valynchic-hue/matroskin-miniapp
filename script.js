(function() {
    'use strict';

    // ============================================================
    //  ИНИЦИАЛИЗАЦИЯ VK BRIDGE
    // ============================================================
    let vkBridge = null;
    let isVKApp = false;

    // Проверяем, запущено ли приложение внутри ВК
    try {
        if (typeof window.VK !== 'undefined' && window.VK && window.VK.init) {
            window.VK.init({ apiId: 0 }); // ID приложения подставится автоматически
            isVKApp = true;
            console.log('✅ VK Bridge инициализирован');
            
            // Показываем версию
            document.getElementById('vkVersion').textContent = 'VK Mini App v1.0';
        }
    } catch(e) {
        console.log('ℹ️ Приложение запущено вне ВКонтакте');
        document.getElementById('vkVersion').textContent = 'Web версия';
    }

    // ============================================================
    //  ХРАНИЛИЩЕ (localStorage)
    // ============================================================
    function loadSettings() {
        try {
            const raw = localStorage.getItem('matroskin_settings');
            if (raw) {
                const data = JSON.parse(raw);
                return {
                    winScore: data.winScore || 20,
                    gameDuration: data.gameDuration || 30,
                    matroskinSpeed: data.matroskinSpeed || 'medium',
                };
            }
        } catch (_) {}
        return { winScore: 20, gameDuration: 30, matroskinSpeed: 'medium' };
    }

    function saveSettings(settings) {
        localStorage.setItem('matroskin_settings', JSON.stringify(settings));
    }

    function loadHistory() {
        try {
            const raw = localStorage.getItem('matroskin_history');
            if (raw) {
                return JSON.parse(raw);
            }
        } catch (_) {}
        return [];
    }

    function saveHistory(history) {
        localStorage.setItem('matroskin_history', JSON.stringify(history));
    }

    // ============================================================
    //  СОСТОЯНИЕ
    // ============================================================
    let settings = loadSettings();
    let history = loadHistory();

    let humanScore = 0;
    let matroskinScore = 0;
    let gameActive = false;
    let gameEnded = false;
    let timer = null;
    let matroskinTimer = null;

    // ============================================================
    //  DOM
    // ============================================================
    const humanProgress = document.getElementById('humanProgress');
    const matroskinProgress = document.getElementById('matroskinProgress');
    const humanScoreDisplay = document.getElementById('humanScoreDisplay');
    const matroskinScoreDisplay = document.getElementById('matroskinScoreDisplay');
    const statusEl = document.getElementById('statusMessage');
    const milkBtn = document.getElementById('milkBtn');
    const resetBtn = document.getElementById('resetBtn');
    const shareBtn = document.getElementById('shareBtn');
    const closeBtn = document.getElementById('closeApp');

    const winScoreSlider = document.getElementById('winScoreSlider');
    const winScoreLabel = document.getElementById('winScoreLabel');
    const gameDurationSlider = document.getElementById('gameDurationSlider');
    const gameDurationLabel = document.getElementById('gameDurationLabel');
    const matroskinSpeedSelect = document.getElementById('matroskinSpeed');

    const totalWinsBadge = document.getElementById('totalWinsBadge');

    // ============================================================
    //  ФУНКЦИИ
    // ============================================================
    function getMatroskinInterval() {
        const map = {
            'slow': 600,
            'medium': 380,
            'fast': 250,
            'insane': 150,
        };
        return map[settings.matroskinSpeed] || 380;
    }

    function updateUI() {
        const win = settings.winScore;
        const humanPct = Math.min((humanScore / win) * 100, 100);
        const matroskinPct = Math.min((matroskinScore / win) * 100, 100);

        humanProgress.style.width = humanPct + '%';
        humanProgress.textContent = Math.round(humanPct) + '%';
        matroskinProgress.style.width = matroskinPct + '%';
        matroskinProgress.textContent = Math.round(matroskinPct) + '%';

        humanScoreDisplay.textContent = humanScore + ' л';
        matroskinScoreDisplay.textContent = matroskinScore + ' л';
    }

    function updateStatsUI() {
        const wins = history.filter(h => h.result === 'win').length;
        const losses = history.filter(h => h.result === 'loss').length;
        const draws = history.filter(h => h.result === 'draw').length;

        document.getElementById('statWins').textContent = wins;
        document.getElementById('statLosses').textContent = losses;
        document.getElementById('statDraws').textContent = draws;
        document.getElementById('statTotal').textContent = history.length;

        totalWinsBadge.textContent = wins;

        const list = document.getElementById('historyList');
        if (history.length === 0) {
            list.innerHTML = '<div style="color:#b0987a; text-align:center; padding:20px 0;">Пока нет сыгранных игр 😴</div>';
            return;
        }

        const items = history.slice().reverse().map(h => {
            const date = new Date(h.timestamp);
            const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            const resultMap = {
                'win': '🏆 Победа',
                'loss': '😿 Поражение',
                'draw': '🤝 Ничья'
            };
            const cls = h.result;
            return `<div class="history-item">
                <span>${dateStr}</span>
                <span class="result ${cls}">${resultMap[h.result] || h.result}</span>
            </div>`;
        }).join('');
        list.innerHTML = items;
    }

    function updateSettingsUI() {
        winScoreSlider.value = settings.winScore;
        winScoreLabel.textContent = settings.winScore;
        gameDurationSlider.value = settings.gameDuration;
        gameDurationLabel.textContent = settings.gameDuration;
        matroskinSpeedSelect.value = settings.matroskinSpeed;
    }

    function stopAllTimers() {
        if (timer) { clearTimeout(timer); timer = null; }
        if (matroskinTimer) { clearInterval(matroskinTimer); matroskinTimer = null; }
    }

    function endGame(result) {
        if (gameEnded) return;
        gameEnded = true;
        gameActive = false;
        milkBtn.disabled = true;
        stopAllTimers();

        history.push({
            result: result,
            timestamp: Date.now(),
            humanScore: humanScore,
            matroskinScore: matroskinScore,
        });
        saveHistory(history);
        updateStatsUI();

        const messages = {
            'win': '🏆 Ты победил! Матроскин в шоке! 🐮',
            'loss': '😹 Матроскин победил! Он наполнил бидон быстрее!',
            'draw': '🤝 Ничья! Вы оба молодцы!'
        };
        statusEl.innerHTML = messages[result] || 'Игра завершена!';
        
        // Показываем кнопку "Поделиться" после окончания игры
        shareBtn.style.display = 'block';
    }

    function checkWin() {
        const win = settings.winScore;
        if (humanScore >= win) {
            endGame('win');
            return true;
        } else if (matroskinScore >= win) {
            endGame('loss');
            return true;
        }
        return false;
    }

    function humanAddMilk() {
        if (!gameActive || gameEnded) return;
        if (humanScore >= settings.winScore) return;
        humanScore += 1;
        updateUI();
        checkWin();
    }

    function matroskinAddMilk() {
        if (!gameActive || gameEnded) return;
        if (matroskinScore >= settings.winScore) return;
        matroskinScore += 1;
        updateUI();
        checkWin();
    }

    function startGame() {
        humanScore = 0;
        matroskinScore = 0;
        gameEnded = false;
        gameActive = true;
        milkBtn.disabled = false;
        shareBtn.style.display = 'none';
        updateUI();

        statusEl.innerHTML = '⚡ Идёт битва за молоко! Кликай быстрее!';
        stopAllTimers();

        const interval = getMatroskinInterval();
        matroskinTimer = setInterval(matroskinAddMilk, interval);

        timer = setTimeout(() => {
            if (gameEnded) return;
            gameActive = false;
            milkBtn.disabled = true;
            stopAllTimers();

            let result;
            if (humanScore > matroskinScore) {
                result = 'win';
                statusEl.innerHTML = '⏰ Время вышло! Ты налил больше молока! Победа! 🥇';
            } else if (matroskinScore > humanScore) {
                result = 'loss';
                statusEl.innerHTML = '⏰ Время вышло! Матроскин налил больше... Попробуй снова! 😼';
            } else {
                result = 'draw';
                statusEl.innerHTML = '⏰ Время вышло! У вас ничья! 🤝';
            }
            gameEnded = true;
            shareBtn.style.display = 'block';

            history.push({
                result: result,
                timestamp: Date.now(),
                humanScore: humanScore,
                matroskinScore: matroskinScore,
            });
            saveHistory(history);
            updateStatsUI();
        }, settings.gameDuration * 1000);
    }

    function resetGame() {
        stopAllTimers();
        gameActive = false;
        gameEnded = true;
        milkBtn.disabled = true;
        shareBtn.style.display = 'none';
        humanScore = 0;
        matroskinScore = 0;
        updateUI();
        statusEl.innerHTML = '🔄 Нажми «Налить молоко», чтобы начать новый челлендж!';
        gameEnded = false;
    }

    // ============================================================
    //  ФУНКЦИЯ ПОДЕЛИТЬСЯ (VK API)
    // ============================================================
    function shareResult() {
        const wins = history.filter(h => h.result === 'win').length;
        const total = history.length;
        const message = `🐄 Я сыграл ${total} игр с Матроскиным и победил ${wins} раз! А ты сможешь лучше? 🏆\n\nПопробуй сам: [ссылка на приложение]`;
        
        if (isVKApp && window.VK && window.VK.Widgets) {
            // ВКонтакте — используем VK API
            try {
                window.VK.Widgets.OpenApp('', {
                    text: message,
                    hash: 'matroskin_challenge'
                });
            } catch(e) {
                // Если не сработало — используем стандартный share
                shareViaNavigator(message);
            }
        } else {
            // Обычный браузер — используем Web Share API
            shareViaNavigator(message);
        }
    }

    function shareViaNavigator(message) {
        if (navigator.share) {
            navigator.share({
                title: 'Челлендж с Матроскиным',
                text: message,
                url: window.location.href,
            }).catch(() => {});
        } else {
            // Fallback: копируем в буфер обмена
            navigator.clipboard.writeText(message + ' ' + window.location.href)
                .then(() => alert('📋 Ссылка и текст скопированы! Поделись с друзьями!'))
                .catch(() => alert('📤 Поделись результатом с друзьями!'));
        }
    }

    // ============================================================
    //  ОБРАБОТЧИКИ
    // ============================================================
    milkBtn.addEventListener('click', function() {
        if (gameEnded) {
            resetGame();
            startGame();
            humanAddMilk();
            return;
        }
        if (!gameActive) {
            startGame();
            humanAddMilk();
        } else {
            humanAddMilk();
        }
    });

    resetBtn.addEventListener('click', function() {
        resetGame();
        statusEl.innerHTML = '🔄 Готово. Нажми «Налить молоко» для старта!';
    });

    shareBtn.addEventListener('click', shareResult);

    closeBtn.addEventListener('click', function() {
        if (isVKApp && window.VK && window.VK.Widgets) {
            try {
                window.VK.Widgets.CloseApp();
            } catch(e) {
                window.close();
            }
        } else {
            window.close();
        }
    });

    // ============================================================
    //  НАСТРОЙКИ
    // ============================================================
    winScoreSlider.addEventListener('input', function() {
        settings.winScore = parseInt(this.value);
        winScoreLabel.textContent = settings.winScore;
        saveSettings(settings);
        if (!gameActive && !gameEnded) {
            updateUI();
        }
    });

    gameDurationSlider.addEventListener('input', function() {
        settings.gameDuration = parseInt(this.value);
        gameDurationLabel.textContent = settings.gameDuration;
        saveSettings(settings);
    });

    matroskinSpeedSelect.addEventListener('change', function() {
        settings.matroskinSpeed = this.value;
        saveSettings(settings);
    });

    document.getElementById('clearHistoryBtn').addEventListener('click', function() {
        if (confirm('🗑️ Очистить всю историю игр?')) {
            history = [];
            saveHistory(history);
            updateStatsUI();
        }
    });

    // ============================================================
    //  ВКЛАДКИ
    // ============================================================
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const pageId = 'page-' + this.dataset.tab;
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(pageId).classList.add('active');

            if (this.dataset.tab === 'stats') {
                updateStatsUI();
            }
            if (this.dataset.tab === 'settings') {
                updateSettingsUI();
            }
        });
    });

    // ============================================================
    //  ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    resetGame();
    updateStatsUI();
    updateSettingsUI();
    updateUI();
    shareBtn.style.display = 'none';

    console.log('🐄 Простоквашино Челленджи v2.0 (VK Mini App) загружены!');
    console.log('📊 Всего игр в истории:', history.length);
    console.log('⚙️ Настройки:', settings);
})();
