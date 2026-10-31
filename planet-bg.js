import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export function initPlanetBackground(canvasId = 'planetCanvas') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const CONFIG = {
    rimColor: '#ffd87a',
    rimPower: 2.4,
    nightLights: 10,
    terrainDepth: 0.33,
    terrainShade: 1.3,
    oceanGlint: 0.45,
    oceanDeep: 0.12,
    oceanFlow: 3,
    oceanFlowSpeed: 0.8,
    oceanFlowScale: 2.1,
    glowColor: '#ff9800',
    glowIntensity: 3.35,
    planetRadius: 1.95,
    spin: 0.035,
    initRotation: 2.07,
    tilt: 0.37,
    cloud1Height: 1.005,
    cloud1Opacity: 0.6,
    cloud1Spin: 0.06,
    cloud2Height: 1.03,
    cloud2Opacity: 0.5,
    cloud2Spin: 0.14,
    cloud3Height: 1.075,
    cloud3Opacity: 0.5,
    cloud3Spin: 0.1,
    bgColor: '#040a1e',
    flameColor: '#fb8500',
    flameColor2: '#ffd27a',
    flameAmt: 0.14,
    atmoColor: '#ffd87a',
    atmoCount: 280,
    atmoSize: 20,
    atmoSpeed: 0.8,
    starColor: '#fff4cc',
    starCount: 1200,
    starSize: 1.6,
    starFlicker: 1,
    markerColor: '#ffd27a',
    markerCount: 60,
    markerSize: 18,
    markerSpeed: 0.5,
  };

  const LAYERS = { NONE: 0, TORUS_SCENE: 1, BLOOM_SCENE: 2, ENTIRE_SCENE: 3 };

  function hexToVec3(hex) {
    const c = new THREE.Color(hex);
    return new THREE.Vector3(c.r, c.g, c.b);
  }

  const SNOISE = `
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
    vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
    s0 = floor(b0)*2.0 + 1.0; s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  `;

  let renderer;
  try {
    renderer = new THREE.WebGL1Renderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    console.warn('WebGL initialization failed, falling back to static gradient:', e);
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 8);
  camera.layers.enable(LAYERS.TORUS_SCENE);
  camera.layers.enable(LAYERS.BLOOM_SCENE);
  camera.layers.enable(LAYERS.ENTIRE_SCENE);
  scene.add(camera);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
  ambientLight.layers.set(LAYERS.ENTIRE_SCENE);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(0, 10, 2);
  dirLight.layers.set(LAYERS.ENTIRE_SCENE);
  scene.add(dirLight);

  // Composers
  const w = window.innerWidth, h = window.innerHeight;
  const torusComposer = new EffectComposer(renderer);
  torusComposer.renderToScreen = false;
  torusComposer.addPass(new RenderPass(scene, camera));
  torusComposer.addPass(new ShaderPass(GammaCorrectionShader));
  torusComposer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.2, 0));
  torusComposer.addPass(new ShaderPass(CopyShader));

  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(new RenderPass(scene, camera));
  bloomComposer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.6, 0));
  bloomComposer.addPass(new ShaderPass(GammaCorrectionShader));

  const FinalPass = {
    uniforms: {
      iTime: { value: 0 },
      tDiffuse: { value: null },
      torusTexture: { value: null },
      bloomTexture: { value: null },
      haloTexture: { value: null },
      uBg: { value: hexToVec3(CONFIG.bgColor) },
      uFlameA: { value: hexToVec3(CONFIG.flameColor) },
      uFlameB: { value: hexToVec3(CONFIG.flameColor2) },
      uFlameAmt: { value: CONFIG.flameAmt },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float iTime; uniform sampler2D tDiffuse; uniform sampler2D bloomTexture; uniform sampler2D torusTexture; uniform sampler2D haloTexture;
      uniform vec3 uBg; uniform vec3 uFlameA; uniform vec3 uFlameB; uniform float uFlameAmt;
      varying vec2 vUv;
      vec3 warp3d(vec3 pos, float t){ float curv=.8,a=1.9,b=0.7; pos*=2.;
        pos.x+=curv*sin(t+a*pos.y)+t*b; pos.y+=curv*cos(t+a*pos.x);
        pos.y+=curv*sin(t+a*pos.z)+t*b; pos.z+=curv*cos(t+a*pos.y);
        pos.z+=curv*sin(t+a*pos.x)+t*b; pos.x+=curv*cos(t+a*pos.z);
        return 0.5+0.5*cos(pos.xyz+vec3(1,2,4)); }
      void main(){
        vec2 uv = 2.*vUv - 1.;
        vec3 w = pow(warp3d(vec3(uv.x, sin(uv.y), uv.y), iTime*1.5), vec3(1.5));
        vec3 flame = 1.5*uFlameA*w.x; flame*=w.y; flame += uFlameB*w.z;
        flame *= smoothstep(0.25, 1., abs(uv.y));
        float md = smoothstep(-0.7, 1., -uv.y*uv.x); flame *= md*md;
        vec3 bg = uBg * (1.0 - 0.4 * length(uv));
        vec3 halo = texture2D(haloTexture, vUv).xyz;
        gl_FragColor = vec4(bg + flame*uFlameAmt + texture2D(bloomTexture, vUv).xyz + texture2D(torusTexture, vUv).xyz + texture2D(tDiffuse, vUv).xyz + halo, 1.);
      }
    `
  };

  const finalPassShader = new ShaderPass(FinalPass);
  finalPassShader.uniforms.bloomTexture.value = bloomComposer.renderTarget1.texture;
  finalPassShader.uniforms.torusTexture.value = torusComposer.renderTarget1.texture;

  const finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(new RenderPass(scene, camera));
  finalComposer.addPass(finalPassShader);

  // Groups
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  const planetGroup = new THREE.Group();
  planetGroup.rotation.z = CONFIG.tilt;
  worldGroup.add(planetGroup);

  const cloudGroup = new THREE.Group();
  cloudGroup.rotation.z = CONFIG.tilt;
  cloudGroup.visible = false;
  worldGroup.add(cloudGroup);

  // Halo Glow
  const haloMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uGlow: { value: hexToVec3(CONFIG.glowColor) },
      uIntensity: { value: CONFIG.glowIntensity }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 uGlow; uniform float uIntensity; varying vec2 vUv;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2);
        gl_FragColor = vec4(uGlow * a * uIntensity, a);
      }
    `
  });
  const glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), haloMat);
  glowMesh.scale.setScalar(CONFIG.planetRadius * 2.3);
  worldGroup.add(glowMesh);

  // Ambient motes
  const atmoGeo = new THREE.BufferGeometry();
  const atmoPos = new Float32Array(CONFIG.atmoCount * 3);
  const atmoSizes = new Float32Array(CONFIG.atmoCount);
  const atmoSeeds = new Float32Array(CONFIG.atmoCount);
  for (let i = 0; i < CONFIG.atmoCount; i++) {
    atmoPos[i * 3] = (Math.random() - 0.5) * 2;
    atmoPos[i * 3 + 1] = (Math.random() - 0.5) * 2;
    atmoPos[i * 3 + 2] = (Math.random() - 0.5) * 2;
    atmoSizes[i] = CONFIG.atmoSize * (0.4 + Math.random());
    atmoSeeds[i] = Math.random() * 100.0;
  }
  atmoGeo.setAttribute('position', new THREE.BufferAttribute(atmoPos, 3));
  atmoGeo.setAttribute('size', new THREE.BufferAttribute(atmoSizes, 1));
  atmoGeo.setAttribute('seed', new THREE.BufferAttribute(atmoSeeds, 1));

  const atmoMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(w, h) },
      uColor: { value: hexToVec3(CONFIG.atmoColor) }
    },
    vertexShader: `
      attribute float size; attribute float seed; uniform float uTime; uniform vec2 uRes;
      varying float vA;
      vec3 warp(vec3 p, float t){ float c=0.9,a=1.9,b=0.02,s=0.05; p*=2.;
        p.x+=c*sin(s*t+a*p.y)+t*b; p.y+=c*cos(s*t+a*p.x); p.y+=c*sin(s*t+a*p.z)+t*b;
        p.z+=c*cos(s*t+a*p.y); p.z+=c*sin(s*t+a*p.x)+t*b; p.x+=c*cos(s*t+a*p.z);
        return cos(p+vec3(1,2,4)); }
      void main(){
        vec3 v = position*4.0 + warp(position, uTime)*1.2;
        vec4 mv = modelViewMatrix * vec4(v, 1.0);
        float r = length(v); float farF = 1.0 - smoothstep(5.0, 6.5, r); float nearF = smoothstep(0.0, 0.5, -mv.z);
        vA = farF * nearF;
        gl_PointSize = size * uRes.y / 900.0 / -mv.z; gl_PointSize = max(gl_PointSize, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor; varying float vA;
      void main(){ vec2 p = gl_PointCoord - 0.5; float l = length(p); if (l > 0.5) discard;
        float tex = smoothstep(0.5, 0.0, l); gl_FragColor = vec4(uColor * tex, tex * vA * 0.55); }
    `
  });
  const atmoPoints = new THREE.Points(atmoGeo, atmoMat);
  scene.add(atmoPoints);

  // Starfield
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(CONFIG.starCount * 3);
  const starSeeds = new Float32Array(CONFIG.starCount);
  const starBright = new Float32Array(CONFIG.starCount);
  for (let i = 0; i < CONFIG.starCount; i++) {
    const u = Math.random(), v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = 90.0, sinPhi = Math.sin(phi);
    starPos[i * 3] = r * sinPhi * Math.cos(theta);
    starPos[i * 3 + 1] = r * sinPhi * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
    starSeeds[i] = Math.random() * 200.0;
    starBright[i] = 0.35 + Math.random() * 0.65;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('seed', new THREE.BufferAttribute(starSeeds, 1));
  starGeo.setAttribute('bright', new THREE.BufferAttribute(starBright, 1));

  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: CONFIG.starSize },
      uFlicker: { value: CONFIG.starFlicker },
      uColor: { value: hexToVec3(CONFIG.starColor) },
      uRes: { value: new THREE.Vector2(w, h) }
    },
    vertexShader: `
      attribute float seed; attribute float bright;
      uniform float uTime; uniform float uSize; uniform float uFlicker; uniform vec2 uRes;
      varying float vTw;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = 0.6 + 0.4 * sin(uTime * uFlicker + seed);
        vTw = bright * tw;
        gl_PointSize = max(uSize * uRes.y / 900.0 * (90.0 / max(-mv.z, 1.0)), 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor; varying float vTw;
      void main(){
        vec2 p = gl_PointCoord - 0.5; float l = length(p); if (l > 0.5) discard;
        float core = smoothstep(0.5, 0.0, l);
        gl_FragColor = vec4(uColor, core * vTw);
      }
    `
  });
  const starPoints = new THREE.Points(starGeo, starMat);
  starPoints.frustumCulled = false;
  scene.add(starPoints);

  // Position globe aesthetically behind the app screens
  worldGroup.position.set(0, 0.2, 0);
  worldGroup.scale.setScalar(1.05);

  let planetTime = 0, cloudTime = 0, starTime = 0, markerTime = 0, spinPhase = 0;

  // Assets loader
  const ASSET_BASE_URL = 'https://api.getlayers.ai/storage/v1/object/public/public/assets/ascend-d9857ad1f2';
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/');
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  const textureLoader = new THREE.TextureLoader();

  // Cloud shells
  textureLoader.load(`${ASSET_BASE_URL}/planet-clouds.png`, (cloudTex) => {
    cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping;
    cloudTex.repeat.set(5, 5);

    const layers = [
      { h: CONFIG.cloud1Height, o: CONFIG.cloud1Opacity, ry: 0.0, phase: 0.0, spinKey: 'cloud1Spin' },
      { h: CONFIG.cloud2Height, o: CONFIG.cloud2Opacity, ry: 2.2, phase: 13.0, spinKey: 'cloud2Spin' },
      { h: CONFIG.cloud3Height, o: CONFIG.cloud3Opacity, ry: 4.3, phase: 27.0, spinKey: 'cloud3Spin' },
    ];

    layers.forEach(layer => {
      const geo = new THREE.SphereGeometry(CONFIG.planetRadius * layer.h, 64, 64);
      const mat = new THREE.MeshStandardMaterial({
        map: cloudTex,
        transparent: true,
        depthWrite: false,
      });

      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { get value() { return cloudTime; } };
        shader.uniforms.noiseScale = { value: 20.0 };
        shader.uniforms.uSpeedX = { value: 1.0 };
        shader.uniforms.uSpeedY = { value: 2.0 };
        shader.uniforms.uSpeedZ = { value: 2.0 };
        shader.uniforms.uOpacity = { value: layer.o };
        shader.uniforms.uPhase = { value: layer.phase };

        shader.vertexShader = `varying vec2 vCloudUv;\n` + shader.vertexShader.replace(
          `void main() {`,
          `void main() {\n  vCloudUv = uv;`
        );

        shader.fragmentShader = `
          uniform float uTime; uniform float noiseScale; uniform float uSpeedX; uniform float uSpeedY; uniform float uSpeedZ;
          uniform float uOpacity; uniform float uPhase; varying vec2 vCloudUv;
          ${SNOISE}
        ` + shader.fragmentShader.replace(
          `#include <dithering_fragment>`,
          `#include <dithering_fragment>
          gl_FragColor.rgb = vec3(1.0);
          float cloudNoise = snoise(vec3(vCloudUv.x * noiseScale + uTime * uSpeedX + uPhase, vCloudUv.y * noiseScale - uTime * uSpeedY + uPhase, uTime * uSpeedZ + uPhase));
          float cloudNdv = max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0);
          float cloudEdge = pow(1.0 - cloudNdv, 3.0);
          float cloudMod = mix(cloudNoise, 1.0, cloudEdge);
          float cloudNdl = dot(normalize(vNormal), normalize(vec3(-0.9, 0.18, 0.4)));
          float cloudDay = 1.0 - smoothstep(0.30, -0.30, cloudNdl) * 0.9;
          gl_FragColor.a *= cloudMod * uOpacity * cloudDay;
          `
        );
      };

      const cloudMesh = new THREE.Mesh(geo, mat);
      cloudMesh.rotation.y = layer.ry;
      cloudMesh.renderOrder = 2;
      cloudMesh.userData.spinKey = layer.spinKey;
      cloudGroup.add(cloudMesh);
    });
  });

  // Planet Mesh & Lights
  gltfLoader.load(`${ASSET_BASE_URL}/planet-lights.glb`, (lightsGltf) => {
    let nightTex = null;
    lightsGltf.scene.traverse(node => {
      if (node.isMesh && node.material && node.material.map) {
        nightTex = node.material.map;
      }
    });

    gltfLoader.load(`${ASSET_BASE_URL}/planet.glb`, (planetGltf) => {
      let planetMesh = null;
      planetGltf.scene.traverse(node => {
        if (node.isMesh && !planetMesh) planetMesh = node;
      });

      if (planetMesh) {
        planetMesh.geometry.computeBoundingSphere();
        const r = planetMesh.geometry.boundingSphere.radius;
        planetMesh.scale.setScalar(CONFIG.planetRadius / r);

        const origMat = planetMesh.material;
        const mat = origMat.clone();
        mat.metalness = 0;
        mat.roughness = 1;
        mat.envMapIntensity = 0;

        mat.onBeforeCompile = (shader) => {
          shader.uniforms.time = { get value() { return planetTime; } };
          shader.uniforms.noiseScale = { value: 30.0 };
          shader.uniforms.speedX = { value: 1.5 };
          shader.uniforms.speedY = { value: 2.0 };
          shader.uniforms.speedZ = { value: 2.5 };
          shader.uniforms.rimColor = { value: hexToVec3(CONFIG.rimColor) };
          shader.uniforms.rimPower = { value: CONFIG.rimPower };
          shader.uniforms.nightBlendTexture = { value: nightTex };
          shader.uniforms.nightLights = { value: CONFIG.nightLights };
          shader.uniforms.terrainDepth = { value: CONFIG.terrainDepth };
          shader.uniforms.terrainShade = { value: CONFIG.terrainShade };
          shader.uniforms.oceanGlint = { value: CONFIG.oceanGlint };
          shader.uniforms.oceanDeep = { value: CONFIG.oceanDeep };
          shader.uniforms.oceanFlow = { value: CONFIG.oceanFlow };
          shader.uniforms.oceanFlowSpeed = { value: CONFIG.oceanFlowSpeed };
          shader.uniforms.oceanFlowScale = { value: CONFIG.oceanFlowScale };

          shader.vertexShader = `varying vec2 vCustomUv;\n` + shader.vertexShader.replace(
            `void main() {`,
            `void main() {\n  vCustomUv = uv;`
          );

          shader.fragmentShader = `
            uniform float time; uniform float noiseScale; uniform float speedX; uniform float speedY; uniform float speedZ;
            uniform vec3 rimColor; uniform float rimPower; uniform sampler2D nightBlendTexture; uniform float nightLights;
            uniform float terrainDepth; uniform float terrainShade; uniform float oceanGlint; uniform float oceanDeep;
            uniform float oceanFlow; uniform float oceanFlowSpeed; uniform float oceanFlowScale;
            varying vec2 vCustomUv;
            ${SNOISE}
          ` + shader.fragmentShader.replace(
            `#include <dithering_fragment>`,
            `#include <dithering_fragment>
            vec3 normalizedNormal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);
            float rim = 1.0 - max(dot(viewDir, normalizedNormal), 0.0);
            rim = pow(rim, rimPower); rim = pow(rim, 1.5); rim *= 0.7;
            vec3 currentColor = gl_FragColor.rgb;
            float blueDom = currentColor.b - max(currentColor.r, currentColor.g);
            float waterMask = clamp(smoothstep(-0.005, 0.03, blueDom), 0.0, 1.0);
            float shimmer = snoise(vec3(vCustomUv.x * noiseScale + time * speedX, vCustomUv.y * noiseScale - time * speedY, time * speedZ));
            gl_FragColor.rgb += waterMask * shimmer * 0.025;
            float fT = time * oceanFlowSpeed * 4.0;
            float fS = 4.0 * oceanFlowScale;
            float warp = snoise(vec3(vCustomUv.x * fS - fT * 0.5, vCustomUv.y * fS + fT * 0.4, fT * 0.5));
            float flow = snoise(vec3(vCustomUv.x * fS * 2.0 + fT * 0.6 + warp, vCustomUv.y * fS * 2.0 - fT * 0.5, fT * 0.7));
            flow = warp * 0.6 + flow * 0.4;
            gl_FragColor.rgb += waterMask * flow * 0.12 * oceanFlow;
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.01, 0.06, 0.16), waterMask * oceanDeep);
            vec3 finalColor = mix(gl_FragColor.rgb, rimColor, rim);
            gl_FragColor = vec4(finalColor, 1.0);
            vec3 surfPos = -vViewPosition;
            float terrH = dot(texture2D(map, vCustomUv).rgb, vec3(0.299, 0.587, 0.114));
            vec3 sigX = dFdx(surfPos), sigY = dFdy(surfPos);
            vec3 vR1 = cross(sigY, normalizedNormal), vR2 = cross(normalizedNormal, sigX);
            float fDet = dot(sigX, vR1);
            vec3 vGrad = sign(fDet) * (dFdx(terrH) * vR1 + dFdy(terrH) * vR2);
            vec3 bumpedNormal = normalize(abs(fDet) * normalizedNormal - terrainDepth * vGrad);
            vec3 shadeNormal = mix(bumpedNormal, normalizedNormal, waterMask);
            vec3 cityLights = texture2D(nightBlendTexture, vCustomUv).rgb * gl_FragColor.rgb * nightLights;
            vec3 viewSunDir = normalize(vec3(-0.9, 0.18, 0.4));
            float ndl = dot(normalizedNormal, viewSunDir);
            float dayAmt = smoothstep(-0.05, 0.35, ndl);
            float relief = dot(shadeNormal, viewSunDir) - ndl;
            gl_FragColor.rgb *= clamp(1.0 + relief * terrainShade * dayAmt, 0.55, 1.6);
            float nightFactor  = smoothstep(0.18, -0.30, ndl);
            float lightsFactor = smoothstep(0.30, -0.35, ndl);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.08, nightFactor);
            gl_FragColor.rgb += cityLights * lightsFactor;
            vec3 halfDir = normalize(viewSunDir + viewDir);
            float ripple = snoise(vec3(vCustomUv * 240.0, time * 4.0));
            float ndh = max(dot(normalizedNormal, halfDir) + ripple * 0.02, 0.0);
            float glint = pow(ndh, 140.0);
            gl_FragColor.rgb += glint * waterMask * dayAmt * oceanGlint * vec3(1.0, 0.97, 0.88);
            `
          );
        };

        planetMesh.material = mat;
        planetGroup.add(planetMesh);

        // Land markers radar pings
        const markerCount = CONFIG.markerCount;
        const markerPos = new Float32Array(markerCount * 3);
        const markerSeeds = new Float32Array(markerCount);
        for (let i = 0; i < markerCount; i++) {
          const u = Math.random(), v = Math.random();
          const theta = u * 2.0 * Math.PI;
          const phi = Math.acos(2.0 * v - 1.0);
          const r = CONFIG.planetRadius * 1.014;
          markerPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
          markerPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
          markerPos[i * 3 + 2] = r * Math.cos(phi);
          markerSeeds[i] = Math.random() * 50.0;
        }

        const markerGeo = new THREE.BufferGeometry();
        markerGeo.setAttribute('position', new THREE.BufferAttribute(markerPos, 3));
        markerGeo.setAttribute('seed', new THREE.BufferAttribute(markerSeeds, 1));

        const markerMat = new THREE.ShaderMaterial({
          transparent: true,
          depthTest: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: {
            uTime: { value: 0 },
            uSpeed: { value: CONFIG.markerSpeed },
            uSize: { value: CONFIG.markerSize },
            uColor: { value: hexToVec3(CONFIG.markerColor) },
            uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
          },
          vertexShader: `
            attribute float seed; uniform float uSize; uniform vec2 uRes;
            varying float vSeed; varying float vFade;
            void main(){
              vSeed = seed;
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              vec3 vn = normalize(normalMatrix * normalize(position));
              vec3 vd = normalize(-mv.xyz);
              vFade = smoothstep(0.15, 0.5, dot(vn, vd));
              gl_PointSize = max(uSize * uRes.y / 900.0 * (7.0 / max(-mv.z, 1.0)), 2.0);
              gl_Position = projectionMatrix * mv;
            }
          `,
          fragmentShader: `
            uniform vec3 uColor; uniform float uTime; uniform float uSpeed;
            varying float vSeed; varying float vFade;
            void main(){
              if (vFade <= 0.001) discard;
              vec2 p = gl_PointCoord - 0.5;
              float d = length(p) * 2.0;
              if (d > 1.0) discard;
              float core = smoothstep(0.30, 0.0, d) * 1.2;
              float ph = fract(uTime * uSpeed + vSeed);
              float ring = smoothstep(0.07, 0.0, abs(d - ph)) * (1.0 - ph);
              gl_FragColor = vec4(uColor, clamp(core + ring, 0.0, 1.0) * vFade);
            }
          `
        });

        const markerPoints = new THREE.Points(markerGeo, markerMat);
        markerPoints.userData.isMarker = true;
        planetMesh.add(markerPoints);

        cloudGroup.visible = true;
      }
    });
  });

  // Animation Loop
  let lastTime = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    planetTime += dt / 12;
    cloudTime += dt / 20;
    starTime += dt;
    markerTime += dt;

    // Gentle continuous rotation
    spinPhase += dt * CONFIG.spin;
    planetGroup.rotation.y = CONFIG.initRotation + spinPhase;

    cloudGroup.children.forEach(c => {
      if (c.userData.spinKey) c.rotation.y += dt * CONFIG[c.userData.spinKey];
    });

    glowMesh.quaternion.copy(camera.quaternion);

    atmoMat.uniforms.uTime.value = now * CONFIG.atmoSpeed * 0.008;
    atmoPoints.position.copy(camera.position);
    starMat.uniforms.uTime.value = starTime;
    finalPassShader.uniforms.iTime.value = now * 0.001;

    planetGroup.traverse(node => {
      if (node.userData.isMarker && node.material && node.material.uniforms) {
        node.material.uniforms.uTime.value = markerTime;
      }
    });

    camera.layers.set(LAYERS.TORUS_SCENE);
    torusComposer.render();

    camera.layers.set(LAYERS.BLOOM_SCENE);
    bloomComposer.render();

    camera.layers.set(LAYERS.ENTIRE_SCENE);
    finalComposer.render();
  }
  requestAnimationFrame(animate);

  window.addEventListener('resize', () => {
    const nw = window.innerWidth, nh = window.innerHeight;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();

    renderer.setSize(nw, nh);
    const pr = Math.min(window.devicePixelRatio, 2);
    torusComposer.setSize(nw, nh);
    torusComposer.setPixelRatio(pr);
    bloomComposer.setSize(nw, nh);
    bloomComposer.setPixelRatio(pr);
    finalComposer.setSize(nw, nh);
    finalComposer.setPixelRatio(pr);

    const res = new THREE.Vector2(nw, nh);
    atmoMat.uniforms.uRes.value.copy(res);
    starMat.uniforms.uRes.value.copy(res);
    planetGroup.traverse(node => {
      if (node.userData.isMarker && node.material && node.material.uniforms) {
        node.material.uniforms.uRes.value.copy(res);
      }
    });
  });
}
