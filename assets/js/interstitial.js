/**
 * CONTACT ROUTER & INTERSTITIAL ENGINE
 * Адаптивное подтверждение связи: индивидуальный сценарий для Telegram и Email,
 * копирование адреса в буфер в один клик и бесшовное управление визиткой.
 */
(function() {
  'use strict';

  const overlay = document.getElementById('redirectModalWrap');
  const tagEl = document.getElementById('redirectTagText');
  const titleEl = document.getElementById('redirectTitle');
  const descEl = document.getElementById('redirectDesc');
  const labelEl = document.getElementById('redirectUrlLabel');
  const targetUrlEl = document.getElementById('redirectTargetUrl');
  const copyHintEl = document.getElementById('redirectCopyHint');
  const btnConfirm = document.getElementById('btnRedirectConfirm');
  const btnCancel = document.getElementById('btnRedirectCancel');
  const btnClose = document.getElementById('btnRedirectClose');

  let pendingUrl = null;
  let copyValue = null;
  let lastActiveElement = null;

  if (!overlay || !btnConfirm || !btnCancel) return;

  /**
   * Сценарии текстов для разных каналов связи
   */
  const CHANNELS = {
    telegram: {
      tag: 'МЕССЕНДЖЕР // СВЯЗЬ',
      title: 'Написать в Telegram',
      desc: 'Откроется диалог в Telegram для быстрого обсуждения задачи. Обычно отвечаю в течение пары часов.',
      label: 'Прямой контакт:',
      display: '@LoftCreator',
      copyText: 'https://t.me/LoftCreator',
      confirmBtn: 'Открыть диалог ↗'
    },
    email: {
      tag: 'ПОЧТА // ТЗ И ДОКУМЕНТЫ',
      title: 'Написать на электронную почту',
      desc: 'Подходит для отправки ТЗ, схем и документации. Запустится ваша почтовая программа или вы можете скопировать адрес.',
      label: 'Email для связи (нажмите, чтобы скопировать):',
      display: 'dev@vladimir-gordeev.ru',
      copyText: 'dev@vladimir-gordeev.ru',
      confirmBtn: 'Запустить почту'
    },
    default: {
      tag: 'ВНЕШНЯЯ ССЫЛКА',
      title: 'Переход по ссылке',
      desc: 'Страница откроется в новой вкладке.',
      label: 'Адрес назначения:',
      display: '',
      copyText: '',
      confirmBtn: 'Продолжить ↗'
    }
  };

  /**
   * Показ диалога
   */
  function showModal(url, triggerEl) {
    pendingUrl = url;
    lastActiveElement = triggerEl;

    // Определяем канал связи
    let config;
    if (url.includes('t.me')) {
      config = CHANNELS.telegram;
      copyValue = config.copyText;
    } else if (url.startsWith('mailto:')) {
      config = CHANNELS.email;
      copyValue = config.copyText;
    } else {
      config = { ...CHANNELS.default, display: url, copyText: url };
      copyValue = url;
    }

    // Заполняем интерфейс выверенными текстами
    tagEl.textContent = config.tag;
    titleEl.textContent = config.title;
    descEl.textContent = config.desc;
    labelEl.textContent = config.label;
    targetUrlEl.textContent = config.display;
    btnConfirm.textContent = config.confirmBtn;

    if (copyHintEl) {
      copyHintEl.textContent = 'кликните, чтобы скопировать';
      copyHintEl.classList.remove('copied');
    }

    // 1. Сворачиваем карточку инженера
    if (window.workshopCard && typeof window.workshopCard.minimize === 'function') {
      window.workshopCard.minimize();
    }

    // 2. Открываем окно связи
    overlay.removeAttribute('hidden');
    overlay.classList.add('active');
    document.body.classList.add('interstitial-open');

    // 3. Устанавливаем фокус на главное действие
    requestAnimationFrame(() => {
      btnConfirm.focus();
    });
  }

  /**
   * Скрытие диалога
   */
  function hideModal(restoreCard = true) {
    overlay.classList.remove('active');
    overlay.setAttribute('hidden', '');
    document.body.classList.remove('interstitial-open');
    pendingUrl = null;

    if (restoreCard && window.workshopCard && typeof window.workshopCard.expand === 'function') {
      window.workshopCard.expand();
    } else if (lastActiveElement) {
      lastActiveElement.focus();
    }
  }

  /**
   * Подтверждение действия
   */
  function handleConfirm() {
    if (!pendingUrl) return;

    const url = pendingUrl;
    hideModal(false);

    if (url.startsWith('mailto:')) {
      window.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Копирование контакта при клике по плашке адреса
   */
  function copyToClipboard() {
    if (!copyValue || !navigator.clipboard) return;

    navigator.clipboard.writeText(copyValue).then(() => {
      if (copyHintEl) {
        copyHintEl.textContent = '✓ скопировано в буфер';
        copyHintEl.classList.add('copied');
        setTimeout(() => {
          copyHintEl.textContent = 'кликните, чтобы скопировать';
          copyHintEl.classList.remove('copied');
        }, 2500);
      }
    }).catch(() => {});
  }

  // Слушатели событий клика
  document.addEventListener('click', function(e) {
    const trigger = e.target.closest('.btn-contact, [data-confirm-redirect]');
    if (!trigger) return;

    const href = trigger.getAttribute('href');
    if (!href || href.startsWith('#')) return;

    e.preventDefault();
    showModal(href, trigger);
  });

  btnConfirm.addEventListener('click', handleConfirm);
  btnCancel.addEventListener('click', () => hideModal(true));
  if (btnClose) btnClose.addEventListener('click', () => hideModal(true));

  // Клик по полю адреса копирует его
  if (targetUrlEl) {
    targetUrlEl.parentElement.addEventListener('click', copyToClipboard);
  }

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) hideModal(true);
  });

  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      e.stopPropagation();
      hideModal(true);
    }
  });

  // Изоляция от 3D-сцены
  ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'wheel', 'pointerdown'].forEach(function(evt) {
    overlay.addEventListener(evt, function(e) {
      e.stopPropagation();
    });
  });
})();