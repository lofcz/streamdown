import { useEffect, useRef } from "react";
import type { Material, Object3D } from "three";
import { useCn } from "../prefix-context";
import { useTranslations } from "../translations-context";

interface OpenScadViewerProps {
  className?: string;
  data: Uint8Array;
  format: "stl" | "3mf";
  fullscreen?: boolean;
}

interface DisposableMesh extends Object3D {
  geometry?: { dispose(): void };
  material?: Material | Material[];
}

const disposeObject = (object: Object3D) => {
  object.traverse((child) => {
    const mesh = child as DisposableMesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (Array.isArray(mesh.material)) {
      for (const m of mesh.material) {
        m.dispose();
      }
    } else if (mesh.material) {
      mesh.material.dispose();
    }
  });
};

/**
 * Interactive three.js viewer for rendered OpenSCAD models.
 *
 * This module is only ever loaded through a dynamic import after a render
 * succeeded, so three.js never lands in an eagerly loaded chunk.
 */
export const OpenScadViewer = ({
  className,
  data,
  format,
  fullscreen = false,
}: OpenScadViewerProps) => {
  const cn = useCn();
  const t = useTranslations();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let disposed = false;
    let cleanup: () => void = () => undefined;

    (async () => {
      const THREE = await import("three");
      const [{ STLLoader }, { ThreeMFLoader }, { OrbitControls }] =
        await Promise.all([
          import("three/examples/jsm/loaders/STLLoader.js"),
          import("three/examples/jsm/loaders/3MFLoader.js"),
          import("three/examples/jsm/controls/OrbitControls.js"),
        ]);
      if (disposed) {
        return;
      }

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
      });
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
      const initialDirection = new THREE.Vector3(50, 40, 60).normalize();
      camera.position.copy(initialDirection.clone().multiplyScalar(100));

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;

      const hemi = new THREE.HemisphereLight(0xff_ff_ff, 0x30_35_3d, 1.5);
      scene.add(hemi);
      const key = new THREE.DirectionalLight(0xff_ff_ff, 2.6);
      key.position.set(1, 1.7, 1.2);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xff_ff_ff, 0.7);
      fill.position.set(-1, 0.5, -1);
      scene.add(fill);

      const modelRoot = new THREE.Group();
      scene.add(modelRoot);

      const loadModel = () => {
        while (modelRoot.children.length > 0) {
          const child = modelRoot.children[0];
          modelRoot.remove(child);
          disposeObject(child);
        }

        const buffer = data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength
        ) as ArrayBuffer;

        if (format === "3mf") {
          const object = new ThreeMFLoader().parse(buffer);
          modelRoot.add(object);
        } else {
          const geometry = new STLLoader().parse(buffer);
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: 0x8a_92_a0,
            roughness: 0.55,
            metalness: 0.1,
          });
          modelRoot.add(new THREE.Mesh(geometry, material));
        }

        // Fit: frame the bounding box while keeping the current orientation
        const bbox = new THREE.Box3().setFromObject(modelRoot);
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const center = bbox.getCenter(new THREE.Vector3());
        const distance = maxDim * 2.2;
        const direction = camera.position
          .clone()
          .sub(controls.target)
          .normalize();
        if (!Number.isFinite(direction.x) || direction.lengthSq() === 0) {
          direction.copy(initialDirection);
        }
        controls.target.copy(center);
        camera.position.copy(center).add(direction.multiplyScalar(distance));
        camera.near = Math.max(maxDim / 1000, 0.01);
        camera.far = Math.max(maxDim * 100, 1000);
        camera.updateProjectionMatrix();
        controls.update();
      };

      const resize = () => {
        const { clientHeight, clientWidth } = container;
        if (clientWidth === 0 || clientHeight === 0) {
          return;
        }
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(clientWidth, clientHeight);
      };

      const observer = new ResizeObserver(resize);
      observer.observe(container);
      resize();
      loadModel();

      renderer.setAnimationLoop(() => {
        controls.update();
        renderer.render(scene, camera);
      });

      cleanup = () => {
        observer.disconnect();
        renderer.setAnimationLoop(null);
        controls.dispose();
        disposeObject(modelRoot);
        scene.clear();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch(() => {
      // Failed to load three.js (network error / bundler config) — the
      // container stays empty; the surrounding card still offers downloads.
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [data, format]);

  return (
    <div
      aria-label={t.openscadModel}
      className={cn(fullscreen ? "size-full" : "h-[400px] w-full", className)}
      data-streamdown="openscad-viewer"
      ref={containerRef}
      role="img"
    />
  );
};
