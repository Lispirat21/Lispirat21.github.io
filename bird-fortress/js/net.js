'use strict';
// ============ Сеть: хост и до 2 гостей. Соединение напрямую через PeerJS (WebRTC) ============
// ?net=local — тестовый режим без интернета: окна одного браузера общаются через BroadcastChannel.
const Net = (() => {
  const N = { active: false, isHost: false, isClient: false, pid: 0, code: '', conns: new Map() };
  const LOCAL = new URLSearchParams(location.search).get('net') === 'local';
  let peer = null, bc = null, hostSend = null, cb = null, myId = '';
  const ID = code => 'birdwars-v1-' + code;

  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
      s.onload = () => res(); s.onerror = () => rej(new Error('peerjs'));
      document.head.append(s);
    });
  }
  function genCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 5; i++) c += A[Math.floor(Math.random() * A.length)]; return c; }

  // Хост: ждёт гостей. handlers: onOpen(code), onConn(id), onData(id, msg), onClose(id), onError(err)
  async function host(handlers) {
    close(); cb = handlers; N.code = genCode(); N.active = true; N.isHost = true; N.isClient = false;
    if (LOCAL) {
      bc = new BroadcastChannel('bwnet-' + N.code);
      bc.onmessage = ev => {
        const m = ev.data; if (m.to !== 'host') return;
        if (m.hello && !N.conns.has(m.from)) { N.conns.set(m.from, { send: d => bc.postMessage({ to: m.from, d }) }); cb.onConn(m.from); }
        if (m.bye) { N.conns.delete(m.from); cb.onClose(m.from); return; }
        if (m.d !== undefined) cb.onData(m.from, m.d);
      };
      setTimeout(() => cb.onOpen(N.code), 0);
      return;
    }
    await loadPeer();
    peer = new Peer(ID(N.code), { debug: 0 });
    peer.on('open', () => cb.onOpen(N.code));
    peer.on('error', e => { if (e.type === 'unavailable-id') { peer.destroy(); host(handlers); return; } cb.onError(e); });
    peer.on('connection', c => {
      c.on('open', () => { if (N.conns.size >= 2) { c.send({ ev: 'full' }); setTimeout(() => c.close(), 300); return; } N.conns.set(c.peer, c); cb.onConn(c.peer); });
      c.on('data', d => cb.onData(c.peer, d));
      c.on('close', () => { if (N.conns.delete(c.peer)) cb.onClose(c.peer); });
    });
  }
  // Гость: подключается к хосту по коду. handlers: onOpen(), onData('host', msg), onClose(), onError(err)
  async function join(code, handlers) {
    close(); cb = handlers; N.code = code.toUpperCase().trim(); N.active = true; N.isHost = false; N.isClient = true;
    if (LOCAL) {
      myId = 'g' + Math.random().toString(36).slice(2, 8);
      bc = new BroadcastChannel('bwnet-' + N.code);
      bc.onmessage = ev => { const m = ev.data; if (m.to === myId) cb.onData('host', m.d); };
      hostSend = d => bc.postMessage({ to: 'host', from: myId, d });
      bc.postMessage({ to: 'host', from: myId, hello: true });
      setTimeout(() => cb.onOpen(), 50);
      return;
    }
    await loadPeer();
    peer = new Peer({ debug: 0 });
    let opened = false;
    peer.on('open', () => {
      const c = peer.connect(ID(N.code), { reliable: true, serialization: 'json' });
      c.on('open', () => { opened = true; hostSend = d => c.send(d); cb.onOpen(); });
      c.on('data', d => cb.onData('host', d));
      c.on('close', () => cb.onClose());
    });
    peer.on('error', e => cb.onError(e));
    setTimeout(() => { if (!opened && N.isClient && cb) cb.onError({ type: 'timeout' }); }, 15000);
  }
  const send = (id, msg) => { const c = N.conns.get(id); if (c) try { c.send(msg); } catch (e) { } };
  const broadcast = msg => N.conns.forEach(c => { try { c.send(msg); } catch (e) { } });
  const toHost = msg => { if (hostSend) try { hostSend(msg); } catch (e) { } };
  function close() {
    if (LOCAL && bc && N.isClient) try { bc.postMessage({ to: 'host', from: myId, bye: true }); } catch (e) { }
    try { if (peer) peer.destroy(); } catch (e) { }
    try { if (bc) bc.close(); } catch (e) { }
    peer = null; bc = null; hostSend = null; cb = null;
    N.conns.clear(); N.active = false; N.isHost = false; N.isClient = false; N.code = '';
  }
  return Object.assign(N, { host, join, send, broadcast, toHost, close, LOCAL });
})();
