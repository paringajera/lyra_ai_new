import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * PlasmaOrb
 * A reactive plasma sphere that pulses when listening or speaking
 */
export default function PlasmaOrb({ 
  blobConfig, 
  setBlobConfig, 
  isRecording,
  isSpeaking,
  onMouseDown,
  onMouseUp
}) {
  const mountRef = useRef(null);
  const containerRef = useRef(null);
  const matsRef = useRef({});

  // Drag state
  const isDragging = useRef(false);
  const dragStartOffset = useRef({ x: 0, y: 0 });

  // Update colors when config changes
  useEffect(() => {
    if (matsRef.current.plasmaMat && blobConfig?.color) {
      const c = new THREE.Color(blobConfig.color);
      matsRef.current.plasmaMat.uniforms.uColorBright.value = c;
      matsRef.current.shellFrontMat.uniforms.uColor.value = c;
    }
  }, [blobConfig?.color]);

  // Drag logic
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current || !containerRef.current) return;
      let newLeft = e.clientX - dragStartOffset.current.x;
      let newTop = e.clientY - dragStartOffset.current.y;
      
      // Prevent dragging off screen
      const maxX = window.innerWidth - containerRef.current.offsetWidth;
      const maxY = window.innerHeight - containerRef.current.offsetHeight;
      
      newLeft = Math.max(0, Math.min(newLeft, maxX));
      newTop = Math.max(0, Math.min(newTop, maxY));
      
      containerRef.current.style.left = `${newLeft}px`;
      containerRef.current.style.top = `${newTop}px`;
      containerRef.current.style.right = 'auto';
      containerRef.current.style.bottom = 'auto';
    };

    const handleMouseUp = () => {
      if (isDragging.current && containerRef.current) {
        isDragging.current = false;
        const rect = containerRef.current.getBoundingClientRect();
        if (setBlobConfig) {
          setBlobConfig(prev => ({
            ...prev,
            position: { left: rect.left, top: rect.top, right: 'auto', bottom: 'auto' }
          }));
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setBlobConfig]);

  const handleDragStart = (e) => {
    if (!containerRef.current) return;
    isDragging.current = true;
    const rect = containerRef.current.getBoundingClientRect();
    dragStartOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // Audio simulation
  const levelRef = useRef(0);
  const sensitivityRef = useRef(blobConfig?.sensitivity ?? 2.2);

  // Update sensitivity ref when config changes
  useEffect(() => {
    sensitivityRef.current = blobConfig?.sensitivity ?? 2.2;
  }, [blobConfig?.sensitivity]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // --- CONFIG ---
    const params = {
      timeScale: 1.2,
      rotationSpeedX: 0.002,
      rotationSpeedY: 0.005,
      plasmaScale: 0.2,
      plasmaBrightness: 1.31,
      voidThreshold: 0.09,
      colorDeep: 0x001433,
      colorMid: 0x0084ff,
      colorBright: 0x00ffe1,
      shellColor: 0x0066ff,
      shellOpacity: 0.41,
    };

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.z = 2.4;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25)); // Lower pixel ratio for performance
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    mount.appendChild(renderer.domElement);

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    const noiseFunctions = `
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
        const vec2  C = vec2(1.0/6.0, 1.0/3.0);
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }

      float fbm(vec3 p) {
        float total = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        for (int i = 0; i < 2; i++) {
          total += snoise(p * frequency) * amplitude;
          amplitude *= 0.5;
          frequency *= 2.0;
        }
        return total;
      }
    `;

    const pointLight = new THREE.PointLight(0x0088ff, 2.0, 10);
    mainGroup.add(pointLight);

    const shellGeo = new THREE.SphereGeometry(1.0, 32, 32); // Reduced from 64x64
    const shellShader = {
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        uniform float uTime;
        uniform float uAudio;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec3 pos = position;
          float displacement = sin(pos.y * 15.0 + uTime * 10.0) * cos(pos.x * 15.0 + uTime * 10.0) * 0.08 * uAudio;
          pos += normal * displacement;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        uniform vec3 uColor;
        uniform float uOpacity;
        void main() {
          float fresnel = pow(1.0 - dot(normalize(vNormal), normalize(vViewPosition)), 2.5);
          gl_FragColor = vec4(uColor, fresnel * uOpacity);
        }
      `,
    };

    const shellBackMat = new THREE.ShaderMaterial({
      vertexShader: shellShader.vertexShader,
      fragmentShader: shellShader.fragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color(0x000055) },
        uOpacity: { value: 0.3 },
        uTime: { value: 0 },
        uAudio: { value: 0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });

    const shellFrontMat = new THREE.ShaderMaterial({
      vertexShader: shellShader.vertexShader,
      fragmentShader: shellShader.fragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color(params.shellColor) },
        uOpacity: { value: params.shellOpacity },
        uTime: { value: 0 },
        uAudio: { value: 0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      depthWrite: false,
    });

    mainGroup.add(new THREE.Mesh(shellGeo, shellBackMat));
    mainGroup.add(new THREE.Mesh(shellGeo, shellFrontMat));

    const plasmaGeo = new THREE.SphereGeometry(0.998, 48, 48); // Reduced from 128x128
    const plasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: params.plasmaScale },
        uBrightness: { value: params.plasmaBrightness },
        uThreshold: { value: params.voidThreshold },
        uColorDeep: { value: new THREE.Color(params.colorDeep) },
        uColorMid: { value: new THREE.Color(params.colorMid) },
        uColorBright: { value: new THREE.Color(params.colorBright) },
        uAudio: { value: 0 },
      },
      vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        uniform float uTime;
        uniform float uAudio;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec3 pos = position;
          float displacement = sin(pos.y * 15.0 + uTime * 10.0) * cos(pos.x * 15.0 + uTime * 10.0) * 0.08 * uAudio;
          pos += normal * displacement;
          vPosition = pos;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uScale;
        uniform float uBrightness;
        uniform float uThreshold;
        uniform float uAudio;
        uniform vec3 uColorDeep;
        uniform vec3 uColorMid;
        uniform vec3 uColorBright;
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        ${noiseFunctions}
        void main() {
          vec3 p = vPosition * uScale;
          p += normalize(p) * sin(length(p) * 20.0 - uTime * 15.0) * uAudio * 0.8;
          vec3 q = vec3(
            fbm(p + vec3(0.0, uTime * 0.05, 0.0)),
            fbm(p + vec3(5.2, 1.3, 2.8) + uTime * 0.05),
            fbm(p + vec3(2.2, 8.4, 0.5) - uTime * 0.02)
          );
          float density = fbm(p + 2.0 * q);
          float t = (density + 0.4) * 0.8;
          float alpha = smoothstep(uThreshold, 0.7, t);
          vec3 cWhite = vec3(1.0, 1.0, 1.0);
          vec3 color = mix(uColorDeep, uColorMid, smoothstep(uThreshold, 0.5, t));
          color = mix(color, uColorBright, smoothstep(0.5, 0.8, t));
          color = mix(color, cWhite, smoothstep(0.8, 1.0, t));
          float facing = dot(normalize(vNormal), normalize(vViewPosition));
          float depthFactor = (facing + 1.0) * 0.5;
          float finalAlpha = alpha * (0.02 + 0.98 * depthFactor);
          gl_FragColor = vec4(color * uBrightness, finalAlpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const plasmaMesh = new THREE.Mesh(plasmaGeo, plasmaMat);
    mainGroup.add(plasmaMesh);

    const pCount = 300; // Reduced from 1500
    const pPos = new Float32Array(pCount * 3);
    const pSizes = new Float32Array(pCount);
    const sphereRadius = 0.95;
    for (let i = 0; i < pCount; i++) {
      const r = sphereRadius * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pPos[i * 3 + 2] = r * Math.cos(phi);
      pSizes[i] = Math.random();
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute("aSize", new THREE.BufferAttribute(pSizes, 1));

    const pMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAudio: { value: 0 },
        uColor: { value: new THREE.Color(0xffffff) },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uAudio;
        attribute float aSize;
        varying float vAlpha;
        void main() {
          vec3 pos = position;
          float speed = uTime * (0.2 + uAudio * 1.0);
          pos.y += sin(speed + pos.x * 5.0) * 0.03 * (1.0 + uAudio * 1.5);
          pos.x += cos(speed * 0.75 + pos.z * 5.0) * 0.03 * (1.0 + uAudio * 1.5);
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          float baseSize = 6.0 * aSize + 4.0;
          baseSize *= (1.0 + uAudio * 1.0);
          gl_PointSize = baseSize * (1.0 / -mvPosition.z);
          
          vAlpha = 0.5 + 0.5 * sin(uTime * 3.0 + aSize * 10.0);
          vAlpha = min(1.0, vAlpha + uAudio);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float dist = length(uv);
          if (dist > 0.5) discard;
          float glow = 1.0 - (dist * 2.0);
          glow = pow(glow, 1.8);
          gl_FragColor = vec4(uColor, glow * vAlpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(pGeo, pMat);
    mainGroup.add(particles);

    const clock = new THREE.Clock();
    let rafId;

    function animate() {
      rafId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Use the levelRef (simulated audio activity) scaled by sensitivity
      const level = levelRef.current * (sensitivityRef.current / 2.2);
      const targetScale = 1.0 + Math.sin(t * 1.5) * 0.015 + level * 0.35;
      const cur = mainGroup.scale.x;
      const next = cur + (targetScale - cur) * 0.08;
      mainGroup.scale.setScalar(next);

      plasmaMat.uniforms.uAudio.value = level;
      plasmaMat.uniforms.uBrightness.value = params.plasmaBrightness + level * 1.5;
      plasmaMat.uniforms.uTime.value = t * (params.timeScale + level * 2.0);
      shellFrontMat.uniforms.uTime.value = t;
      shellFrontMat.uniforms.uAudio.value = level;
      shellBackMat.uniforms.uTime.value = t;
      shellBackMat.uniforms.uAudio.value = level;
      pMat.uniforms.uTime.value = t;
      pMat.uniforms.uAudio.value = level;

      plasmaMesh.rotation.y = t * 0.08;
      mainGroup.rotation.x += params.rotationSpeedX;
      mainGroup.rotation.y += params.rotationSpeedY;

      renderer.render(scene, camera);
    }
    animate();

    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(mount);

    matsRef.current = { plasmaMat, shellFrontMat };

    mount._cleanup = () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      renderer.dispose();
      plasmaGeo.dispose();
      shellGeo.dispose();
      pGeo.dispose();
      plasmaMat.dispose();
      shellBackMat.dispose();
      shellFrontMat.dispose();
      pMat.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };

    return () => {
      if (mount._cleanup) mount._cleanup();
    };
  }, []);

  // Update levelRef based on isSpeaking or isRecording props
  useEffect(() => {
    let animationFrame;
    const updateLevel = () => {
      let targetLevel = 0;
      if (isSpeaking || isRecording) {
        // Create a random fluctuating level to simulate talking or listening
        targetLevel = 0.4 + Math.random() * 0.5;
      }
      
      // Smooth out the transition
      levelRef.current += (targetLevel - levelRef.current) * 0.15;
      
      animationFrame = requestAnimationFrame(updateLevel);
    };
    
    updateLevel();
    return () => cancelAnimationFrame(animationFrame);
  }, [isSpeaking, isRecording]);

  return (
    <div
      ref={containerRef}
      onMouseDown={(e) => {
        handleDragStart(e);
        if (onMouseDown) onMouseDown(e);
      }}
      onMouseUp={(e) => {
        if (onMouseUp) onMouseUp(e);
      }}
      onMouseLeave={(e) => {
        if (onMouseUp) onMouseUp(e);
      }}
      style={{
        position: "fixed",
        ...(blobConfig?.position || { bottom: 30, right: 30 }),
        width: `${blobConfig?.size || 180}px`,
        height: `${blobConfig?.size || 180}px`,
        background: "transparent",
        overflow: "visible",
        zIndex: 9999,
        cursor: "grab",
        border: blobConfig?.isDraggingMode ? "2px dashed rgba(0, 255, 225, 0.5)" : "none",
        borderRadius: "50%",
        boxShadow: isRecording ? "0 0 30px rgba(0, 255, 255, 0.6)" : "none",
        transition: "box-shadow 0.3s ease"
      }}
    >
      <div
        ref={mountRef}
        style={{ width: "100%", height: "100%", cursor: "pointer" }}
        role="button"
        tabIndex={0}
      />
    </div>
  );
}
