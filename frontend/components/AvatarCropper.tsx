"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AVATAR_EDGE, encodeAvatar } from "@/lib/avatar";

/** Preview box, in CSS pixels. Square, because the output is. */
const BOX = 268;

/** How far in you can push. Beyond ~4x a 512px export is guessing at pixels. */
const MAX_ZOOM = 4;

type Placement = { zoom: number; x: number; y: number };

/**
 * Choose the crop, instead of having it chosen for you.
 *
 * A centred square of the largest possible size is the obvious default and it is wrong
 * for the images people actually reach for. The first real upload here was a screenshot
 * of an NFT card — artwork inset on a dark background with a caption underneath — so the
 * square kept the margins and the circle came out with black down two sides and along
 * the bottom. No automatic rule fixes that in general: only the person looking at it
 * knows which part is the subject.
 *
 * Pan with a finger or the mouse, zoom with the slider. The viewport is square and so
 * is the export — avatars render square everywhere on this site now — but other clients
 * crop the same record their own way, including round.
 */
export function AvatarCropper({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
}) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState<Placement>({ zoom: 1, x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    let dead = false;
    let created: ImageBitmap | null = null;
    // `from-image` applies the EXIF rotation phone cameras write, which canvas
    // otherwise ignores — without it portrait photos load on their side.
    createImageBitmap(file, { imageOrientation: "from-image" })
      .then((bmp) => {
        if (dead) {
          bmp.close();
          return;
        }
        created = bmp;
        setBitmap(bmp);
      })
      .catch(() => {
        if (!dead) setError("Couldn't read that image.");
      });
    return () => {
      dead = true;
      created?.close();
    };
  }, [file]);

  /** Scale at which the image exactly covers the box; every zoom is a multiple of it. */
  const base = bitmap ? BOX / Math.min(bitmap.width, bitmap.height) : 1;
  const scale = base * place.zoom;

  /**
   * Keep the box covered.
   *
   * Panning is otherwise free to drag an edge inward and expose the backdrop, which
   * would bake a transparent wedge into the export — the exact defect this screen
   * exists to prevent.
   */
  const clamp = useCallback(
    (next: Placement): Placement => {
      if (!bitmap) return next;
      const s = base * next.zoom;
      const minX = BOX - bitmap.width * s;
      const minY = BOX - bitmap.height * s;
      return {
        zoom: next.zoom,
        x: Math.min(0, Math.max(minX, next.x)),
        y: Math.min(0, Math.max(minY, next.y)),
      };
    },
    [bitmap, base]
  );

  // Centre on load, and re-centre whenever the zoom changes so the middle of the
  // viewport stays put rather than the top-left corner.
  useEffect(() => {
    if (!bitmap) return;
    setPlace((p) =>
      clamp({
        zoom: p.zoom,
        x: (BOX - bitmap.width * base * p.zoom) / 2,
        y: (BOX - bitmap.height * base * p.zoom) / 2,
      })
    );
  }, [bitmap, base, clamp]);

  function onZoom(zoom: number) {
    setPlace((p) => {
      if (!bitmap) return { ...p, zoom };
      // Zoom about the centre of the viewport: convert the centre to image space at
      // the old scale, then place it back at the centre under the new one.
      const oldS = base * p.zoom;
      const newS = base * zoom;
      const cx = (BOX / 2 - p.x) / oldS;
      const cy = (BOX / 2 - p.y) / oldS;
      return clamp({ zoom, x: BOX / 2 - cx * newS, y: BOX / 2 - cy * newS });
    });
  }

  function pointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: place.x, y: place.y };
  }
  function pointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    setPlace((p) =>
      clamp({ zoom: p.zoom, x: d.x + (e.clientX - d.px), y: d.y + (e.clientY - d.py) })
    );
  }
  function pointerUp() {
    drag.current = null;
  }

  function confirm() {
    if (!bitmap) return;
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_EDGE;
    canvas.height = AVATAR_EDGE;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Couldn't read that image.");
      return;
    }
    // The viewport shows a BOX-sized window onto the scaled image; in image
    // coordinates that window starts at (-x/scale, -y/scale) and is BOX/scale across.
    const size = BOX / scale;
    ctx.drawImage(
      bitmap,
      -place.x / scale,
      -place.y / scale,
      size,
      size,
      0,
      0,
      AVATAR_EDGE,
      AVATAR_EDGE
    );
    onDone(encodeAvatar(canvas));
  }

  return (
    <div className="mt-3 border border-[var(--line-card)] p-4">
      <div className="label" style={{ letterSpacing: "0.16em" }}>
        Drag to position · pinch or slide to zoom
      </div>

      {error ? (
        <div className="data mt-3 text-xs" style={{ color: "var(--bad)" }}>{error}</div>
      ) : (
        <>
          <div
            className="relative mx-auto mt-3 touch-none overflow-hidden bg-[var(--ink)]"
            style={{ width: BOX, height: BOX }}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
          >
            {bitmap && (
              // eslint-disable-next-line @next/next/no-img-element -- object URL, no optimizer
              <img
                src={URL.createObjectURL(file)}
                alt=""
                draggable={false}
                className="absolute left-0 top-0 max-w-none select-none"
                style={{
                  width: bitmap.width * scale,
                  height: bitmap.height * scale,
                  transform: `translate(${place.x}px, ${place.y}px)`,
                }}
              />
            )}
            {/* The crop is the whole box and avatars render square, so the frame is a
                plain hairline — a round mask here would preview a shape the site never
                actually draws. Pointer-events off, or it would swallow the drag. */}
            <div className="pointer-events-none absolute inset-0 border border-[var(--lime)]" />
          </div>

          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={place.zoom}
            onChange={(e) => onZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="mt-4 w-full accent-[var(--olive)]"
          />

          <div className="mt-3 flex gap-2.5">
            <button
              type="button"
              className="btn btn-ink flex-1"
              onClick={confirm}
              disabled={!bitmap}
            >
              Use this
            </button>
            <button type="button" className="btn btn-ghost flex-1" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
