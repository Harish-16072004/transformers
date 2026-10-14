import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
} from "react";
import * as THREE from "three";

const CLIP_MAP = {
    idle: "Idle",
    look: "Look",
    coverEyes: "CoverEyes",
    uncoverEyes: "UncoverEyes",
    loginSuccess: "LoginSuccess",
    loginError: "LoginError",
};

const MODEL_PATH = "/models/optimus_lod0.glb";

const _tempEuler = new THREE.Euler(0, 0, 0, "YXZ");
const _tempQuat = new THREE.Quaternion();

export const Optimus = forwardRef(function Optimus(
    {
        position = [-0.42, -1.92, 0],
        scale = 1.42,
        onClipChange,
    },
    ref
) {
    const { scene, animations: gltfAnimations } = useGLTF(MODEL_PATH);
    const { actions, mixer } = useAnimations(gltfAnimations, scene);

    const group = useRef(null);
    const currentClip = useRef("Idle");
    const isEyesCovered = useRef(false);
    const trackingEnabled = useRef(true);
    const finishListener = useRef(null);

    const targetHead = useRef({ x: 0, y: 0 });
    const currentHead = useRef({ x: 0, y: 0 });

    const bones = useRef({});
    const restTransforms = useRef({});
    const normalizedOffset = useRef(0);

    /*
     * Enhance movie PBR materials + cache bones for head tracking.
     */
    useEffect(() => {
        bones.current = {};
        restTransforms.current = {};

        scene.traverse((object) => {
            if (object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true;
                if (object.material) {
                    object.material.envMapIntensity = 1.35;
                    const matName = object.material.name || "";
                    if (
                        matName.includes("EyeGlow") ||
                        matName.includes("CyanGlow") ||
                        object.name.startsWith("Eye_")
                    ) {
                        if (!object.name.endsWith("_Lid")) {
                            object.material.emissive = new THREE.Color("#29e3ff");
                            object.material.emissiveIntensity = 2.8;
                        }
                    }
                }
            }

            if (!object.isBone) return;

            restTransforms.current[object.name] = {
                position: object.position.clone(),
                quaternion: object.quaternion.clone(),
            };

            if (object.name === "Head") bones.current.head = object;
            if (object.name === "Neck") bones.current.neck = object;
            if (object.name === "Chest") bones.current.chest = object;
            if (object.name === "Eye_L") bones.current.eyeL = object;
            if (object.name === "Eye_R") bones.current.eyeR = object;
        });

        const headBone = bones.current.head;
        if (headBone) {
            const worldPos = new THREE.Vector3();
            scene.updateMatrixWorld(true);
            headBone.getWorldPosition(worldPos);
            if (worldPos.y > 1.88) {
                normalizedOffset.current = -0.22;
            } else {
                normalizedOffset.current = 0.0;
            }
        }
    }, [scene]);

    /*
     * Start Idle animation on mount.
     */
    useEffect(() => {
        const idleAction = actions?.Idle;
        if (idleAction) {
            idleAction.reset();
            idleAction.setLoop(THREE.LoopRepeat, Infinity);
            idleAction.fadeIn(0.25);
            idleAction.play();
        }

        return () => {
            mixer?.stopAllAction();
        };
    }, [actions, mixer]);

    /*
     * Cleanly transition between clips:
     * - CoverEyes: plays once and CLAMPS at frame end (hands covering eyes) until UncoverEyes.
     * - UncoverEyes: plays once and crossfades back into Idle upon completion.
     * - LoginSuccess / LoginError / Look: plays once and returns to CoverEyes (if covered) or Idle.
     */
    const playAnimation = (clipState) => {
        const clipName = CLIP_MAP[clipState] || clipState;
        if (!clipName || !actions) return;

        const targetAction = actions[clipName];
        if (!targetAction || !mixer) return;

        // Never allow "Look" to interrupt CoverEyes or UncoverEyes
        if (clipName === "Look" && (currentClip.current === "CoverEyes" || currentClip.current === "UncoverEyes" || isEyesCovered.current)) {
            return;
        }

        if (clipName === "CoverEyes") {
            isEyesCovered.current = true;
        } else if (clipName === "UncoverEyes" || clipName === "Idle") {
            isEyesCovered.current = false;
        }

        currentClip.current = clipName;
        if (onClipChange) onClipChange(clipName);

        // Remove any previous finished listener
        if (finishListener.current) {
            mixer.removeEventListener("finished", finishListener.current);
            finishListener.current = null;
        }

        // Fade out any other actions (do not skip clamped ones)
        Object.entries(actions).forEach(([otherName, otherAction]) => {
            if (otherAction && otherName !== clipName) {
                otherAction.fadeOut(0.2);
            }
        });

        const isHoldClip = clipName === "CoverEyes";
        const isTransientOneShot = [
            "UncoverEyes",
            "LoginSuccess",
            "LoginError",
            "Look",
        ].includes(clipName);

        targetAction.reset();
        targetAction.enabled = true;
        targetAction.setEffectiveTimeScale(1);
        targetAction.setEffectiveWeight(1);

        if (isHoldClip) {
            // CoverEyes: play once and clamp (hands stay over eyes)
            targetAction.setLoop(THREE.LoopOnce, 1);
            targetAction.clampWhenFinished = true;
            targetAction.fadeIn(0.2);
            targetAction.play();
        } else if (isTransientOneShot) {
            targetAction.setLoop(THREE.LoopOnce, 1);
            targetAction.clampWhenFinished = true;
            targetAction.fadeIn(0.2);
            targetAction.play();

            const handleFinished = (event) => {
                if (event.action !== targetAction) return;
                mixer.removeEventListener("finished", handleFinished);
                finishListener.current = null;

                // If eyes should remain covered after a Look/Error clip, restore CoverEyes clamped pose
                if (isEyesCovered.current && clipName !== "UncoverEyes" && actions.CoverEyes) {
                    const coverAct = actions.CoverEyes;
                    targetAction.fadeOut(0.22);
                    coverAct.reset();
                    coverAct.setLoop(THREE.LoopOnce, 1);
                    coverAct.clampWhenFinished = true;
                    coverAct.time = coverAct.getClip().duration;
                    coverAct.fadeIn(0.22);
                    coverAct.play();
                    currentClip.current = "CoverEyes";
                    if (onClipChange) onClipChange("CoverEyes");
                    return;
                }

                // Stop all other one-shot clips cleanly so no clamped weights linger
                Object.entries(actions).forEach(([name, act]) => {
                    if (act && name !== "Idle") {
                        act.stop();
                        act.enabled = false;
                    }
                });

                // Return model to pure Idle state
                const idle = actions.Idle;
                if (idle) {
                    idle.reset();
                    idle.enabled = true;
                    idle.setEffectiveWeight(1);
                    idle.setLoop(THREE.LoopRepeat, Infinity);
                    idle.fadeIn(0.2);
                    idle.play();
                }
                currentClip.current = "Idle";
                if (onClipChange) onClipChange("Idle");
            };

            finishListener.current = handleFinished;
            mixer.addEventListener("finished", handleFinished);
        } else {
            // Idle
            isEyesCovered.current = false;
            Object.entries(actions).forEach(([name, act]) => {
                if (act && name !== "Idle") {
                    act.stop();
                    act.enabled = false;
                }
            });
            targetAction.reset();
            targetAction.enabled = true;
            targetAction.setEffectiveWeight(1);
            targetAction.setLoop(THREE.LoopRepeat, Infinity);
            targetAction.clampWhenFinished = false;
            targetAction.fadeIn(0.2);
            targetAction.play();
        }
    };

    useImperativeHandle(
        ref,
        () => ({
            playClip(state) {
                playAnimation(state);
            },
            setCursorFocus(x, y) {
                // Optimus face is around (-0.35, 0.12) in NDC
                // Calculate direction vector from face to cursor
                const dx = Math.max(-1, Math.min(1, (x + 0.35) * 0.95));
                const dy = Math.max(-1, Math.min(1, (y - 0.12) * 1.1));
                targetHead.current.x = dx;
                targetHead.current.y = dy;
            },
            setTrackingEnabled(enabled) {
                trackingEnabled.current = !!enabled;
            },
            getCurrentLOD() {
                return "lod0";
            },
            isCoveringEyes() {
                return isEyesCovered.current;
            },
        }),
        [actions, mixer]
    );

    useFrame((state, delta) => {
        if (!group.current) return;

        const canTrack =
            trackingEnabled.current &&
            !isEyesCovered.current &&
            (currentClip.current === "Idle" || currentClip.current === "Look");

        const goalX = canTrack ? targetHead.current.x : 0;
        const goalY = canTrack ? targetHead.current.y : 0;

        const speed = Math.min(1, delta * 7.0);
        currentHead.current.x += (goalX - currentHead.current.x) * speed;
        currentHead.current.y += (goalY - currentHead.current.y) * speed;

        if (bones.current.head) {
            _tempEuler.set(-currentHead.current.y * 0.24, currentHead.current.x * 0.36, 0, "YXZ");
            bones.current.head.quaternion.setFromEuler(_tempEuler);
        }

        if (bones.current.neck) {
            _tempEuler.set(-currentHead.current.y * 0.08, currentHead.current.x * 0.12, 0, "YXZ");
            bones.current.neck.quaternion.setFromEuler(_tempEuler);
        }
    });

    return (
        <group
            ref={group}
            position={[position[0], position[1] + normalizedOffset.current, position[2]]}
            scale={scale}
        >
            <primitive object={scene} />
        </group>
    );
});

useGLTF.preload(MODEL_PATH);

