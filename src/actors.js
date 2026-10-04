function routeMeasure(THREE, points) {
  const lengths = points.slice(0, -1).map((point, i) => point.distanceTo(points[i + 1]));
  return { points, lengths, total: lengths.reduce((sum, value) => sum + value, 0) };
}

function routeSample(THREE, route, distance) {
  let remaining = ((distance % route.total) + route.total) % route.total;
  for (let i = 0; i < route.lengths.length; i += 1) {
    const length = route.lengths[i];
    if (remaining <= length) {
      return {
        point: route.points[i].clone().lerp(route.points[i + 1], remaining / length),
        direction: route.points[i + 1].clone().sub(route.points[i]).normalize(),
      };
    }
    remaining -= length;
  }
  return { point: route.points[0].clone(), direction: new THREE.Vector3(1, 0, 0) };
}

function createCar(THREE, scene, color, index) {
  const group = new THREE.Group();
  group.name = `Moving_Compact_Car_${index + 1}`;
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.34, roughness: 0.24, clearcoat: 0.78, clearcoatRoughness: 0.18 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#17343c', metalness: 0.12, roughness: 0.16, clearcoat: 0.9, side: THREE.DoubleSide });
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-2.2, 0.38); bodyShape.lineTo(-2.22, 0.73); bodyShape.lineTo(-1.65, 0.9);
  bodyShape.lineTo(-1.05, 1.66); bodyShape.quadraticCurveTo(-0.82, 1.94, -0.46, 1.96);
  bodyShape.lineTo(0.63, 1.94); bodyShape.quadraticCurveTo(1.04, 1.91, 1.28, 1.61);
  bodyShape.lineTo(1.72, 0.99); bodyShape.lineTo(2.12, 0.85); bodyShape.lineTo(2.22, 0.65);
  bodyShape.lineTo(2.08, 0.39); bodyShape.closePath();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(bodyShape, { depth: 1.68, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.055, bevelThickness: 0.055 }), paint);
  body.geometry.translate(0, 0, -0.84);
  body.castShadow = body.receiveShadow = true;
  group.add(body);

  const sidePane = (coordinates, side) => {
    const shape = new THREE.Shape();
    coordinates.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
    shape.closePath();
    const pane = new THREE.Mesh(new THREE.ShapeGeometry(shape), glass);
    pane.position.z = side * 0.846;
    group.add(pane);
  };
  const frontWindow = [[-0.28, 1.08], [-0.39, 1.76], [0.55, 1.75], [1.11, 1.08]];
  const rearWindow = [[-1.44, 1.01], [-0.91, 1.69], [-0.53, 1.76], [-0.42, 1.08]];
  for (const side of [-1, 1]) { sidePane(frontWindow, side); sidePane(rearWindow, side); }

  const wheels = [];
  const tireMaterial = new THREE.MeshStandardMaterial({ color: '#171c1d', roughness: 0.9 });
  const hubMaterial = new THREE.MeshStandardMaterial({ color: '#b7c0bd', metalness: 0.82, roughness: 0.27 });
  for (const x of [-1.38, 1.28]) for (const z of [-0.84, 0.84]) {
    const wheel = new THREE.Group();
    wheel.position.set(x, 0.39, z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.22, 18), tireMaterial);
    tire.rotation.x = Math.PI / 2;
    tire.castShadow = true;
    wheel.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.226, 12), hubMaterial);
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    group.add(wheel);
    wheels.push(wheel);
  }

  const headMaterial = new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#cbb478', emissiveIntensity: 0.22 });
  const tailMaterial = new THREE.MeshStandardMaterial({ color: '#ab2e31', emissive: '#8f1018', emissiveIntensity: 0.35 });
  for (const z of [-0.54, 0.54]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.17, 0.27), headMaterial);
    head.position.set(2.21, 0.72, z);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.19, 0.3), tailMaterial);
    tail.position.set(-2.21, 0.69, z);
    group.add(tail);
  }
  scene.add(group);
  return { group, wheels, progress: index / 3, speed: 5.0 + index * 0.25 };
}

function createPedestrian(THREE, scene, index, clothingColor, route) {
  const group = new THREE.Group();
  group.name = `Walking_Student_${index + 1}`;
  const clothes = new THREE.MeshStandardMaterial({ color: clothingColor, roughness: 0.78 });
  const pants = new THREE.MeshStandardMaterial({ color: index % 2 ? '#273c47' : '#393b3b', roughness: 0.84 });
  const skin = new THREE.MeshStandardMaterial({ color: '#bd8565', roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: index % 2 ? '#28221f' : '#48382e', roughness: 0.92 });
  const shoeMaterial = new THREE.MeshStandardMaterial({ color: '#242727', roughness: 0.88 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.44, 4, 8), clothes);
  torso.position.y = 1.3;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), skin);
  head.position.y = 1.81;
  group.add(head);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), hair);
  hairCap.position.y = 1.88;
  group.add(hairCap);
  const legs = [];
  const arms = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.11, 0.91, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.38, 4, 7), pants);
    thigh.position.y = -0.25;
    leg.add(thigh);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.14), shoeMaterial);
    shoe.position.set(0.04, -0.51, 0.015);
    leg.add(shoe);
    group.add(leg);
    legs.push(leg);

    const arm = new THREE.Group();
    arm.position.set(side * 0.25, 1.49, 0);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.37, 4, 7), clothes);
    sleeve.position.y = -0.23;
    sleeve.rotation.z = side * -0.08;
    arm.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 7), skin);
    hand.position.y = -0.48;
    arm.add(hand);
    group.add(arm);
    arms.push(arm);
  }
  scene.add(group);
  return { group, legs, arms, route, offset: index * 13.7, speed: 0.78 + index % 3 * 0.13 };
}

export function installCampusActors(THREE, scene) {
  const route = (points) => routeMeasure(THREE, points.map((point) => point.clone().setZ(-point.z)));
  const loop = route([
    new THREE.Vector3(-70, 0.14, 47), new THREE.Vector3(70, 0.14, 47),
    new THREE.Vector3(70, 0.14, -47), new THREE.Vector3(-70, 0.14, -47),
    new THREE.Vector3(-70, 0.14, 47),
  ]);
  const outerLoop = route([
    new THREE.Vector3(-260, 0.14, -145), new THREE.Vector3(-260, 0.14, 125),
    new THREE.Vector3(-225, 0.14, 170), new THREE.Vector3(-100, 0.14, 170),
    new THREE.Vector3(100, 0.14, 170), new THREE.Vector3(225, 0.14, 170),
    new THREE.Vector3(260, 0.14, 125), new THREE.Vector3(260, 0.14, -105),
    new THREE.Vector3(220, 0.14, -145), new THREE.Vector3(-210, 0.14, -145),
    new THREE.Vector3(-260, 0.14, -145),
  ]);
  const cars = [
    createCar(THREE, scene, '#d9e0e7', 0), createCar(THREE, scene, '#427ea8', 1), createCar(THREE, scene, '#c36c48', 2),
    createCar(THREE, scene, '#88aabe', 3), createCar(THREE, scene, '#d9b572', 4),
  ].map((car, index) => ({ ...car, route: index >= 3 ? outerLoop : loop }));
  const centralA = route([new THREE.Vector3(-5, 0.14, -35), new THREE.Vector3(-5, 0.14, 12), new THREE.Vector3(-5, 0.14, -35)]);
  const centralB = route([new THREE.Vector3(3, 0.14, 12), new THREE.Vector3(3, 0.14, -36), new THREE.Vector3(3, 0.14, 12)]);
  const frontageA = route([new THREE.Vector3(-28, 0.16, 36.4), new THREE.Vector3(-6, 0.16, 36.4), new THREE.Vector3(-28, 0.16, 36.4)]);
  const frontageB = route([new THREE.Vector3(-2, 0.16, 36.4), new THREE.Vector3(19, 0.16, 36.4), new THREE.Vector3(-2, 0.16, 36.4)]);
  const gateWalk = route([
    new THREE.Vector3(0, 0.16, 158), new THREE.Vector3(0, 0.16, 136),
    new THREE.Vector3(-12, 0.16, 112), new THREE.Vector3(-8, 0.16, 60), new THREE.Vector3(0, 0.16, 136),
  ]);
  const plazaCross = route([new THREE.Vector3(-40, 0.16, 136), new THREE.Vector3(40, 0.16, 136), new THREE.Vector3(-40, 0.16, 136)]);
  const walkRoutes = [centralA, centralB, frontageA, frontageB, centralA, frontageB, gateWalk, plazaCross];
  const clothes = ['#d6b577', '#b86d54', '#56817d', '#d2d0bf', '#667e9b', '#b39476', '#c8d8e7', '#7aa3d8'];
  const pedestrians = clothes.map((color, i) => createPedestrian(THREE, scene, i, color, walkRoutes[i]));
  return {
    update(delta, elapsed) {
      cars.forEach((car) => {
        const state = routeSample(THREE, car.route, car.progress * car.route.total + elapsed * car.speed);
        car.group.position.copy(state.point);
        car.group.rotation.y = Math.atan2(-state.direction.z, state.direction.x);
        car.wheels.forEach((wheel) => { wheel.rotation.y -= delta * car.speed / 0.37; });
      });
      pedestrians.forEach((person) => {
        const state = routeSample(THREE, person.route, person.offset + elapsed * person.speed);
        person.group.position.copy(state.point);
        person.group.rotation.y = Math.atan2(-state.direction.z, state.direction.x);
        const stride = Math.sin(elapsed * 5.2 + person.offset);
        person.legs[0].rotation.z = stride * 0.46;
        person.legs[1].rotation.z = -stride * 0.46;
        person.arms[0].rotation.z = -stride * 0.31;
        person.arms[1].rotation.z = stride * 0.31;
      });
    },
    counts: { cars: cars.length, pedestrians: pedestrians.length },
  };
}
