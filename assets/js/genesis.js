window.createGenesis = function(scene, camera) {
  const genesisGroup = new THREE.Group();
  scene.add(genesisGroup);

  const container = document.getElementById('modalWrap');
  const card = document.getElementById('modalCard');
  const btnCloseTop = document.getElementById('btnCloseTop');
  const btnMinBottom = document.getElementById('btnMinimizeBottom');

  if (container && card) {
    // Изоляция событий ввода: взаимодействие с модалкой не передается на камеру Three.js
    const stopEvents = ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'wheel', 'pointerdown'];
    stopEvents.forEach(evt => {
      container.addEventListener(evt, (e) => e.stopPropagation(), { passive: false });
    });

    function minimize() {
      container.classList.add('minimized');
      document.body.classList.remove('modal-open');
    }

    function maximize() {
      if (container.classList.contains('minimized')) {
        container.classList.remove('minimized');
        document.body.classList.add('modal-open');
      }
    }

    if (btnCloseTop) {
      btnCloseTop.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        minimize(); 
      });
    }

    if (btnMinBottom) {
      btnMinBottom.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        minimize(); 
      });
    }

    card.addEventListener('click', maximize);
  }

  return {
    group: genesisGroup,
    update: function(time) {}
  };
};