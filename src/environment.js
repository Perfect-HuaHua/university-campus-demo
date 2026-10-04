function makeAggregateTexture(THREE, renderer, seed, base, spread) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(canvas.width, canvas.height);
  let state = seed;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  for (let i = 0; i < pixels.data.length; i += 4) {
    const value = Math.round(base + (random() - 0.5) * spread);
    pixels.data[i] = value;
    pixels.data[i + 1] = value;
    pixels.data[i + 2] = value;
    pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(48, 32);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

export function installCampusMaterials(THREE, root, renderer) {
  const asphalt = makeAggregateTexture(THREE, renderer, 5417, 156, 38);
  const concrete = makeAggregateTexture(THREE, renderer, 9151, 186, 28);
  root.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material.name.includes('Asphalt')) {
        material.color.set('#ffffff');
        material.map = asphalt;
        material.bumpMap = asphalt;
        material.bumpScale = 0.035;
        material.roughness = 0.96;
        material.needsUpdate = true;
      } else if (material.name.includes('Paving')) {
        material.color.set('#b9c4cc');
        material.map = concrete;
        material.bumpMap = concrete;
        material.bumpScale = 0.018;
        material.roughness = 0.88;
        material.needsUpdate = true;
      }
    }
  });
}

export function installGrass(THREE, scene, renderer, onError) {
  const loader = new THREE.TextureLoader();
  const source = loader.load('/textures/leafy-grass-diffuse-1k.jpg', (texture) => {
    const canvas = document.createElement('canvas');
    canvas.width = texture.image.width;
    canvas.height = texture.image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(texture.image, 0, 0);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = (image.data[i] * 0.30 + image.data[i + 1] * 0.59 + image.data[i + 2] * 0.11) / 255;
      image.data[i] = Math.round(35 + value * 72);
      image.data[i + 1] = Math.round(70 + value * 118);
      image.data[i + 2] = Math.round(27 + value * 53);
    }
    context.putImageData(image, 0, 0);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(56, 42);
    map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    grass.material.map = map;
    grass.material.needsUpdate = true;
  }, undefined, onError);

  const normalMap = loader.load('/textures/leafy-grass-normal-1k.jpg');
  const roughnessMap = loader.load('/textures/leafy-grass-roughness-1k.jpg');
  for (const map of [normalMap, roughnessMap]) {
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(56, 42);
  }
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(560, 420), new THREE.MeshStandardMaterial({
    color: '#ffffff', map: source, normalMap, roughnessMap, roughness: 0.96,
    normalScale: new THREE.Vector2(0.42, 0.42),
  }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.04;
  grass.receiveShadow = true;
  grass.name = 'CC0_Leafy_Grass_Ground';
  scene.add(grass);

  return { update: () => {}, count: 0 };
}
