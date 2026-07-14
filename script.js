(function() {
    'use strict';

    console.log('🚀 Матроскин загружается...');

    // ============================================================
    //  ПРОСТАЯ ВЕРСИЯ (для проверки)
    // ============================================================
    
    // Проверяем, что DOM загружен
    document.addEventListener('DOMContentLoaded', function() {
        console.log('✅ DOM загружен');
        
        // Проверяем наличие элементов
        const milkBtn = document.getElementById('milkBtn');
        const statusEl = document.getElementById('statusMessage');
        
        if (milkBtn && statusEl) {
            console.log('✅ Кнопка и статус найдены');
            statusEl.textContent = '✅ Игра работает! Нажми на кнопку.';
            
            milkBtn.addEventListener('click', function() {
                statusEl.textContent = '🥛 Молоко налито! Счёт: ' + (Math.random() * 10).toFixed(0);
            });
        } else {
            console.error('❌ Элементы не найдены!');
            console.log('milkBtn:', milkBtn);
            console.log('statusEl:', statusEl);
        }
    });

})();
