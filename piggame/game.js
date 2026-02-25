(function () {
  'use strict';

  var gameArea = document.getElementById('gameArea');
  var trailSvg = document.getElementById('trailSvg');
  var trailLine = document.getElementById('trailLine');
  var scoreEl = document.getElementById('score');
  var timerText = document.getElementById('timerText');
  var missText = document.getElementById('missText');
  var startScreen = document.getElementById('startScreen');
  var loadScreen = document.getElementById('loadScreen');
  var btnStart = document.getElementById('btnStart');

  var score = 0;
  var missCount = 0;
  var points = [];
  var isDragging = false;
  var TRAIL_THROTTLE_MS = 30;
  var lastTrailTime = 0;

  var HIT_EFFECT_SRC = 'assets/pig_blood.png';
  var PIG_IMG_SRC = 'assets/pig_full.png';
  var SPAWN_MARGIN = 16;

  // 简单 3s、中等 1.5s、困难 0.8s
  var DIFFICULTY_MS = { easy: 3000, medium: 1500, hard: 800 };
  var difficultyMs = DIFFICULTY_MS.medium;

  var roundTimerId = null;
  var roundTimerIntervalId = null;
  var roundStartTime = 0;

  var currentPigs = []; // { el, alive }
  var roundKills = 0;

  function getGameRect() {
    return gameArea.getBoundingClientRect();
  }

  function getEventXY(e) {
    if (e.clientX != null) return { x: e.clientX, y: e.clientY };
    var t = e.touches && e.touches[0];
    if (t) return { x: t.clientX, y: t.clientY };
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }

  function cross(o, a, b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  function segSegIntersect(a1, a2, b1, b2) {
    var d1 = cross(b1, b2, a1);
    var d2 = cross(b1, b2, a2);
    var d3 = cross(a1, a2, b1);
    var d4 = cross(a1, a2, b2);
    if (d1 * d2 < 0 && d3 * d4 < 0) return true;
    if (d1 === 0 && (a1.x >= Math.min(b1.x, b2.x) && a1.x <= Math.max(b1.x, b2.x) && a1.y >= Math.min(b1.y, b2.y) && a1.y <= Math.max(b1.y, b2.y))) return true;
    if (d2 === 0 && (a2.x >= Math.min(b1.x, b2.x) && a2.x <= Math.max(b1.x, b2.x) && a2.y >= Math.min(b1.y, b2.y) && a2.y <= Math.max(b1.y, b2.y))) return true;
    if (d3 === 0 && (b1.x >= Math.min(a1.x, a2.x) && b1.x <= Math.max(a1.x, a2.x) && b1.y >= Math.min(a1.y, a2.y) && b1.y <= Math.max(a1.y, a2.y))) return true;
    if (d4 === 0 && (b2.x >= Math.min(a1.x, a2.x) && b2.x <= Math.max(a1.x, a2.x) && b2.y >= Math.min(a1.y, a2.y) && b2.y <= Math.max(a1.y, a2.y))) return true;
    return false;
  }

  function pointInRect(x, y, r) {
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function slashHitsRect(pointsArr, rect) {
    if (pointsArr.length < 2) return false;
    var L = rect.left, R = rect.right, T = rect.top, B = rect.bottom;
    for (var i = 0; i < pointsArr.length; i++) {
      if (pointInRect(pointsArr[i].x, pointsArr[i].y, rect)) return true;
    }
    for (var j = 0; j < pointsArr.length - 1; j++) {
      var p1 = pointsArr[j], p2 = pointsArr[j + 1];
      if (segSegIntersect(p1, p2, { x: L, y: T }, { x: R, y: T })) return true;
      if (segSegIntersect(p1, p2, { x: L, y: B }, { x: R, y: B })) return true;
      if (segSegIntersect(p1, p2, { x: L, y: T }, { x: L, y: B })) return true;
      if (segSegIntersect(p1, p2, { x: R, y: T }, { x: R, y: B })) return true;
    }
    return false;
  }

  function clearRoundTimer() {
    if (roundTimerId) {
      clearTimeout(roundTimerId);
      roundTimerId = null;
    }
    if (roundTimerIntervalId) {
      clearInterval(roundTimerIntervalId);
      roundTimerIntervalId = null;
    }
    timerText.textContent = '--';
  }

  function updateTimerDisplay() {
    var elapsed = Date.now() - roundStartTime;
    var remaining = Math.max(0, difficultyMs - elapsed);
    timerText.textContent = (remaining / 1000).toFixed(1) + 's';
  }

  function removeAllPigs() {
    for (var i = 0; i < currentPigs.length; i++) {
      if (currentPigs[i].el.parentNode === gameArea) {
        gameArea.removeChild(currentPigs[i].el);
      }
    }
    currentPigs = [];
  }

  function placePigRandomly(pigEl) {
    var rect = getGameRect();
    var margin = SPAWN_MARGIN;
    var pigW = pigEl.offsetWidth || 80;
    var pigH = pigEl.offsetHeight || 80;
    var maxX = rect.width - pigW - 2 * margin;
    var maxY = rect.height - pigH - 2 * margin;
    if (maxX <= 0 || maxY <= 0) {
      pigEl.style.left = '50%';
      pigEl.style.top = '50%';
      return;
    }
    var x = margin + Math.random() * maxX;
    var y = margin + Math.random() * maxY;
    pigEl.style.left = (x + pigW / 2) + 'px';
    pigEl.style.top = (y + pigH / 2) + 'px';
  }

  function spawnPigsForRound(count) {
    removeAllPigs();
    roundKills = 0;
    var n = Math.max(1, Math.min(5, count));
    for (var i = 0; i < n; i++) {
      var pigEl = document.createElement('div');
      pigEl.className = 'pig-wrap';
      pigEl.style.visibility = 'visible';
      var img = document.createElement('img');
      img.src = PIG_IMG_SRC;
      img.alt = '猪';
      img.className = 'pig-img';
      pigEl.appendChild(img);
      gameArea.appendChild(pigEl);
      placePigRandomly(pigEl);
      currentPigs.push({ el: pigEl, alive: true });
    }
  }

  function showHitEffectAtRect(rect) {
    var overlay = document.createElement('div');
    overlay.className = 'hit-overlay';
    overlay.style.cssText =
      'position:fixed;left:' + rect.left + 'px;top:' + rect.top +
      'px;width:' + rect.width + 'px;height:' + rect.height +
      'px;pointer-events:none;z-index:10;display:flex;align-items:center;justify-content:center;';
    var img = document.createElement('img');
    img.src = HIT_EFFECT_SRC;
    img.alt = '';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    overlay.appendChild(img);
    document.body.appendChild(overlay);
    setTimeout(function () {
      overlay.remove();
    }, 800);
  }

  function computeRoundScore(kills) {
    if (kills <= 0) return 0;
    if (kills === 1) return 1;
    // 多头猪时给明显更高的奖励：1,3,6...
    return (kills * (kills + 1)) / 2;
  }

  function endRound(success) {
    clearRoundTimer();
    var kills = roundKills;
    var total = currentPigs.length;
    var gained = computeRoundScore(kills);
    if (gained > 0) {
      score += gained;
      scoreEl.textContent = score;
    }
    if (!success && kills < total) {
      missCount += 1;
      missText.textContent = missCount;
    }
    removeAllPigs();
    setTimeout(startNewRound, 50);
  }

  function onRoundTimeout() {
    roundTimerId = null;
    if (roundTimerIntervalId) {
      clearInterval(roundTimerIntervalId);
      roundTimerIntervalId = null;
    }
    timerText.textContent = '0.0s';
    endRound(false);
  }

  function startRoundTimer() {
    clearRoundTimer();
    roundStartTime = Date.now();
    roundTimerId = setTimeout(onRoundTimeout, difficultyMs);
    roundTimerIntervalId = setInterval(updateTimerDisplay, 100);
    updateTimerDisplay();
  }

  function startNewRound() {
    var count = 1 + Math.floor(Math.random() * 5); // 1~5 只猪
    spawnPigsForRound(count);
    startRoundTimer();
  }

  function updateTrail(from, to) {
    var r = getGameRect();
    trailLine.setAttribute('x1', from.x - r.left);
    trailLine.setAttribute('y1', from.y - r.top);
    trailLine.setAttribute('x2', to.x - r.left);
    trailLine.setAttribute('y2', to.y - r.top);
    trailSvg.classList.remove('hidden');
  }

  function startDrag(xy) {
    isDragging = true;
    points = [xy];
    updateTrail(xy, xy);
  }

  function moveDrag(xy) {
    if (!isDragging) return;
    var now = Date.now();
    if (now - lastTrailTime < TRAIL_THROTTLE_MS && points.length > 0) return;
    lastTrailTime = now;
    points.push(xy);
    if (points.length >= 2) updateTrail(points[0], points[points.length - 1]);
  }

  function onSlashEnd() {
    if (!isDragging || points.length < 2) {
      isDragging = false;
      points = [];
      trailSvg.classList.add('hidden');
      return;
    }

    var hitThisSlash = 0;
    for (var i = 0; i < currentPigs.length; i++) {
      var pig = currentPigs[i];
      if (!pig.alive) continue;
      var rect = pig.el.getBoundingClientRect();
      if (slashHitsRect(points, rect)) {
        pig.alive = false;
        hitThisSlash += 1;
        var img = pig.el.querySelector('img');
        if (img) img.src = HIT_EFFECT_SRC;
      }
    }
    roundKills += hitThisSlash;

    if (roundKills >= currentPigs.length && currentPigs.length > 0) {
      // 当前轮所有猪都被斩断，立刻进入下一轮
      endRound(true);
    }

    isDragging = false;
    points = [];
    trailSvg.classList.add('hidden');
  }

  gameArea.addEventListener('mousedown', function (e) {
    e.preventDefault();
    startDrag(getEventXY(e));
  });

  gameArea.addEventListener('mousemove', function (e) {
    e.preventDefault();
    moveDrag(getEventXY(e));
  });

  gameArea.addEventListener('mouseup', function (e) {
    e.preventDefault();
    onSlashEnd();
  });

  gameArea.addEventListener('mouseleave', function () {
    if (isDragging) onSlashEnd();
  });

  gameArea.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      startDrag(getEventXY(e));
    }
  }, { passive: false });

  gameArea.addEventListener('touchmove', function (e) {
    if (e.touches.length === 1 && isDragging) {
      e.preventDefault();
      moveDrag(getEventXY(e));
    }
  }, { passive: false });

  gameArea.addEventListener('touchend', function (e) {
    if (e.touches.length === 0) onSlashEnd();
  });

  gameArea.addEventListener('touchcancel', function (e) {
    if (e.touches.length === 0) onSlashEnd();
  });

  btnStart.addEventListener('click', function () {
    var sel = document.querySelector('input[name="difficulty"]:checked');
    if (sel && DIFFICULTY_MS[sel.value] != null) {
      difficultyMs = DIFFICULTY_MS[sel.value];
    }
    startScreen.classList.add('hidden');
    startNewRound();
  });

  (function preloadImages() {
    var total = 2;
    var loaded = 0;
    var done = false;
    function showStartScreen() {
      if (done) return;
      done = true;
      if (loadScreen) loadScreen.classList.add('hidden');
      if (startScreen) startScreen.classList.remove('hidden');
    }
    function onDone() {
      loaded += 1;
      if (loaded >= total) showStartScreen();
    }
    // 使用绝对 URL，避免移动端相对路径解析不一致导致预加载一直不完成
    var baseEl = document.querySelector('base');
    var path = location.pathname;
    var baseUrl = (baseEl && baseEl.href)
      ? baseEl.href.replace(/\/?$/, '/')
      : (location.origin + (path === '/' || path === '' ? '/' : path.replace(/\/$/, '') + '/'));
    var img1 = new Image();
    img1.onload = onDone;
    img1.onerror = onDone;
    img1.src = baseUrl + PIG_IMG_SRC;
    var img2 = new Image();
    img2.onload = onDone;
    img2.onerror = onDone;
    img2.src = baseUrl + HIT_EFFECT_SRC;
    // 移动端可能 onload/onerror 不触发（如请求挂起、解码慢），超时后强制进入
    setTimeout(function () {
      if (!done) showStartScreen();
    }, 6000);
  })();
})();
