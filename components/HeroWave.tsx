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
  vec2 prev = texture(uPrev, uv).xy * 2.0 - 1.0;
  vec2 next = prev * uDecay;
  if (uBrush > 0.001) {
    vec2 delta = uv - uMouse.xy;
    float falloff = exp(-dot(delta, delta) * 52.0);
    next += uMouse.zw * falloff * uBrush;
  }
  next = clamp(next, vec2(-1.0), vec2(1.0));
  fragColor = vec4(next * 0.5 + 0.5, 0.5, 1.0);
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
  vec2 flow = texture(uFlow, uv).xy * 2.0 - 1.0;
  vec2 p = uv * aspect;
  p += flow * 0.24;
  vec2 curl = curlFbm(p * 1.65, uTime);
  p += curl * 0.05;
  float field = fbm(p * 2.35 + vec2(uTime * 0.032, -uTime * 0.021));
  float ridge = smoothstep(0.28, 0.52, field) * smoothstep(0.82, 0.56, field);
  float veil = 0.10 + field * 0.14 + ridge * 0.10;
  vec3 wash = vec3(0.976, 0.980, 0.996);
  vec3 brand = vec3(0.302, 0.420, 0.996);
  vec3 mist = vec3(0.541, 0.627, 1.000);
  vec3 tint = mix(mist, brand, ridge);
  vec3 color = mix(wash, tint, veil);
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  float bloom = (field + fbm(p + vec2(0.014, -0.01)) + fbm(p + vec2(-0.01, 0.012))) * 0.333;
  color += (tint - wash) * luma * bloom * 0.28;
  float crest = smoothstep(0.55, 0.78, field);
  color += mist * crest * luma * 0.08;
  float falloff = mix(0.42, 1.0, smoothstep(1.05, 0.28, uv.y));
  color = mix(wash, color, falloff);
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
      brush *= 0.86;
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
      mouse.vx = x - mouse.x;
      mouse.vy = y - mouse.y;
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

  return <canvas ref={canvasRef} className="hero-wave" aria-hidden="true" />;
}
