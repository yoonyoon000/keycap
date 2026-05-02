import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';
import './styles.css';

const COLORS = {
  transparent: { main: '#f8d8ff', opacity: 0.42, roughness: 0.08, transmission: 0.55 },
  pink: { main: '#ff8fcb', opacity: 0.82, roughness: 0.28 },
  blue: { main: '#84d8ff', opacity: 0.82, roughness: 0.25 },
  yellow: { main: '#ffe77a', opacity: 0.84, roughness: 0.22 },
  purple: { main: '#c7a6ff', opacity: 0.82, roughness: 0.25 },
  'clear gray': { main: '#cfd2dc', opacity: 0.46, roughness: 0.12, transmission: 0.35 }
};

const SHAPES = {
  single: [{ x: 0, y: 0 }],
  double: [{ x: -0.62, y: 0 }, { x: 0.62, y: 0 }],
  tetris: [{ x: -0.58, y: 0.42 }, { x: 0, y: 0.42 }, { x: 0.58, y: 0.42 }, { x: 0, y: -0.22 }]
};

const shapeLabels = {
  single: '1 key',
  double: '2 keys',
  tetris: 'T block'
};

const tabs = ['Shape', 'Color', 'Light', 'Sound', 'Sticker'];
const lightModes = ['OFF', 'ON', 'Breath', 'Blink'];
const soundModes = ['soft click', 'mechanical click', 'bubble click', 'mute'];

function App() {
  const [started, setStarted] = useState(false);
  const [tab, setTab] = useState('Shape');
  const [selectedShape, setSelectedShape] = useState('single');
  const [selectedColor, setSelectedColor] = useState('transparent');
  const [selectedLight, setSelectedLight] = useState('OFF');
  const [selectedSound, setSelectedSound] = useState('soft click');
  const [stickerImage, setStickerImage] = useState(null);
  const [stickerTransform, setStickerTransform] = useState({ x: 0, y: 0, scale: 1, rotation: 0 });
  const webglAvailable = useWebglAvailable();
  const [forceFallback, setForceFallback] = useState(false);
  const soundRef = useRef(null);

  useEffect(() => {
    soundRef.current = createClickPlayer();
  }, []);

  const playSound = (sound = selectedSound) => {
    soundRef.current?.(sound);
  };

  const setStickerValue = (key, value) => {
    setStickerTransform((current) => ({ ...current, [key]: Number(value) }));
  };
  const useThreePreview = webglAvailable && !forceFallback;

  if (!started) {
    return <StartScreen onStart={() => setStarted(true)} />;
  }

  return (
    <main className="app-shell">
      <section className="maker-window">
        <WindowBar title="KEYCAP_MAKER.EXE" />
        <div className="preview-wrap">
          <div className="corner-folder">CUSTOM</div>
          {useThreePreview ? (
            <PreviewErrorBoundary
              resetKey={`${selectedShape}-${selectedColor}-${selectedLight}-${tab}`}
              onPreviewError={() => setForceFallback(true)}
              fallback={
                <FallbackPreview
                  selectedShape={selectedShape}
                  selectedColor={selectedColor}
                  selectedLight={selectedLight}
                  stickerImage={stickerImage}
                  stickerTransform={stickerTransform}
                  tab={tab}
                  playSound={playSound}
                />
              }
            >
              <ThreePreview
                tab={tab}
                selectedShape={selectedShape}
                selectedColor={selectedColor}
                selectedLight={selectedLight}
                stickerImage={stickerImage}
                stickerTransform={stickerTransform}
                playSound={playSound}
                onContextLost={() => setForceFallback(true)}
              />
            </PreviewErrorBoundary>
          ) : (
            <FallbackPreview
              selectedShape={selectedShape}
              selectedColor={selectedColor}
              selectedLight={selectedLight}
              stickerImage={stickerImage}
              stickerTransform={stickerTransform}
              tab={tab}
              playSound={playSound}
            />
          )}
          {tab === 'Sticker' ? <div className="mode-chip">FRONT EDIT</div> : <div className="mode-chip">{useThreePreview ? 'DRAG / ZOOM' : '2.5D VIEW'}</div>}
        </div>
        <ControlPanel
          tab={tab}
          setTab={setTab}
          selectedShape={selectedShape}
          setSelectedShape={setSelectedShape}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
          selectedLight={selectedLight}
          setSelectedLight={setSelectedLight}
          selectedSound={selectedSound}
          setSelectedSound={(sound) => {
            setSelectedSound(sound);
            playSound(sound);
          }}
          stickerImage={stickerImage}
          setStickerImage={setStickerImage}
          stickerTransform={stickerTransform}
          setStickerValue={setStickerValue}
          setStickerTransform={setStickerTransform}
        />
      </section>
    </main>
  );
}

class PreviewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, resetKey: props.resetKey };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey && !state.hasError) {
      return { resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch() {
    this.props.onPreviewError?.();
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function useWebglAvailable() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setAvailable(false);
        return;
      }

      const originalError = console.error;
      const originalWarn = console.warn;
      let renderer;

      try {
        console.error = () => {};
        console.warn = () => {};
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'default' });
        setAvailable(true);
      } catch {
        setAvailable(false);
      } finally {
        renderer?.dispose();
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        console.error = originalError;
        console.warn = originalWarn;
      }
    } catch {
      setAvailable(false);
    }
  }, []);

  return available;
}

function ThreePreview({ tab, selectedShape, selectedColor, selectedLight, stickerImage, stickerTransform, playSound, onContextLost }) {
  return (
    <Canvas
      camera={{ position: [0, 0.15, 5.2], fov: 40 }}
      dpr={[1, 1.7]}
      gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
      onPointerDown={() => tab !== 'Sticker' && playSound()}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          onContextLost?.();
        }, false);
      }}
    >
      <Suspense fallback={<Html center><span className="loading-text">loading...</span></Html>}>
        <SceneLights />
        <KeycapModel
          shape={selectedShape}
          color={selectedColor}
          light={selectedLight}
          stickerImage={stickerImage}
          stickerTransform={stickerTransform}
          frontMode={tab === 'Sticker'}
        />
        <OrbitControls
          enabled={tab !== 'Sticker'}
          enablePan={false}
          minDistance={3.5}
          maxDistance={7}
          rotateSpeed={0.75}
          zoomSpeed={0.55}
        />
      </Suspense>
    </Canvas>
  );
}

function FallbackPreview({ selectedShape, selectedColor, selectedLight, stickerImage, stickerTransform, tab, playSound }) {
  const color = COLORS[selectedColor];
  const blocks = SHAPES[selectedShape];
  const bounds = useMemo(() => getShapeBounds(blocks), [blocks]);
  const ringX = 50 + (bounds.maxX / Math.max(bounds.width, 2.1)) * 38 + 18;

  return (
    <button
      className={`fallback-preview light-${selectedLight.toLowerCase()}`}
      type="button"
      onClick={() => tab !== 'Sticker' && playSound()}
      aria-label="keycap preview"
    >
      <span className="fallback-base" />
      <span className="fallback-ring" style={{ left: `${ringX}%` }} />
      <span
        className="fallback-keycap-group"
        style={{
          width: `${Math.max(bounds.width, 1) * 68}px`,
          height: `${Math.max(bounds.height, 1) * 68}px`
        }}
      >
        {blocks.map((block, index) => {
          const left = ((block.x - bounds.minX - 0.5) / bounds.width) * 100;
          const top = ((bounds.maxY - block.y - 0.5) / bounds.height) * 100;
          return (
            <span
              key={`${block.x}-${block.y}`}
              className="fallback-keycap"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                backgroundColor: color.main,
                opacity: selectedColor.includes('clear') || selectedColor === 'transparent' ? 0.72 : 1
              }}
            >
              {index === 0 && stickerImage && (
                <img
                  alt=""
                  src={stickerImage}
                  className="fallback-sticker"
                  style={{
                    transform: `translate(${stickerTransform.x * 90}px, ${-stickerTransform.y * 90}px) rotate(${stickerTransform.rotation}deg) scale(${stickerTransform.scale})`
                  }}
                />
              )}
            </span>
          );
        })}
      </span>
    </button>
  );
}

function StartScreen({ onStart }) {
  return (
    <main className="start-shell">
      <section className="start-window">
        <WindowBar title="WELCOME.BAT" />
        <div className="start-body">
          <div className="pixel-stars" aria-hidden="true">
            <span>*</span><span>+</span><span>*</span>
          </div>
          <h1>KEYCAP MAKER</h1>
          <p>make your tiny keyring</p>
          <button className="pixel-button start-button" onClick={onStart}>Start</button>
        </div>
      </section>
      <div className="error-pop">
        <WindowBar title="tiny_note" compact />
        <span>ready?</span>
      </div>
    </main>
  );
}

function WindowBar({ title, compact = false }) {
  return (
    <div className={compact ? 'window-bar compact' : 'window-bar'}>
      <span>{title}</span>
      <div className="window-dots">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

function SceneLights() {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[3, 3, 4]} intensity={1.8} />
      <pointLight position={[-3, -1, 2]} intensity={1.2} color="#ffb6da" />
    </>
  );
}

function KeycapModel({ shape, color, light, stickerImage, stickerTransform, frontMode }) {
  const groupRef = useRef();
  const glowRef = useRef();
  const { camera } = useThree();
  const materialData = COLORS[color];
  const blocks = SHAPES[shape];
  const stickerTexture = useStickerTexture(stickerImage);
  const bounds = useMemo(() => getShapeBounds(blocks), [blocks]);
  const ringX = bounds.maxX + 0.88;

  useEffect(() => {
    if (frontMode) {
      groupRef.current.rotation.set(0, 0, 0);
      camera.position.set(0, 0.1, 5.2);
      camera.lookAt(0, 0, 0);
    }
  }, [frontMode, camera]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    if (!frontMode) groupRef.current.rotation.y += 0.0025;
    if (glowRef.current) {
      const t = clock.elapsedTime;
      let intensity = 0;
      if (light === 'ON') intensity = 0.9;
      if (light === 'Breath') intensity = 0.35 + Math.sin(t * 2.3) * 0.28 + 0.35;
      if (light === 'Blink') intensity = Math.sin(t * 8) > 0 ? 1.15 : 0.06;
      glowRef.current.material.opacity = intensity * 0.42;
      glowRef.current.scale.setScalar(1 + intensity * 0.12);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.05, 0]}>
      <RoundedBox args={[bounds.width + 1.1, bounds.height + 0.82, 0.22]} radius={0.13} smoothness={8} position={[0.18, 0.08, -0.34]}>
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.24} roughness={0.18} transmission={0.25} />
      </RoundedBox>
      <Keyring x={ringX} />
      {blocks.map((block, index) => (
        <group key={`${block.x}-${block.y}`} position={[block.x, block.y, 0]}>
          <RoundedBox args={[1, 1, 0.54]} radius={0.18} smoothness={14} position={[0, 0, 0]}>
            <meshPhysicalMaterial
              color={materialData.main}
              transparent
              opacity={materialData.opacity}
              roughness={materialData.roughness}
              transmission={materialData.transmission || 0}
              thickness={0.8}
              clearcoat={0.7}
              clearcoatRoughness={0.12}
              emissive={light === 'OFF' ? '#000000' : materialData.main}
              emissiveIntensity={light === 'OFF' ? 0 : 0.2}
            />
          </RoundedBox>
          <RoundedBox args={[0.72, 0.72, 0.12]} radius={0.16} smoothness={12} position={[0, 0.03, 0.32]}>
            <meshPhysicalMaterial color="#fff7ff" transparent opacity={0.26} roughness={0.1} />
          </RoundedBox>
          {index === 0 && stickerTexture && (
            <StickerPlane texture={stickerTexture} transform={stickerTransform} />
          )}
        </group>
      ))}
      <mesh ref={glowRef} position={[0, 0.05, 0.36]}>
        <planeGeometry args={[bounds.width + 0.75, bounds.height + 0.56]} />
        <meshBasicMaterial color={materialData.main} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

function Keyring({ x }) {
  return (
    <group position={[x, 0.16, -0.25]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <torusGeometry args={[0.26, 0.045, 12, 36]} />
        <meshStandardMaterial color="#f7f7fb" roughness={0.2} metalness={0.25} />
      </mesh>
      <mesh position={[-0.28, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.48, 14]} />
        <meshStandardMaterial color="#f7f7fb" roughness={0.22} metalness={0.18} />
      </mesh>
    </group>
  );
}

function StickerPlane({ texture, transform }) {
  const radians = THREE.MathUtils.degToRad(transform.rotation);
  return (
    <mesh position={[transform.x, transform.y, 0.395]} rotation={[0, 0, radians]} scale={[transform.scale, transform.scale, 1]}>
      <planeGeometry args={[0.55, 0.55]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}

function useStickerTexture(stickerImage) {
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    if (!stickerImage) {
      setTexture(null);
      return;
    }
    const loader = new THREE.TextureLoader();
    loader.load(stickerImage, (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.needsUpdate = true;
      setTexture(loaded);
    });
  }, [stickerImage]);

  return texture;
}

function getShapeBounds(blocks) {
  const xs = blocks.map((block) => block.x);
  const ys = blocks.map((block) => block.y);
  const minX = Math.min(...xs) - 0.5;
  const maxX = Math.max(...xs) + 0.5;
  const minY = Math.min(...ys) - 0.5;
  const maxY = Math.max(...ys) + 0.5;
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function ControlPanel(props) {
  return (
    <section className="panel">
      <nav className="tabs">
        {tabs.map((tabName) => (
          <button
            key={tabName}
            className={props.tab === tabName ? 'tab active' : 'tab'}
            onClick={() => props.setTab(tabName)}
          >
            {tabName}
          </button>
        ))}
      </nav>
      <div className="panel-body">
        {props.tab === 'Shape' && <ShapePanel {...props} />}
        {props.tab === 'Color' && <ColorPanel {...props} />}
        {props.tab === 'Light' && <LightPanel {...props} />}
        {props.tab === 'Sound' && <SoundPanel {...props} />}
        {props.tab === 'Sticker' && <StickerPanel {...props} />}
      </div>
    </section>
  );
}

function ShapePanel({ selectedShape, setSelectedShape }) {
  return (
    <div className="option-grid shape-grid">
      {Object.keys(SHAPES).map((shape) => (
        <button key={shape} className={selectedShape === shape ? 'option-card selected' : 'option-card'} onClick={() => setSelectedShape(shape)}>
          <ShapeIcon shape={shape} />
          <span>{shapeLabels[shape]}</span>
        </button>
      ))}
    </div>
  );
}

function ShapeIcon({ shape }) {
  return (
    <span className={`shape-icon ${shape}`}>
      {SHAPES[shape].map((block) => <i key={`${block.x}-${block.y}`} style={{ '--x': block.x, '--y': block.y }} />)}
    </span>
  );
}

function ColorPanel({ selectedColor, setSelectedColor }) {
  return (
    <div className="swatch-grid">
      {Object.keys(COLORS).map((name) => (
        <button key={name} className={selectedColor === name ? 'swatch selected' : 'swatch'} onClick={() => setSelectedColor(name)}>
          <span style={{ background: COLORS[name].main, opacity: COLORS[name].opacity }} />
          <b>{name}</b>
        </button>
      ))}
    </div>
  );
}

function LightPanel({ selectedLight, setSelectedLight }) {
  return (
    <div className="option-grid two-col">
      {lightModes.map((mode) => (
        <button key={mode} className={selectedLight === mode ? 'pixel-button selected' : 'pixel-button'} onClick={() => setSelectedLight(mode)}>
          {mode}
        </button>
      ))}
    </div>
  );
}

function SoundPanel({ selectedSound, setSelectedSound }) {
  return (
    <div className="option-grid sound-grid">
      {soundModes.map((sound) => (
        <button key={sound} className={selectedSound === sound ? 'pixel-button selected' : 'pixel-button'} onClick={() => setSelectedSound(sound)}>
          {sound}
        </button>
      ))}
    </div>
  );
}

function StickerPanel({ stickerImage, setStickerImage, stickerTransform, setStickerValue, setStickerTransform }) {
  const fileRef = useRef(null);

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStickerImage(URL.createObjectURL(file));
    setStickerTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
  };

  return (
    <div className="sticker-panel">
      <div className="sticker-actions">
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} hidden />
        <button className="pixel-button" onClick={() => fileRef.current?.click()}>Upload</button>
        <button
          className="pixel-button"
          disabled={!stickerImage}
          onClick={() => {
            setStickerImage(null);
            setStickerTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
          }}
        >
          Delete
        </button>
      </div>
      <div className="sliders">
        <Range label="X" min="-0.36" max="0.36" step="0.01" value={stickerTransform.x} onChange={(value) => setStickerValue('x', value)} />
        <Range label="Y" min="-0.36" max="0.36" step="0.01" value={stickerTransform.y} onChange={(value) => setStickerValue('y', value)} />
        <Range label="Size" min="0.35" max="1.45" step="0.01" value={stickerTransform.scale} onChange={(value) => setStickerValue('scale', value)} />
        <Range label="Turn" min="-180" max="180" step="1" value={stickerTransform.rotation} onChange={(value) => setStickerValue('rotation', value)} />
      </div>
    </div>
  );
}

function Range({ label, value, onChange, ...props }) {
  return (
    <label className="range-row">
      <span>{label}</span>
      <input type="range" value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
  );
}

function createClickPlayer() {
  let context;
  const ensureContext = () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    context ||= new AudioContextClass();
    return context;
  };

  return (mode) => {
    if (mode === 'mute') return;
    const audio = ensureContext();
    if (!audio) return;
    audio.resume?.();
    const now = audio.currentTime;
    const gain = audio.createGain();
    gain.connect(audio.destination);

    if (mode === 'bubble click') {
      [420, 760].forEach((freq, index) => {
        const osc = audio.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.045);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.22, now + 0.015 + index * 0.045);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16 + index * 0.045);
        osc.connect(gain);
        osc.start(now + index * 0.045);
        osc.stop(now + 0.18 + index * 0.045);
      });
      return;
    }

    const osc = audio.createOscillator();
    osc.type = mode === 'mechanical click' ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(mode === 'mechanical click' ? 1150 : 680, now);
    osc.frequency.exponentialRampToValueAtTime(mode === 'mechanical click' ? 220 : 420, now + 0.045);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(mode === 'mechanical click' ? 0.28 : 0.16, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (mode === 'mechanical click' ? 0.07 : 0.12));
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.14);
  };
}

createRoot(document.getElementById('root')).render(<App />);
