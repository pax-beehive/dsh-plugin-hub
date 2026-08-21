"use client";

import { useEffect, useRef } from "react";

const VERT = `#version 300 es
const vec2 POS[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  gl_Position = vec4(POS[gl_VertexID], 0.0, 1.0);
}
`;

const FLOW_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform vec4 uMouse;
uniform float uBrush;
uniform float uDecay;
out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec4 prevTex = texture(uPrev, uv);
  float presence = prevTex.r * uDecay;
  vec2 vel = prevTex.gb * 2.0 - 1.0;
  vel *= uDecay;
  if (uBrush > 0.001) {
    vec2 delta = uv - uMouse.xy;
    float falloff = exp(-dot(delta, delta) * 16.0);
    float stamp = falloff * uBrush;
    presence = max(presence, stamp);
    vel += uMouse.zw * stamp * 1.85;
  }
  vel = clamp(vel, vec2(-1.0), vec2(1.0));
  presence = clamp(presence, 0.0, 1.0);
  fragColor = vec4(presence, vel * 0.5 + 0.5, 1.0);
}
`;

const FLUID_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uFlow;
uniform vec2 uResolution;
uniform float uTime;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    sum += amp * valueNoise(p);
    p = rot * p * 2.07 + vec2(1.7, 9.2);
    amp *= 0.5;
  }
  return sum;
}

vec2 curlFbm(vec2 p, float t) {
  float e = 0.018;
  vec2 q = p + vec2(t * 0.11, -t * 0.07);
  float nL = fbm(q - vec2(e, 0.0));
  float nR = fbm(q + vec2(e, 0.0));
  float nD = fbm(q - vec2(0.0, e));
  float nU = fbm(q + vec2(0.0, e));
  return vec2(nU - nD, nL - nR) / (2.0 * e);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec4 flowTex = texture(uFlow, uv);
  float presence = flowTex.r;
  vec2 flow = flowTex.gb * 2.0 - 1.0;
  float mag = length(flow);
  vec2 p = uv * aspect;
  p += flow * 0.55 * presence;
  vec2 swirl = vec2(-flow.y, flow.x) * presence * mag;
  p += swirl * 0.20 * presence;
  float t = uTime;
  vec2 d1 = normalize(vec2(1.00, 0.11));
  vec2 d2 = normalize(vec2(0.93, -0.24));
  vec2 d3 = normalize(vec2(0.86, 0.36));
  vec2 d4 = normalize(vec2(0.98, -0.07));
  vec2 d5 = normalize(vec2(0.74, 0.19));
  float ph1 = dot(p, d1) * 7.4 + t * 0.62;
  float ph2 = dot(p, d2) * 11.2 + t * 0.91;
  float ph3 = dot(p, d3) * 4.6 + t * 0.34;
  float ph4 = dot(p, d4) * 16.8 + t * 1.28;
  float ph5 = dot(p, d5) * 3.15 + t * 0.22;
  p += d1 * 0.020 * cos(ph1);
  p += d2 * 0.014 * cos(ph2);
  p += d3 * 0.016 * cos(ph3);
  p += d4 * 0.008 * cos(ph4);
  p += d5 * 0.018 * cos(ph5);
  ph1 = dot(p, d1) * 7.4 + t * 0.62;
  ph2 = dot(p, d2) * 11.2 + t * 0.91;
  ph3 = dot(p, d3) * 4.6 + t * 0.34;
  ph4 = dot(p, d4) * 16.8 + t * 1.28;
  ph5 = dot(p, d5) * 3.15 + t * 0.22;
  float s1 = sin(ph1);
  float s2 = sin(ph2);
  float s3 = sin(ph3);
  float s4 = sin(ph4);
  float s5 = sin(ph5);
  float height = s1 * 0.36 + s2 * 0.22 + s3 * 0.20 + s4 * 0.08 + s5 * 0.18;
  height = clamp(height * 0.52 + 0.50, 0.0, 1.0);
  float crest = pow(max(s1, 0.0), 5.0) * 0.46;
  crest += pow(max(s2, 0.0), 6.0) * 0.24;
  crest += pow(max(s3, 0.0), 5.0) * 0.18;
  crest += pow(max(s4, 0.0), 8.0) * 0.10;
  crest += pow(max(s5, 0.0), 4.5) * 0.16;
  float chop = fbm(p * 16.0 + vec2(t * 0.40, -t * 0.26));
  crest += (chop - 0.45) * 0.10 * crest;
  p += curlFbm(p * 8.0, t) * 0.006 * crest;
  vec3 abyss = vec3(0.0157, 0.0627, 0.1098);
  vec3 mid = vec3(0.0314, 0.2745, 0.3725);
  vec3 foam = vec3(0.5490, 0.8235, 0.9020);
  vec3 brand = vec3(0.302, 0.420, 0.996);
  vec3 paper = vec3(1.0, 1.0, 1.0);
  vec3 water = mix(abyss, mid, height);
  vec3 tint = mix(foam, brand, 0.28);
  vec3 color = mix(water, tint, clamp(crest * 0.82, 0.0, 0.72));
  color += foam * pow(crest, 2.2) * 0.22;
  color += brand * presence * (0.16 + mag * 0.38);
  color += foam * presence * (0.12 + mag * 0.22);
  float falloff = smoothstep(0.05, 0.42, uv.y);
  color = mix(paper, color, falloff);
  fragColor = vec4(color, 1.0);
}
`;

const FRAME_MS = 1000 / 30;
const FLOW_SCALE = 4;
const DPR_CAP = 1.5;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "compile";
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, vert: string, frag: string) {
  const program = gl.createProgram();
  if (!program) throw new Error("program");
  const vs = compile(gl, gl.VERTEX_SHADER, vert);
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "link";
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

function makeTarget(gl: WebGL2RenderingContext, width: number, height: number) {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) throw new Error("target");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  return { texture, framebuffer, width, height };
}

function destroyTarget(
  gl: WebGL2RenderingContext,
  target: ReturnType<typeof makeTarget> | null,
) {
  if (!target) return;
  gl.deleteTexture(target.texture);
  gl.deleteFramebuffer(target.framebuffer);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function skipMouseFlow() {
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches
  );
}

export default function HeroWave() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prefersReducedMotion()) return;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
      premultipliedAlpha: true,
    });
    if (!gl) return;

    let flowA: ReturnType<typeof makeTarget> | null = null;
    let flowB: ReturnType<typeof makeTarget> | null = null;
    let raf = 0;
    let lastDraw = 0;
    let visible = true;
    let brush = 0;
    const mouse = { x: 0.5, y: 0.5, vx: 0, vy: 0 };

    let flowProgram: WebGLProgram;
    let fluidProgram: WebGLProgram;
    try {
      flowProgram = link(gl, VERT, FLOW_FRAG);
      fluidProgram = link(gl, VERT, FLUID_FRAG);
    } catch {
      return;
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const flowUniforms = {
      uPrev: gl.getUniformLocation(flowProgram, "uPrev"),
      uTexel: gl.getUniformLocation(flowProgram, "uTexel"),
      uMouse: gl.getUniformLocation(flowProgram, "uMouse"),
      uBrush: gl.getUniformLocation(flowProgram, "uBrush"),
      uDecay: gl.getUniformLocation(flowProgram, "uDecay"),
    };
    const fluidUniforms = {
      uFlow: gl.getUniformLocation(fluidProgram, "uFlow"),
      uResolution: gl.getUniformLocation(fluidProgram, "uResolution"),
      uTime: gl.getUniformLocation(fluidProgram, "uTime"),
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width === width && canvas.height === height && flowA && flowB) return;
      canvas.width = width;
      canvas.height = height;
      const flowW = Math.max(1, Math.floor(width / FLOW_SCALE));
      const flowH = Math.max(1, Math.floor(height / FLOW_SCALE));
      destroyTarget(gl, flowA);
      destroyTarget(gl, flowB);
      flowA = makeTarget(gl, flowW, flowH);
      flowB = makeTarget(gl, flowW, flowH);
    };

    const draw = (now: number) => {
      if (!flowA || !flowB) return;
      const time = now * 0.001;

      gl.useProgram(flowProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, flowB.framebuffer);
      gl.viewport(0, 0, flowB.width, flowB.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, flowA.texture);
      gl.uniform1i(flowUniforms.uPrev, 0);
      gl.uniform2f(flowUniforms.uTexel, 1 / flowB.width, 1 / flowB.height);
      gl.uniform4f(flowUniforms.uMouse, mouse.x, mouse.y, mouse.vx, mouse.vy);
      gl.uniform1f(flowUniforms.uBrush, brush);
      gl.uniform1f(flowUniforms.uDecay, 0.964);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const swap = flowA;
      flowA = flowB;
      flowB = swap;
      brush *= 0.93;
      mouse.vx *= 0.82;
      mouse.vy *= 0.82;

      gl.useProgram(fluidProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, flowA.texture);
      gl.uniform1i(fluidUniforms.uFlow, 0);
      gl.uniform2f(fluidUniforms.uResolution, canvas.width, canvas.height);
      gl.uniform1f(fluidUniforms.uTime, time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || !visible) return;
      if (now - lastDraw < FRAME_MS) return;
      lastDraw = now;
      resize();
      draw(now);
    };

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = (event.clientX - rect.left) / rect.width;
      const y = 1 - (event.clientY - rect.top) / rect.height;
      mouse.vx = Math.max(-1, Math.min(1, (x - mouse.x) * 6));
      mouse.vy = Math.max(-1, Math.min(1, (y - mouse.y) * 6));
      mouse.x = x;
      mouse.y = y;
      brush = 1;
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    const ro = new ResizeObserver(() => {
      if (!document.hidden && visible) resize();
    });
    ro.observe(canvas);

    const trackMouse = !skipMouseFlow();
    if (trackMouse) {
      window.addEventListener("pointermove", onPointer, { passive: true });
    }

    resize();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      if (trackMouse) window.removeEventListener("pointermove", onPointer);
      destroyTarget(gl, flowA);
      destroyTarget(gl, flowB);
      gl.deleteProgram(flowProgram);
      gl.deleteProgram(fluidProgram);
      gl.deleteVertexArray(vao);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-wave" aria-hidden="true" style={{ width: "100%", height: "100%", display: "block" }} />;
}
