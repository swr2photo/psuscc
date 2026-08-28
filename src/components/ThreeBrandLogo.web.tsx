import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei/core/Float';
import { MeshDistortMaterial } from '@react-three/drei/core/MeshDistortMaterial';
import { Text } from '@react-three/drei/core/Text';
import { Sphere } from '@react-three/drei/core/shapes';
import * as THREE from 'three';

export default function ThreeBrandLogo() {
  const textRef = useRef<any>(null!);
  const sphereRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (sphereRef.current) {
      sphereRef.current.rotation.z = time * 0.2;
      sphereRef.current.rotation.y = time * 0.3;
    }
  });

  return (
    <group>
      {/* Floating 3D "PSUSCC" Text */}
      <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
        <Text
          ref={textRef}
          fontSize={1.2}
          color="white"
          font={undefined} 
          anchorX="center"
          anchorY="middle"
          position={[0, 0, 0.5]}
        >
          PSUSCC
        </Text>
      </Float>

      {/* Glowing Circular Logo / Sphere inside the letters */}
      <Sphere ref={sphereRef} args={[1, 64, 64]} position={[0, 0, -0.2]}>
        <MeshDistortMaterial
          color="#3B82F6"
          speed={2}
          distort={0.4}
          radius={1}
          emissive="#1E40AF"
          emissiveIntensity={2}
          transparent
          opacity={0.8}
        />
      </Sphere>

      {/* Decorative Outer Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.5, 0.02, 16, 100]} />
        <meshBasicMaterial color="#60A5FA" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}
