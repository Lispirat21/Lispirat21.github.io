// Постобработка: свечение (bloom), мягкие тени в углах (AO по глубине), цветокоррекция, виньетка.
// Уровни: 0 — выкл, 1 — свечение + цвет, 2 — + AO.
HL.Post = (function () {
  const T = THREE;
  let w = 0, h = 0, rtMain = null, rtA = null, rtB = null, rtC = null, rtD = null, level = -1;
  const scene2 = new T.Scene(), cam2 = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2)); quad.frustumCulled = false; scene2.add(quad);
  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

  const bright = new T.ShaderMaterial({
    uniforms: { tColor: { value: null }, threshold: { value: 0.72 } }, vertexShader: VS, depthTest: false, depthWrite: false,
    fragmentShader: `uniform sampler2D tColor; uniform float threshold; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tColor, vUv).rgb; float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
        float sat = mx > 0.001 ? (mx - mn) / mx : 0.0;
        // светятся яркие и насыщенные источники (лазеры, глаза, огни, экраны); белые стены — почти нет
        float k = smoothstep(threshold, 1.0, mx) * (0.15 + 0.85 * sat);
        gl_FragColor = vec4(c * k, 1.0); }`,
  });
  const blur = new T.ShaderMaterial({
    uniforms: { tColor: { value: null }, dir: { value: new T.Vector2() } }, vertexShader: VS, depthTest: false, depthWrite: false,
    fragmentShader: `uniform sampler2D tColor; uniform vec2 dir; varying vec2 vUv;
      void main(){ vec3 s = texture2D(tColor, vUv).rgb * 0.227;
        s += texture2D(tColor, vUv + dir * 1.385).rgb * 0.316; s += texture2D(tColor, vUv - dir * 1.385).rgb * 0.316;
        s += texture2D(tColor, vUv + dir * 3.231).rgb * 0.070; s += texture2D(tColor, vUv - dir * 3.231).rgb * 0.070;
        gl_FragColor = vec4(s, 1.0); }`,
  });
  const comp = new T.ShaderMaterial({
    uniforms: {
      tColor: { value: null }, tDepth: { value: null }, tBloom1: { value: null }, tBloom2: { value: null },
      near: { value: 0.1 }, far: { value: 1000 }, res: { value: new T.Vector2(1, 1) }, ao: { value: 1 }, bloom: { value: 0.9 },
      lift: { value: new T.Vector3() }, gain: { value: new T.Vector3(1, 1, 1) }, sat: { value: 1.1 }, contrast: { value: 1.08 }, vign: { value: 0.35 }, time: { value: 0 },
    },
    vertexShader: VS, depthTest: false, depthWrite: false,
    fragmentShader: `uniform sampler2D tColor, tDepth, tBloom1, tBloom2; uniform float near, far, ao, bloom, sat, contrast, vign, time; uniform vec2 res; uniform vec3 lift, gain; varying vec2 vUv;
      float lin(vec2 uv){ float d = texture2D(tDepth, uv).x; return near * far / (far - d * (far - near)); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
      void main(){
        vec3 c = texture2D(tColor, vUv).rgb;
        // мягкие тени в углах и стыках: соседние пиксели ближе к камере — значит здесь «щель»
        if (ao > 0.0) {
          float z = lin(vUv);
          if (z < far * 0.9) {
            float r = clamp(18.0 / z, 1.5, 14.0), occ = 0.0;
            for (int i = 0; i < 8; i++) {
              float a = float(i) * 0.785 + hash(vUv) * 0.6;
              vec2 o = vec2(cos(a), sin(a)) * r / res * (0.6 + 0.4 * float(i - (i / 2) * 2));
              float dz = z - lin(vUv + o);
              occ += clamp(dz / (0.35 + z * 0.012), 0.0, 1.0) * (1.0 - smoothstep(0.6, 3.0 + z * 0.03, dz));
            }
            c *= 1.0 - ao * 0.42 * clamp(occ / 8.0 * 1.6, 0.0, 1.0);
          }
        }
        // свечение
        vec3 b = texture2D(tBloom1, vUv).rgb * 0.65 + texture2D(tBloom2, vUv).rgb * 0.85;
        c += b * bloom;
        // цветокоррекция
        c = c * gain + lift * (1.0 - c);
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, sat);
        c = (c - 0.5) * contrast + 0.5;
        c = c / (1.0 + max(c - 1.0, 0.0) * 0.6);         // мягкий потолок для пересветов
        vec2 q = vUv - 0.5; c *= 1.0 - vign * dot(q, q) * 1.6;
        c += (hash(vUv * 1.7) - 0.5) / 255.0;             // дизеринг против полос
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`,
  });
  // цвет по времени суток
  const GRADE = {
    day:   { lift: [0.0, 0.0, 0.012], gain: [1.02, 1.0, 0.97], sat: 1.1, contrast: 1.07, vign: 0.3, bloom: 0.45, th: 0.9 },
    dusk:  { lift: [0.015, 0.0, 0.03], gain: [1.06, 0.99, 0.92], sat: 1.12, contrast: 1.09, vign: 0.36, bloom: 0.6, th: 0.86 },
    dawn:  { lift: [0.01, 0.0, 0.025], gain: [1.04, 1.0, 0.95], sat: 1.08, contrast: 1.07, vign: 0.34, bloom: 0.55, th: 0.86 },
    night: { lift: [0.0, 0.01, 0.035], gain: [0.98, 1.0, 1.06], sat: 1.06, contrast: 1.1, vign: 0.42, bloom: 0.85, th: 0.78 },
  };

  function make(renderer, lv) {
    const v = new T.Vector2(); renderer.getDrawingBufferSize(v);
    if (v.x === w && v.y === h && lv === level && rtMain) return;
    w = v.x; h = v.y; level = lv;
    for (const r of [rtMain, rtA, rtB, rtC, rtD]) if (r) r.dispose();
    const dt = new T.DepthTexture(w, h); dt.type = T.UnsignedIntType;
    rtMain = new T.WebGLRenderTarget(w, h, { depthTexture: dt, depthBuffer: true, samples: HL.Settings.data.antialias && renderer.capabilities.isWebGL2 ? 4 : 0 });
    const opt = { depthBuffer: false };
    rtA = new T.WebGLRenderTarget(Math.max(1, w >> 1), Math.max(1, h >> 1), opt); rtB = rtA.clone();
    rtC = new T.WebGLRenderTarget(Math.max(1, w >> 3), Math.max(1, h >> 3), opt); rtD = rtC.clone();
  }
  function pass(renderer, mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(scene2, cam2); }

  function render(renderer, scene, camera, lv, time, t) {
    make(renderer, lv);
    const G = GRADE[time] || GRADE.day;
    renderer.setRenderTarget(rtMain); renderer.render(scene, camera);
    // свечение: яркое → размытие на 1/2 и на 1/8
    bright.uniforms.tColor.value = rtMain.texture; bright.uniforms.threshold.value = G.th; pass(renderer, bright, rtA);
    blur.uniforms.tColor.value = rtA.texture; blur.uniforms.dir.value.set(1 / rtA.width, 0); pass(renderer, blur, rtB);
    blur.uniforms.tColor.value = rtB.texture; blur.uniforms.dir.value.set(0, 1 / rtA.height); pass(renderer, blur, rtA);
    blur.uniforms.tColor.value = rtA.texture; blur.uniforms.dir.value.set(1 / rtC.width, 0); pass(renderer, blur, rtC);
    blur.uniforms.tColor.value = rtC.texture; blur.uniforms.dir.value.set(0, 1 / rtC.height); pass(renderer, blur, rtD);
    blur.uniforms.tColor.value = rtD.texture; blur.uniforms.dir.value.set(1.6 / rtC.width, 0); pass(renderer, blur, rtC);
    blur.uniforms.tColor.value = rtC.texture; blur.uniforms.dir.value.set(0, 1.6 / rtC.height); pass(renderer, blur, rtD);
    const u = comp.uniforms;
    u.tColor.value = rtMain.texture; u.tDepth.value = rtMain.depthTexture; u.tBloom1.value = rtA.texture; u.tBloom2.value = rtD.texture;
    u.near.value = camera.near; u.far.value = camera.far; u.res.value.set(w, h); u.ao.value = lv >= 2 ? 1 : 0; u.bloom.value = G.bloom;
    u.lift.value.set(...G.lift); u.gain.value.set(...G.gain); u.sat.value = G.sat; u.contrast.value = G.contrast; u.vign.value = G.vign; u.time.value = (t || 0) % 10;
    pass(renderer, comp, null);
  }
  function dispose() { for (const r of [rtMain, rtA, rtB, rtC, rtD]) if (r) r.dispose(); rtMain = null; w = h = 0; }
  return { render, dispose };
})();
