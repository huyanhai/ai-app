"use client";

import { Circle, FlowingGradient, Shader } from "shaders/react";
import { Glass, WaveDistortion, Dither, Plasma } from "shaders/react";

export default function Home() {
  return (
    <Shader className="w-full h-full">
      <Dither colorA="black" colorB="#fff" pixelSize={2} threshold={0.4} pattern="bayer8">
        <Plasma colorA="#fff" contrast={0.9} density={0.3} intensity={1.3} speed={1} />
        <WaveDistortion strength={1}></WaveDistortion>
        {/* <Glass maskType="mask" center={{ x: 0.5, y: 0.5 }} scale={0.82} refraction={0.6} blur={0.25} /> */}
      </Dither>
    </Shader>
  );
}
