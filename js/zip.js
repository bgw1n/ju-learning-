/* zip.js - tiny single-file zip pack/unpack for backup attachments. No CDN.
   Pack prefers CompressionStream('deflate-raw') when available, else store (method 0).
   Unpack reads the first .json (or first file) from a zip that this packer (or a normal zip) wrote. */
(function () {
  const te = new TextEncoder(), td = new TextDecoder();
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function u16(n) { return new Uint8Array([n & 255, (n >>> 8) & 255]); }
  function u32(n) { return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]); }
  function concat(parts) {
    let n = 0; for (const p of parts) n += p.length;
    const out = new Uint8Array(n); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  async function deflateRaw(u8) {
    if (typeof CompressionStream === 'undefined') return null;
    try {
      const stream = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      const out = new Uint8Array(await new Response(stream).arrayBuffer());
      return out.length && out.length < u8.length ? out : null;
    } catch (e) { return null; }
  }
  async function inflateRaw(u8) {
    if (typeof DecompressionStream === 'undefined') throw new Error('no inflate');
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  function isZip(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    return u8.length >= 4 && u8[0] === 0x50 && u8[1] === 0x4b && (u8[2] === 0x03 || u8[2] === 0x05 || u8[2] === 0x07) && (u8[3] === 0x04 || u8[3] === 0x06 || u8[3] === 0x08);
  }
  /* files: [{ name, data: Uint8Array|ArrayBuffer|string }] -> Blob application/zip */
  async function pack(files) {
    const locals = [], centrals = [];
    let offset = 0;
    for (const f of files) {
      const name = te.encode(f.name);
      const data = typeof f.data === 'string' ? te.encode(f.data)
        : f.data instanceof Uint8Array ? f.data
        : new Uint8Array(f.data);
      const crc = crc32(data);
      let method = 0, payload = data;
      const deflated = await deflateRaw(data);
      if (deflated) { method = 8; payload = deflated; }
      const local = concat([
        u32(0x04034b50), u16(20), u16(0), u16(method), u16(0), u16(0),
        u32(crc), u32(payload.length), u32(data.length), u16(name.length), u16(0),
        name, payload
      ]);
      const central = concat([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(method), u16(0), u16(0),
        u32(crc), u32(payload.length), u32(data.length), u16(name.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(offset), name
      ]);
      locals.push(local); centrals.push(central); offset += local.length;
    }
    const centralBlob = concat(centrals);
    const end = concat([
      u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
      u32(centralBlob.length), u32(offset), u16(0)
    ]);
    return new Blob([concat(locals.concat([centralBlob, end]))], { type: 'application/zip' });
  }
  function readU16(u8, i) { return u8[i] | (u8[i + 1] << 8); }
  function readU32(u8, i) { return (u8[i] | (u8[i + 1] << 8) | (u8[i + 2] << 16) | (u8[i + 3] << 24)) >>> 0; }
  /* returns [{ name, data: Uint8Array }] for local-file entries (store or deflate-raw) */
  async function unpack(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (!isZip(u8)) throw new Error('not a zip');
    const out = [];
    let i = 0;
    while (i + 30 <= u8.length && readU32(u8, i) === 0x04034b50) {
      const method = readU16(u8, i + 8);
      const comp = readU32(u8, i + 18), uncomp = readU32(u8, i + 22);
      const nlen = readU16(u8, i + 26), xlen = readU16(u8, i + 28);
      const name = td.decode(u8.subarray(i + 30, i + 30 + nlen));
      const start = i + 30 + nlen + xlen;
      const payload = u8.subarray(start, start + comp);
      let data;
      if (method === 0) data = payload.slice();
      else if (method === 8) data = await inflateRaw(payload);
      else throw new Error('zip method ' + method);
      if (uncomp && data.length !== uncomp) { /* some writers leave sizes 0 when streaming; accept length we got */ }
      out.push({ name, data });
      i = start + comp;
    }
    if (!out.length) throw new Error('empty zip');
    return out;
  }
  async function readJsonFromZip(buf) {
    const files = await unpack(buf);
    const hit = files.find(f => /\.json$/i.test(f.name)) || files[0];
    return JSON.parse(td.decode(hit.data));
  }
  JU.zip = { pack, unpack, isZip, readJsonFromZip, crc32 };
})();
