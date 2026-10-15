/* Shrinks photos in the browser before they're uploaded: at most 2048 px on the long side, saved as a good-quality JPEG
   (or WebP for PNGs, which keeps see-through backgrounds). A 4 MB phone photo usually ends up around 300–600 KB and looks the same.
   Redrawing the photo also drops its hidden camera data (EXIF), including the GPS location phones add.
   GIFs (they may move) and anything the browser can't read are uploaded as they are. */
(() => {
  "use strict";
  const toBlob = (canvas, type, q) => new Promise((ok) => canvas.toBlob(ok, type, q));
  async function decode(file) {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch {}
    return await new Promise((ok, no) => { const img = new Image(); img.onload = () => ok(img); img.onerror = no; img.src = URL.createObjectURL(file); });
  }
  window.VCShrink = async function (file, opts) {
    const o = Object.assign({ max: 2048, quality: 0.82 }, opts || {});
    try {
      if (!file || !/^image\//.test(file.type) || /gif/i.test(file.type)) return file;
      const pic = await decode(file);
      const W = pic.width || pic.naturalWidth, H = pic.height || pic.naturalHeight;
      if (!W || !H) return file;
      const scale = Math.min(1, o.max / Math.max(W, H));
      const w = Math.max(1, Math.round(W * scale)), h = Math.max(1, Math.round(H * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      const keepClear = /png|webp/i.test(file.type);
      let type = keepClear ? "image/webp" : "image/jpeg";
      if (!keepClear) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(pic, 0, 0, w, h);
      if (pic.close) pic.close();
      let blob = await toBlob(canvas, type, o.quality);
      // Older Safari can't make WebP and hands back a PNG; try JPEG on a dark background instead.
      if (!blob || blob.type !== type) {
        type = "image/jpeg";
        ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = "#19191a"; ctx.fillRect(0, 0, w, h);
        blob = await toBlob(canvas, type, o.quality);
      }
      if (!blob || (blob.size >= file.size && scale === 1)) return file;
      const name = (file.name || "photo").replace(/\.[^.]+$/, "") + (type === "image/webp" ? ".webp" : ".jpg");
      return new File([blob], name, { type, lastModified: Date.now() });
    } catch { return file; }
  };
})();
