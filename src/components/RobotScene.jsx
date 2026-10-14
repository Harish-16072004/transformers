import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, PerspectiveCamera } from "@react-three/drei";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { Optimus } from "./Optimus";

const CAMERA_PRESETS = {
    hero: { pos: [0.55, 0.48, 3.85], lookAt: [0.35, 0.38, 0.0], fov: 30 },
    closeup: { pos: [0.18, 0.72, 2.35], lookAt: [-0.28, 0.68, 0.0], fov: 26 },
    full: { pos: [0.65, 0.12, 5.45], lookAt: [0.25, -0.15, 0.0], fov: 34 },
};

function CameraRig({ preset = "hero" }) {
    const targetPos = useRef(new THREE.Vector3(...CAMERA_PRESETS.hero.pos));
    const targetLook = useRef(new THREE.Vector3(...CAMERA_PRESETS.hero.lookAt));
    const currentLook = useRef(new THREE.Vector3(...CAMERA_PRESETS.hero.lookAt));

    useEffect(() => {
        const cfg = CAMERA_PRESETS[preset] || CAMERA_PRESETS.hero;
        targetPos.current.set(...cfg.pos);
        targetLook.current.set(...cfg.lookAt);
    }, [preset]);

    useFrame((state, delta) => {
        const step = Math.min(1, delta * 4.5);
        state.camera.position.lerp(targetPos.current, step);
        currentLook.current.lerp(targetLook.current, step);
        state.camera.lookAt(currentLook.current);
    });

    return <PerspectiveCamera makeDefault position={[0.55, 0.48, 3.85]} fov={30} />;
}

export function RobotScene({
    onReady,
    triggerClip,
    trackingEnabled,
    cameraPreset = "hero",
    onClipChange,
}) {
    const optimusRef = useRef(null);

    useEffect(() => {
        if (optimusRef.current && onReady) {
            onReady(optimusRef.current);
        }
    }, [onReady]);

    useEffect(() => {
        if (triggerClip && optimusRef.current) {
            optimusRef.current.playClip(triggerClip);
        }
    }, [triggerClip]);

    useEffect(() => {
        if (optimusRef.current) {
            optimusRef.current.setTrackingEnabled(trackingEnabled);
        }
    }, [trackingEnabled]);

    useEffect(() => {
        const handleMouse = (e) => {
            if (!optimusRef.current) return;
            const x = (e.clientX / window.innerWidth) * 2 - 1;
            const y = -(e.clientY / window.innerHeight) * 2 + 1;
            optimusRef.current.setCursorFocus(x, y);
        };
        window.addEventListener("mousemove", handleMouse, { passive: true });
        return () => window.removeEventListener("mousemove", handleMouse);
    }, []);

    return (
        <Canvas
            dpr={[1, 2]}
            gl={{
                antialias: true,
                alpha: false,
                powerPreference: "high-performance",
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.18,
            }}
            shadows
        >
            <color attach="background" args={["#04060c"]} />
            <fog attach="fog" args={["#04060c", 4.5, 13.5]} />

            <CameraRig preset={cameraPreset} />

            {/* Cinematic Bayverse / Knightverse 3-Point + Energon Rim Lighting */}
            <ambientLight intensity={0.28} color="#b8d0ff" />
            <directionalLight
                position={[-3.2, 5.2, 4.4]}
                intensity={2.2}
                color="#fff0dd"
                castShadow
                shadow-mapSize={[2048, 2048]}
            />
            <directionalLight position={[4.2, 3.0, 2.5]} intensity={1.0} color="#5ca4ff" />
            <directionalLight position={[0.0, 4.2, -4.2]} intensity={2.4} color="#00e5ff" />
            <pointLight position={[-0.4, 0.85, 1.8]} intensity={1.3} color="#00d8ff" distance={5.5} />
            <pointLight position={[-1.4, -0.5, 1.5]} intensity={0.75} color="#ff3d2e" distance={4.5} />

            <Suspense fallback={null}>
                <Optimus
                    ref={optimusRef}
                    position={[-0.42, -1.92, 0]}
                    scale={1.42}
                    onClipChange={onClipChange}
                />
                <Environment preset="city" />
            </Suspense>
        </Canvas>
    );
}
