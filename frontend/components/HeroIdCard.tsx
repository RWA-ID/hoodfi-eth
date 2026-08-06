"use client";

import { useEffect, useRef } from "react";

/**
 * The hero's floating membership card.
 *
 * The card face is painted to a 2D canvas and used as a texture on a three.js
 * mesh — text stays crisp at any size and re-skinning an identity is just a
 * redraw. Every SWAP_EVERY seconds the card spins a full turn; the texture is
 * swapped at the halfway point, while the card's edge faces the camera, so the
 * change is never visible.
 *
 * three is pulled in with a runtime import so it lands in its own chunk instead
 * of the initial page bundle.
 */

type Identity = { name: string; file: string; token: string };

/** Placeholder identities — swap for real reserved names once the drive closes. */
const CARDS: Identity[] = [
  { name: "degen", file: "/avatars/av-degen.jpg", token: "0007" },
  { name: "jane", file: "/avatars/av-jane.png", token: "0142" },
  { name: "trader", file: "/avatars/av-trader.jpg", token: "0088" },
  { name: "joe", file: "/avatars/av-joe.jpg", token: "0311" },
  { name: "blake", file: "/avatars/av-blake.jpg", token: "0420" },
  { name: "gme", file: "/avatars/av-gme.jpg", token: "0069" },
  { name: "punk", file: "/avatars/av-punk.png", token: "0256" },
  { name: "satoshi", file: "/avatars/av-satoshi.jpg", token: "0777" },
];

const GREEN = "#00c805";
const FW = 768; // face texture size (portrait, matches the mesh's 3.05 × 4.2)
const FH = 1056;
const SWAP_EVERY = 3.4; // seconds between identity flips
const FLIP_SECONDS = 0.85;

type Fonts = { display: string; mono: string };

/** next/font emits hashed family names, so read them off the CSS variables. */
function cssFont(name: string, fallback: string) {
  const v = getComputedStyle(document.body).getPropertyValue(name).trim();
  return v || fallback;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Draw `img` filling the box, cropping the overflowing axis (CSS object-fit: cover). */
function coverDraw(
  c: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number
) {
  if (!img) {
    c.fillStyle = "#20302a";
    c.fillRect(x, y, w, h);
    return;
  }
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sw: number, sh: number, sx: number, sy: number;
  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  c.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawFace(
  c: CanvasRenderingContext2D,
  card: Identity,
  avatar: HTMLImageElement | null,
  logo: HTMLImageElement | null,
  fonts: Fonts
) {
  const P = 56;
  const R = 46;
  c.clearRect(0, 0, FW, FH);

  // body: ink gradient + a green bloom bleeding in from the top edge
  c.save();
  c.beginPath();
  c.roundRect(6, 6, FW - 12, FH - 12, R);
  c.clip();
  const bg = c.createLinearGradient(0, 0, FW, FH);
  bg.addColorStop(0, "#0c130f");
  bg.addColorStop(1, "#080d0a");
  c.fillStyle = bg;
  c.fillRect(0, 0, FW, FH);
  const glow = c.createRadialGradient(FW * 0.2, -40, 20, FW * 0.2, -40, 620);
  glow.addColorStop(0, "rgba(0,200,5,0.16)");
  glow.addColorStop(1, "rgba(0,200,5,0)");
  c.fillStyle = glow;
  c.fillRect(0, 0, FW, FH);
  c.restore();

  // two inset hairlines — the site uses these instead of shadows
  c.strokeStyle = "rgba(148,210,165,0.22)";
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(9, 9, FW - 18, FH - 18, R - 3);
  c.stroke();
  c.strokeStyle = "rgba(0,200,5,0.30)";
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(20, 20, FW - 40, FH - 40, R - 14);
  c.stroke();

  if (logo) {
    const lw = 250;
    c.drawImage(logo, P, P - 6, lw, (lw * logo.height) / logo.width);
  }

  // top-right membership chip
  c.textAlign = "right";
  c.textBaseline = "middle";
  c.fillStyle = GREEN;
  c.beginPath();
  c.arc(FW - P - 152, P + 22, 6, 0, Math.PI * 2);
  c.fill();
  c.font = `600 27px ${fonts.mono}`;
  c.fillStyle = "rgba(233,242,234,0.92)";
  c.fillText("HoodFi.eth", FW - P, P + 22);
  c.font = `500 18px ${fonts.mono}`;
  c.fillStyle = "rgba(233,242,234,0.34)";
  c.fillText("MEMBER · L2", FW - P, P + 52);

  // avatar frame
  const AS = 470;
  const AX = (FW - AS) / 2;
  const AY = 196;
  c.save();
  c.shadowColor = "rgba(0,200,5,0.55)";
  c.shadowBlur = 34;
  c.fillStyle = "#0a0f0c";
  c.beginPath();
  c.roundRect(AX, AY, AS, AS, 34);
  c.fill();
  c.restore();
  c.save();
  c.beginPath();
  c.roundRect(AX + 7, AY + 7, AS - 14, AS - 14, 27);
  c.clip();
  coverDraw(c, avatar, AX + 7, AY + 7, AS - 14, AS - 14);
  c.restore();
  c.lineWidth = 5;
  c.strokeStyle = GREEN;
  c.beginPath();
  c.roundRect(AX + 2.5, AY + 2.5, AS - 5, AS - 5, 34);
  c.stroke();
  c.lineWidth = 1.5;
  c.strokeStyle = "rgba(233,242,234,0.14)";
  c.beginPath();
  c.roundRect(AX + 9, AY + 9, AS - 18, AS - 18, 25);
  c.stroke();

  // the name — label in chrome white, suffix in green, shrunk to fit
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  const nameY = AY + AS + 96;
  const suffix = ".hoodfi.eth";
  let fs = 64;
  c.font = `800 ${fs}px ${fonts.display}`;
  while (c.measureText(card.name + suffix).width > FW - 2 * P && fs > 34) {
    fs -= 2;
    c.font = `800 ${fs}px ${fonts.display}`;
  }
  const startX = (FW - c.measureText(card.name + suffix).width) / 2;
  c.fillStyle = "#e9f2ea";
  c.fillText(card.name, startX, nameY);
  c.fillStyle = GREEN;
  c.fillText(suffix, startX + c.measureText(card.name).width, nameY);

  c.textAlign = "center";
  c.font = `500 20px ${fonts.mono}`;
  c.fillStyle = "rgba(233,242,234,0.40)";
  c.fillText(
    "R O B I N H O O D   C H A I N   ·   C H A I N   4 6 6 3",
    FW / 2,
    nameY + 38
  );

  // field row
  const fy = nameY + 104;
  const fields: [string, string][] = [
    ["TOKEN", "#" + card.token],
    ["CHAIN", "4663"],
    ["SECURED", "2127"],
  ];
  const colW = (FW - 2 * P) / 3;
  fields.forEach(([label, value], i) => {
    const cx = P + colW * i + colW / 2;
    c.textAlign = "center";
    c.font = `500 17px ${fonts.mono}`;
    c.fillStyle = "rgba(233,242,234,0.36)";
    c.fillText(label, cx, fy);
    c.font = `600 30px ${fonts.mono}`;
    c.fillStyle = "#e9f2ea";
    c.fillText(value, cx, fy + 34);
  });
  c.strokeStyle = "rgba(148,210,165,0.18)";
  c.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    const x = P + colW * i;
    c.beginPath();
    c.moveTo(x, fy - 14);
    c.lineTo(x, fy + 30);
    c.stroke();
  }

  // barcode — deterministic per token, so an identity always looks the same
  const by = fy + 70;
  const bx = P;
  const bw = FW - 2 * P;
  let x = bx;
  let seed = parseInt(card.token, 10) + 7;
  c.fillStyle = "rgba(233,242,234,0.5)";
  while (x < bx + bw) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const w = 1 + ((seed >> 4) % 5);
    if ((seed >> 8) % 3 !== 0) c.fillRect(x, by, w, 26);
    x += w + 1 + ((seed >> 2) % 3);
  }
  c.textAlign = "left";
  c.font = `500 16px ${fonts.mono}`;
  c.fillStyle = "rgba(233,242,234,0.30)";
  c.fillText("0x" + (card.token + "a3f").padStart(8, "0") + "…hoodfi", bx, by + 48);
}

function drawBack(
  c: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  fonts: Fonts
) {
  const R = 46;
  c.clearRect(0, 0, FW, FH);
  c.save();
  c.beginPath();
  c.roundRect(6, 6, FW - 12, FH - 12, R);
  c.clip();
  const bg = c.createLinearGradient(0, 0, FW, FH);
  bg.addColorStop(0, "#0b110d");
  bg.addColorStop(1, "#070b09");
  c.fillStyle = bg;
  c.fillRect(0, 0, FW, FH);
  c.restore();
  c.strokeStyle = "rgba(0,200,5,0.28)";
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(20, 20, FW - 40, FH - 40, R - 14);
  c.stroke();

  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `900 420px ${fonts.display}`;
  c.fillStyle = "rgba(0,200,5,0.10)";
  c.fillText("H", FW / 2, FH / 2 - 20);
  if (logo) {
    const lw = 300;
    const lh = (lw * logo.height) / logo.width;
    c.globalAlpha = 0.9;
    c.drawImage(logo, (FW - lw) / 2, FH / 2 - lh / 2 - 160, lw, lh);
    c.globalAlpha = 1;
  }
  c.font = `600 30px ${fonts.mono}`;
  c.fillStyle = "rgba(233,242,234,0.6)";
  c.fillText("LIFETIME · NO EXPIRY", FW / 2, FH - 150);
  c.font = `500 22px ${fonts.mono}`;
  c.fillStyle = "rgba(233,242,234,0.34)";
  c.fillText("one name · one time · yours forever", FW / 2, FH - 108);
}

export function HeroIdCard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    let disposed = false;
    let raf = 0;
    const teardown: Array<() => void> = [];

    (async () => {
      const THREE = await import("three");
      if (disposed) return;

      const fonts: Fonts = {
        display: cssFont("--font-archivo", "sans-serif"),
        mono: cssFont("--font-mono", "monospace"),
      };
      // Canvas text falls back to a system face if the webfont isn't ready yet,
      // and there's no re-render to fix it — so wait before the first draw.
      try {
        await Promise.all([
          document.fonts.load(`800 100px ${fonts.display}`),
          document.fonts.load(`900 100px ${fonts.display}`),
          document.fonts.load(`600 60px ${fonts.mono}`),
          document.fonts.load(`500 40px ${fonts.mono}`),
        ]);
        await document.fonts.ready;
      } catch {
        /* fall back to whatever the browser picks */
      }
      if (disposed) return;

      const [logo, ...avatars] = await Promise.all([
        loadImage("/hoodfi-logo.png"),
        ...CARDS.map((c) => loadImage(c.file)),
      ]);
      if (disposed) return;

      const faceCanvas = document.createElement("canvas");
      faceCanvas.width = FW;
      faceCanvas.height = FH;
      const faceCtx = faceCanvas.getContext("2d");
      const backCanvas = document.createElement("canvas");
      backCanvas.width = FW;
      backCanvas.height = FH;
      const backCtx = backCanvas.getContext("2d");
      if (!faceCtx || !backCtx) return;

      let idx = 0;
      drawFace(faceCtx, CARDS[idx], avatars[idx], logo, fonts);
      drawBack(backCtx, logo, fonts);

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true, // transparent, so the CSS green pool shows through
      });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      camera.position.set(0, 0.15, 9.2);

      scene.add(new THREE.AmbientLight(0xbfd8c4, 1.15));
      const key = new THREE.DirectionalLight(0xffffff, 1.5);
      key.position.set(3.5, 4.5, 5);
      const rim = new THREE.DirectionalLight(0x36ff78, 0.9);
      rim.position.set(-4.5, 2, -3);
      const pool = new THREE.PointLight(0x00c805, 22, 22, 2);
      pool.position.set(-2, -1, 3.5);
      scene.add(key, rim, pool);

      // card body: extruded rounded rect
      const W = 3.05;
      const H = 4.2;
      const depth = 0.16;
      const rad = 0.28;
      const shape = new THREE.Shape();
      const x0 = -W / 2;
      const y0 = -H / 2;
      shape.moveTo(x0 + rad, y0);
      shape.lineTo(x0 + W - rad, y0);
      shape.quadraticCurveTo(x0 + W, y0, x0 + W, y0 + rad);
      shape.lineTo(x0 + W, y0 + H - rad);
      shape.quadraticCurveTo(x0 + W, y0 + H, x0 + W - rad, y0 + H);
      shape.lineTo(x0 + rad, y0 + H);
      shape.quadraticCurveTo(x0, y0 + H, x0, y0 + H - rad);
      shape.lineTo(x0, y0 + rad);
      shape.quadraticCurveTo(x0, y0, x0 + rad, y0);

      const bodyGeo = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.035,
        bevelSize: 0.035,
        bevelSegments: 2,
        steps: 1,
      });
      bodyGeo.translate(0, 0, -depth / 2);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x0b1510,
        metalness: 0.55,
        roughness: 0.4,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);

      const anisotropy = renderer.capabilities.getMaxAnisotropy();

      // Unlit face art, so the card stays legible whatever the lighting does.
      const faceTex = new THREE.CanvasTexture(faceCanvas);
      faceTex.colorSpace = THREE.SRGBColorSpace;
      faceTex.anisotropy = anisotropy;
      const faceMat = new THREE.MeshBasicMaterial({ map: faceTex, transparent: true });
      const planeGeo = new THREE.PlaneGeometry(W, H);
      const facePlane = new THREE.Mesh(planeGeo, faceMat);
      facePlane.position.z = depth / 2 + 0.06;

      // No texture mirroring here: rotating the plane π about Y already puts u=1
      // on the viewer's right when the back faces the camera, so the art reads
      // the right way round. (The prototype's repeat.x = -1 double-flips it.)
      const backTex = new THREE.CanvasTexture(backCanvas);
      backTex.colorSpace = THREE.SRGBColorSpace;
      backTex.anisotropy = anisotropy;
      const backMat = new THREE.MeshBasicMaterial({ map: backTex, transparent: true });
      const backPlane = new THREE.Mesh(planeGeo, backMat);
      backPlane.position.z = -(depth / 2 + 0.06);
      backPlane.rotation.y = Math.PI;

      const card = new THREE.Group();
      card.add(body, facePlane, backPlane);
      scene.add(card);

      function resize() {
        const w = stage!.clientWidth;
        const h = stage!.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        // Pull the camera back far enough to frame the whole card, whichever
        // axis is the tighter fit at this aspect ratio.
        const vFov = THREE.MathUtils.degToRad(camera.fov);
        const distH = (H / 2 + 0.85) / Math.tan(vFov / 2);
        const distW = (W / 2 + 0.95) / camera.aspect / Math.tan(vFov / 2);
        camera.position.z = Math.max(distH, distW);
      }
      const ro = new ResizeObserver(resize);
      ro.observe(stage);
      resize();
      teardown.push(() => ro.disconnect());

      // Don't burn GPU on a hero that's scrolled off the screen.
      let visible = true;
      const io = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
        },
        { rootMargin: "120px" }
      );
      io.observe(stage);
      teardown.push(() => io.disconnect());

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let last = performance.now() / 1000;
      let t = 0;
      let nextSwap = SWAP_EVERY;
      let flip = 0;
      let flipping = false;
      let swapped = false;

      function tick() {
        raf = requestAnimationFrame(tick);
        const now = performance.now() / 1000;
        const dt = Math.min(0.05, now - last); // clamped so a stalled tab can't jump
        last = now;
        if (!visible) return;
        t += dt;

        if (!reduce && t >= nextSwap && !flipping) {
          nextSwap = t + SWAP_EVERY;
          flipping = true;
          flip = 0;
          swapped = false;
        }

        // idle float
        let ry = Math.sin(t * 0.5) * 0.22;
        const rx = Math.sin(t * 0.62) * 0.05;
        const py = Math.sin(t * 0.9) * 0.06;

        if (flipping) {
          flip += dt / FLIP_SECONDS;
          const e =
            flip < 0.5 ? 2 * flip * flip : 1 - Math.pow(-2 * flip + 2, 2) / 2;
          ry += e * Math.PI * 2; // a full turn, so the face comes back to camera
          // Swap at the halfway point — the card is edge-on, the change is hidden.
          if (flip >= 0.5 && !swapped) {
            idx = (idx + 1) % CARDS.length;
            drawFace(faceCtx!, CARDS[idx], avatars[idx], logo, fonts);
            faceTex.needsUpdate = true;
            swapped = true;
          }
          if (flip >= 1) {
            flipping = false;
            flip = 0;
          }
        }

        card.rotation.set(rx, ry, 0);
        card.position.y = py;
        renderer.render(scene, camera);
      }
      tick();

      teardown.push(() => {
        bodyGeo.dispose();
        planeGeo.dispose();
        bodyMat.dispose();
        faceMat.dispose();
        backMat.dispose();
        faceTex.dispose();
        backTex.dispose();
        renderer.dispose();
      });
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      teardown.forEach((fn) => fn());
    };
  }, []);

  return (
    <div ref={stageRef} className="stage" aria-hidden="true">
      <canvas ref={canvasRef} />
      <div className="eyebrow absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[var(--faint)]">
        minting identity · robinhood chain
      </div>
    </div>
  );
}
