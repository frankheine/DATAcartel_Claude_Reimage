import React, { useRef, useLayoutEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Sparkles, Lightformer, Stars } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export const globalState = { scrollProgress: 0, introProgress: 0 };

const LiquidMetalObject = () => {
  const groupRef = useRef<any>(null);
  const torusRef = useRef<any>(null);
  const satellitePivotRef = useRef<any>(null);
  const satelliteRef = useRef<any>(null);

  useFrame((state, delta) => {
    if (!groupRef.current || !torusRef.current || !satellitePivotRef.current) return;
    
    const p = globalState.scrollProgress !== undefined ? globalState.scrollProgress : 0;
    const introP = globalState.introProgress !== undefined ? globalState.introProgress : 0;
    
    const targetRotY = p * Math.PI * 13.33; 
    const targetRotX = p * Math.PI * 6.66; 
    
    const timeOffset = state.clock.getElapsedTime() * 0.15;
    
    const introRotY = gsap.utils.interpolate(-Math.PI * 4, 0, introP);
    torusRef.current.rotation.y = targetRotY + timeOffset + introRotY;
    torusRef.current.rotation.x = targetRotX + (timeOffset * 0.5) + introRotY * 0.5;
    
    const isMobile = window.innerWidth < 768;
    
    let rawTargetX = 0;
    let rawTargetY = 0;
    let targetZ = 0;
    let targetScale = 1.0;

    const viewportAspect = window.innerWidth / window.innerHeight;
    const fovRad = 45 * Math.PI / 180;
    
    const getDims = (z: number) => {
      const distance = 7 - z; 
      const w = 2 * distance * Math.tan(fovRad / 2) * viewportAspect;
      return { w, h: w / viewportAspect };
    };

    // Corner assignment is derived directly from each section's text alignment,
    // so the object always sits opposite whatever text is on screen. Adding,
    // removing, or reordering sections in sectionsData just works, no retuning.
    const cornerFor = (align: 'center' | 'left' | 'right') => align === 'left' ? 1 : align === 'right' ? -1 : 0;

    const segCount = sectionsData.length;
    const segFrac = 1 / segCount;
    const rawIndex = Math.min(segCount - 0.0001, p / segFrac);
    const idx = Math.floor(rawIndex);
    const localP = rawIndex - idx;
    const nextIdx = Math.min(segCount - 1, idx + 1);

    const curAlign = sectionsData[idx]?.align ?? 'center';
    const nextAlign = sectionsData[nextIdx]?.align ?? curAlign;
    const curSign = cornerFor(curAlign);
    const nextSign = cornerFor(nextAlign);

    const TRANSITION_ZONE = 0.35; // last 35% of a section's on-screen time is spent swinging to the next corner
    const inTransition = idx < segCount - 1 && localP > (1 - TRANSITION_ZONE);

    let xSign: number;
    let ySign: number;

    if (idx === 0) {
      // Hero: no text to dodge, so drift from dead-center out toward the first real section's opposite corner.
      const heroP = Math.max(0, Math.min(1, localP));
      const dipZ = Math.sin(heroP * Math.PI) * 12;
      targetZ = gsap.utils.interpolate(1.0, -5, heroP) - dipZ;
      xSign = gsap.utils.interpolate(0, nextSign, heroP);
      ySign = xSign;
      targetScale = isMobile ? gsap.utils.interpolate(1.0, 0.8, heroP) : 1.6;
    } else if (inTransition) {
      const blend = (localP - (1 - TRANSITION_ZONE)) / TRANSITION_ZONE;
      const dipZ = Math.sin(blend * Math.PI) * 20;
      targetZ = -5 - dipZ;
      xSign = gsap.utils.interpolate(curSign, nextSign, blend);
      ySign = xSign;
      targetScale = isMobile ? 0.8 : 1.6;
    } else {
      targetZ = -5;
      xSign = curSign;
      ySign = curSign;
      targetScale = isMobile ? 0.8 : 1.6;
    }

    const dims = getDims(targetZ);
    const maxX = (dims.w / 2) * (isMobile ? 0.35 : 0.60);
    const maxY = (dims.h / 2) * 0.4;
    rawTargetX = maxX * xSign;
    rawTargetY = maxY * ySign;

    // Apply intro animation zoom (combines with scroll calculations)
    // Intro zoom starts near camera (Z=4) and large, shrinking back to regular targetZ
    const introEffectZ = gsap.utils.interpolate(4, targetZ, introP);
    const introEffectScale = gsap.utils.interpolate(targetScale * 2.5, targetScale * 1.2, introP);

    groupRef.current.position.x = rawTargetX;
    groupRef.current.position.y = rawTargetY;
    groupRef.current.position.z = introEffectZ;
    groupRef.current.scale.set(introEffectScale, introEffectScale, introEffectScale);
    
    // --- SATELLITE ANIMATION ---
    // Visible from just after the hero through just before the final section, scaled to section count.
    const satStart = segFrac;
    const satEnd = 1 - segFrac * 0.5;
    const satFade = segFrac * 0.25;
    const satPresence = gsap.utils.clamp(0, 1, (p - satStart) / satFade) * (1 - gsap.utils.clamp(0, 1, (p - satEnd) / satFade));
    satellitePivotRef.current.scale.set(satPresence, satPresence, satPresence);
    satellitePivotRef.current.position.set(0, 0, 0); 
    
    let satOrbitDistance = 0;
    if (p >= satStart && p < satEnd) {
      const satSeg = (p - satStart) / (satEnd - satStart);
      satOrbitDistance = gsap.utils.interpolate(6, 2.5, Math.abs(Math.sin(satSeg * Math.PI * 2)));
    }
    
    if (satelliteRef.current) {
      satelliteRef.current.position.x = satOrbitDistance;
    }
    
    satellitePivotRef.current.rotation.y = (p * Math.PI * 16.66) + (timeOffset * 2);
    satellitePivotRef.current.rotation.x = Math.PI / 6 + (p * Math.PI * 3.33);
    satellitePivotRef.current.rotation.z = Math.PI / 8;
  });

  return (
    <group ref={groupRef}>
      <mesh ref={torusRef}>
        <torusKnotGeometry args={[1, 0.35, 64, 16]} />
        <meshPhysicalMaterial
          color="#a855f7"
          metalness={1}
          roughness={0.15}
          clearcoat={1}
          clearcoatRoughness={0.1}
          iridescence={1}
          iridescenceIOR={1.5}
          iridescenceThicknessRange={[100, 400]}
        />
      </mesh>
      
      <group ref={satellitePivotRef}>
        <group ref={satelliteRef} rotation={[Math.PI / 4, Math.PI / 4, 0]}>
          {/* Main body */}
          <mesh>
             <cylinderGeometry args={[0.2, 0.2, 0.8, 16]} />
             <meshPhysicalMaterial 
               color="#d1d5db" 
               metalness={0.9} 
               roughness={0.1}
             />
          </mesh>
          
          {/* Solar Panel 1 */}
          <mesh position={[0.7, 0, 0]}>
             <boxGeometry args={[1, 0.05, 0.4]} />
             <meshPhysicalMaterial 
               color="#1e3a8a" 
               metalness={0.5} 
               roughness={0.2}
               clearcoat={1}
               clearcoatRoughness={0.1}
             />
          </mesh>

          {/* Solar Panel 2 */}
          <mesh position={[-0.7, 0, 0]}>
             <boxGeometry args={[1, 0.05, 0.4]} />
             <meshPhysicalMaterial 
               color="#1e3a8a" 
               metalness={0.5} 
               roughness={0.2}
               clearcoat={1}
               clearcoatRoughness={0.1}
             />
          </mesh>
          
          {/* Dish */}
          <mesh position={[0, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.25, 0.2, 16]} />
            <meshPhysicalMaterial 
               color="#ffffff" 
               metalness={0.5} 
               roughness={0.5}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
};

const BackgroundParticles = () => {
  return (
    <Sparkles count={200} scale={15} size={2} speed={0.4} opacity={0.3} color="#bb88ff" />
  );
};

const Scene = () => {
  return (
    <>
      <color attach="background" args={['#050505']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 10]} intensity={1} />
      <Environment resolution={128}>
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <Lightformer form="rect" intensity={2} position={[0, 5, -9]} scale={[20, 20, 1]} />
          <Lightformer form="rect" intensity={2} position={[0, 5, 9]} scale={[20, 20, 1]} />
          <Lightformer form="rect" intensity={2} color="#aa77ff" position={[10, 1, 0]} scale={[20, 20, 1]} />
          <Lightformer form="rect" intensity={2} color="#7209b7" position={[-10, 1, 0]} scale={[20, 20, 1]} />
          <Lightformer form="circle" intensity={3} color="#ffffff" position={[0, 10, 0]} scale={10} />
        </group>
      </Environment>
      <LiquidMetalObject />
      <BackgroundParticles />
      <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
    </>
  );
};

const sectionsData: Array<{id: string, title: string, subtitle: string, bullets: string[], align: 'center' | 'left' | 'right', module?: string, status?: string}> = [
  {
    id: 'hero',
    title: '',
    subtitle: '',
    bullets: [],
    align: 'center'
  },
  {
    id: 's1',
    title: 'UNCUTstash',
    subtitle: 'AI THAT NEVER LEAVES YOUR DEVICE',
    module: 'MODULE_01 // LOCAL_INTELLIGENCE',
    status: 'NO EGRESS',
    bullets: [
      'A small language model runs entirely in your browser, nothing you type is ever sent anywhere',
      'Under a gigabyte on disk, cached locally after the first load',
      'No account, no server, no middleman between you and the model'
    ],
    align: 'left'
  },
  {
    id: 's2',
    title: 'LOCAL RAG ENGINE',
    subtitle: 'SMALL MODEL, LONG MEMORY',
    module: 'MODULE_02 // RETRIEVAL_CORE',
    status: 'INDEXED ON-DEVICE',
    bullets: [
      'A vector database lives on your device and feeds the model real context on demand',
      'Offsets the limits of running small, without ever phoning home for horsepower',
      'Your documents and history stay indexed locally, not uploaded to train anyone else\u2019s model'
    ],
    align: 'right'
  },
  {
    id: 's3',
    title: 'SANDBOXED BY DESIGN',
    subtitle: 'CONNECTED, NOT EXPOSED',
    module: 'MODULE_03 // ISOLATION_LAYER',
    status: 'SEALED',
    bullets: [
      'Can reach out to the open internet for real-time information when you ask it to',
      'Every fetch is isolated so your data can\u2019t leak out the same door',
      'You get current answers without handing over a browsing history to get them'
    ],
    align: 'left'
  },
  {
    id: 's4',
    title: 'ENTERPRISE EDITION',
    subtitle: 'YOUR DATA, YOUR MACHINE, YOUR MODEL',
    module: 'MODULE_04 // DEDICATED_INSTANCE',
    status: 'ON-PREM',
    bullets: [
      'A dedicated model trained as an expert on your company\u2019s own data, running on hardware you control',
      'Ask it to write reports, surface patterns, or answer questions across everything you\u2019ve fed it',
      'Nothing sensitive ever leaves the building, built for the industries standard AI could never touch'
    ],
    align: 'right'
  },
  {
    id: 's5',
    title: 'WHAT\u2019S NEXT',
    subtitle: 'BRAIN-COMPUTER INTERFACE, IN DEVELOPMENT',
    module: 'MODULE_05 // INTENT_LAYER',
    status: 'R&D',
    bullets: [
      'Early-stage work on controlling the system with thought instead of touch',
      'Machine learning mapped directly to intent, executing tasks without a keystroke',
      'Same rule applies as everywhere else here: local-first, private by default'
    ],
    align: 'left'
  }
];

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useLayoutEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      touchMultiplier: 2,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const raf = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  useGSAP(() => {
    const panels = gsap.utils.toArray('.z-panel') as HTMLElement[];
    
    // Initial states for panels
    panels.forEach((panel, i) => {
      if (i === 0) {
        gsap.set(panel, { z: 0, opacity: 1, display: 'flex' });
      } else {
        gsap.set(panel, { z: 2000, opacity: 0, display: 'none' });
      }
    });

    // Intro animation (Runs on load, independent of scroll)
    const introTl = gsap.timeline();
    introTl.to(globalState, { introProgress: 1, duration: 1.5, ease: "power3.out" }, 0.2)
      .fromTo('.hero-data', { y: -100, opacity: 0 }, { y: 0, opacity: 1, duration: 1.5, ease: 'power3.out' }, 0.2)
      .fromTo('.hero-cartel', { y: 100, opacity: 0 }, { y: 0, opacity: 1, duration: 1.5, ease: 'power3.out' }, 0.2)
      .fromTo('.hero-collective', { scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.5, ease: 'power3.out' }, 0.2)
      .fromTo('.hero-subtitle', { opacity: 0 }, { opacity: 1, duration: 1.5, ease: 'none' }, 0.8);

    const tl = gsap.timeline();

    panels.forEach((panel, i) => {
      const bullets = panel.querySelectorAll('.orbit-bullet');
      
      tl.set(panel, { display: 'flex' });

      if (i === 0) {
        // Hero just waits and goes away on scroll
        tl.to(panel, { z: -1000, opacity: 0, duration: 2, ease: "power2.in" });
      } else {
        // The Entrance: flies from 'behind' the camera to the front
        tl.fromTo(panel,
        { 
          z: 1500, 
          scale: 1.5,
          opacity: 0 
        },
        {
          z: 0,
          scale: 1,
          opacity: 1,
          duration: 2,
          ease: "power3.out"
        }
      );
      }

      // The Bullet Points: "orbit" the 3D object or slide out from behind it.
      tl.fromTo(bullets, 
        {
          opacity: 0,
          scale: 0.5,
          z: -500,
          y: 50,
          rotateX: 35,
          transformPerspective: 1200,
        },
        {
          opacity: 1,
          scale: 1,
          z: 0,
          y: 0,
          rotateX: 0,
          duration: 1.5,
          stagger: 0.15,
          ease: "power3.out" 
        },
        "-=1.0" 
      );

      // Holding state: add a slight artificial pause so the user can literally read the points while scrolling down
      tl.to(panel, { z: -100, duration: 1.5, ease: "none" });

      // The Transition: scales down and fades to 0 opacity
      if (i < panels.length - 1) {
        tl.to(panel, {
          z: -1000, 
          scale: 0.8,
          opacity: 0, 
          duration: 1.5,
          ease: "power2.in"
        });
        tl.set(panel, { display: 'none' });
      } else {
        // Last element just fades out smoothly or stays
        tl.to(panel, {
          z: -500,
          opacity: 0.5,
          duration: 1.5,
          ease: "power2.inOut"
        });
      }
    });

    ScrollTrigger.create({
      trigger: containerRef.current,
      start: 'top top',
      end: `+=${panels.length * 200}%`, // Restored to 200% for smooth pacing
      pin: true,
      scrub: true, // MUST BE true to prevent lag
      animation: tl,
      onUpdate: (self) => {
        globalState.scrollProgress = self.progress;
      }
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="relative w-full h-[100vh] overflow-hidden bg-black text-white font-sans perspective-container">
      <div className="absolute inset-0 z-0 pointer-events-none w-full h-full">
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 7], fov: 45 }}>
          <Scene />
        </Canvas>
      </div>

      <div className="absolute inset-0 z-10 pointer-events-none transform-style-3d">
        {sectionsData.map((section, index) => {
          let flexAlign = "items-center text-center";
          if (section.align === 'left') flexAlign = "items-start text-left ml-4 md:ml-12 lg:ml-24";
          if (section.align === 'right') flexAlign = "items-end text-right mr-4 md:mr-12 lg:mr-24";
          
          return (
          <div 
            key={section.id} 
            className={`z-panel absolute inset-0 flex flex-col justify-center transform-style-3d ${flexAlign}`}
          >
            <div className={`w-full max-w-4xl px-4 pointer-events-auto flex flex-col ${section.align === 'center' ? 'items-center' : section.align === 'left' ? 'items-start' : 'items-end'}`}>
              {section.id === 'hero' ? (
                <div className="flex flex-col items-center">
                  <h2 
                    className="flex flex-row flex-nowrap items-center justify-center text-[2.8rem] sm:text-[4rem] md:text-[6rem] lg:text-[8rem] xl:text-[10rem] leading-none font-black font-orbitron tracking-tighter mb-0"
                    style={{ textShadow: '0 0 25px rgba(114,9,183,0.8)' }}
                  >
                    <span 
                      className="hero-data inline-block leading-none text-white will-change-transform opacity-0"
                      style={{ WebkitTextStroke: '2px black' }}
                    >
                      DATA
                    </span>
                    <span className="hero-cartel relative inline-block leading-none text-[#7209B7] will-change-transform opacity-0">
                      <span 
                        className="absolute left-0 top-0 z-[-1]"
                        style={{ WebkitTextStroke: '8px black' }}
                        aria-hidden="true"
                      >
                        cartel
                      </span>
                      <span 
                        className="relative z-10"
                        style={{ WebkitTextStroke: '2px white' }}
                      >
                        cartel
                      </span>
                    </span>
                  </h2>
                  <h2 
                    className="hero-collective inline-block text-[2rem] sm:text-5xl md:text-7xl lg:text-[6rem] xl:text-[7rem] leading-none font-black font-orbitron tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-200 to-indigo-500 mb-4 will-change-transform opacity-0"
                    style={{ WebkitTextStroke: '1.5px black', textShadow: '0 0 25px rgba(114,9,183,0)' }}
                  >
                    COLLECTIVE
                  </h2>
                  <h3 
                    className="hero-subtitle text-xs sm:text-sm md:text-xl lg:text-2xl font-bold font-orbitron tracking-[0.1em] sm:tracking-[0.2em] text-purple-300 mt-4 mb-8 uppercase text-center will-change-transform opacity-0"
                    style={{ WebkitTextStroke: '1px black', textShadow: '0 0 10px rgba(0,0,0,0.5)' }}
                  >
                    Building The AI Infrastructure of The Future.
                  </h3>
                </div>
              ) : section.id === 's1' ? (
                <div className="flex flex-col items-start text-left">
                  <h2 
                    className="flex flex-row items-center justify-start text-7xl sm:text-8xl md:text-9xl lg:text-[8rem] xl:text-[10rem] leading-none font-black font-orbitron tracking-tighter mb-2"
                    style={{ textShadow: '0 0 25px rgba(114,9,183,0.8)' }}
                  >
                    <span 
                      className="inline-block leading-none text-white uppercase"
                      style={{ WebkitTextStroke: '2px black' }}
                    >
                      PLUG
                    </span>
                    <span className="relative inline-block leading-none text-[#7209B7] lowercase">
                      <span 
                        className="absolute left-0 top-0 z-[-1]"
                        style={{ WebkitTextStroke: '8px black' }}
                        aria-hidden="true"
                      >
                        leads
                      </span>
                      <span 
                        className="relative z-10"
                        style={{ WebkitTextStroke: '2px white' }}
                      >
                        leads
                      </span>
                    </span>
                  </h2>
                  <h3 
                    className="text-xl md:text-2xl font-bold tracking-widest font-orbitron text-purple-300 mb-8 uppercase"
                    style={{ WebkitTextStroke: '1px black', textShadow: '0 0 10px rgba(0,0,0,0.5)' }}
                  >
                    {section.subtitle}
                  </h3>
                </div>
              ) : (
                <>
                  <h2 
                    className="text-5xl md:text-7xl lg:text-8xl font-black font-heading tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600 mb-2 uppercase"
                    style={{ WebkitTextStroke: '1.5px black', textShadow: '0 0 30px rgba(114,9,183,0.5)' }}
                  >
                    {section.title}
                  </h2>
                  <h3 
                    className="text-xl md:text-2xl font-bold tracking-widest font-heading text-purple-300 mb-8 uppercase"
                    style={{ WebkitTextStroke: '1px black', textShadow: '0 0 10px rgba(0,0,0,0.5)' }}
                  >
                    {section.subtitle}
                  </h3>
                </>
              )}
              
              {section.bullets.length > 0 && (
                <div className={`flex flex-col gap-4 mt-6 perspective-container ${section.align === 'center' ? 'items-center' : section.align === 'left' ? 'items-start' : 'items-end'}`}>
                  {(section.module || section.status) && (
                    <div className="module-tag mb-1">
                      <span className="status-dot" />
                      {section.module}
                      {section.status && <span className="text-white/30">/ {section.status}</span>}
                    </div>
                  )}
                  {section.bullets.map((bullet, bIdx) => (
                    <div key={bIdx} className="orbit-bullet viewport-panel max-w-sm transform-style-3d">
                      <span className="bracket bracket-tl" />
                      <span className="bracket bracket-br" />
                      <p className="text-base md:text-lg text-gray-200 relative z-10">{bullet}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}
