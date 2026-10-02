window.createGenesis = function(scene, camera) {
  const genesisGroup = new THREE.Group();
  scene.add(genesisGroup);

  return {
    group: genesisGroup,
    update: function(time) {}
  };
};