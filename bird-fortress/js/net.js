'use strict';
// ============ Сеть: хост и до 2 гостей ============
// Основной путь — прямое соединение через PeerJS (WebRTC). Запасной — ретранслятор через
// публичный MQTT-сервер (если PeerJS недоступен в стране или сеть мешает прямому соединению).
// Хост слушает оба пути сразу; гость пробует PeerJS, а через ~8 с переключается на ретранслятор.
// ?net=local — тестовый режим без интернета (окна одного браузера, BroadcastChannel).
const Net = (() => {
  const N = { active: false, isHost: false, isClient: false, pid: 0, code: '', conns: new Map(), via: '' };
  const LOCAL = new URLSearchParams(location.search).get('net') === 'local';
  const SANDBOXED = /claude\.ai|claudeusercontent|claude\.site/i.test(location.hostname);
  const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
  let peer = null, bc = null, mq = null, hostSend = null, cb = null, myId = '', watchdog = null, gen = 0;
  const ID = code => 'birdwars-v1-' + code;
  const T = code => 'birdwars/v1/' + code;

  function loadScript(src, globalName) {
    if (window[globalName]) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src;
      s.onload = () => window[globalName] ? res() : rej(new Error(globalName));
      s.onerror = () => rej(new Error(globalName)); document.head.append(s);
    });
  }
  const loadPeer = () => loadScript('https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', 'Peer');
  const loadMqtt = () => loadScript('https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js', 'mqtt');
  function genCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 5; i++) c += A[Math.floor(Math.random() * A.length)]; return c; }
  // Подключение к первому доступному MQTT-серверу
  async function mqttConnect() {
    await loadMqtt();
    for (const url of BROKERS) {
      const c = await new Promise(res => {
        let done = false;
        const cl = mqtt.connect(url, { clientId: 'bw' + Math.random().toString(36).slice(2, 10), clean: true, connectTimeout: 6000, reconnectPeriod: 0 });
        cl.on('connect', () => { if (!done) { done = true; res(cl); } });
        cl.on('error', () => { if (!done) { done = true; try { cl.end(true); } catch (e) { } res(null); } });
        setTimeout(() => { if (!done) { done = true; try { cl.end(true); } catch (e) { } res(null); } }, 7000);
      });
      if (c) return c;
    }
    throw new Error('mqtt');
  }
  const pack = o => JSON.stringify(o);
  const unpack = b => { try { return JSON.parse(typeof b === 'string' ? b : new TextDecoder().decode(b)); } catch (e) { return null; } };

  // ---------- хост ----------
  async function host(handlers) {
    close(); const my = ++gen; cb = handlers; N.code = genCode(); N.active = true; N.isHost = true; N.isClient = false;
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
    let opened = false;
    const ready = () => { if (!opened && my === gen) { opened = true; cb.onOpen(N.code); } };
    // 1) PeerJS
    loadPeer().then(() => {
      if (my !== gen) return;
      peer = new Peer(ID(N.code), { debug: 0 });
      peer.on('open', ready);
      peer.on('error', e => { if (e.type === 'unavailable-id' && my === gen) { N.code = genCode(); } });
      peer.on('connection', c => {
        c.on('open', () => { if (N.conns.size >= 2) { c.send({ ev: 'full' }); setTimeout(() => c.close(), 300); return; } N.conns.set(c.peer, { send: d => c.send(d), via: 'p2p' }); cb.onConn(c.peer); });
        c.on('data', d => cb && cb.onData(c.peer, d));
        c.on('close', () => { if (N.conns.delete(c.peer) && cb) cb.onClose(c.peer); });
      });
    }).catch(() => { });
    // 2) запасной ретранслятор MQTT
    mqttConnect().then(cl => {
      if (my !== gen) { cl.end(true); return; }
      mq = cl; mq.subscribe(T(N.code) + '/h');
      const lastSeen = new Map();
      mq.on('message', (topic, buf) => {
        const m = unpack(buf); if (!m || !m.from) return;
        lastSeen.set(m.from, Date.now());
        if (m.hello && !N.conns.has(m.from)) {
          if (N.conns.size >= 2) { mq.publish(T(N.code) + '/g/' + m.from, pack({ ev: 'full' })); return; }
          N.conns.set(m.from, { send: d => mq && mq.publish(T(N.code) + '/g/' + m.from, pack(d)), via: 'relay', relay: true }); cb.onConn(m.from);
        }
        if (m.bye) { if (N.conns.delete(m.from)) cb.onClose(m.from); return; }
        if (m.d !== undefined && N.conns.has(m.from)) cb.onData(m.from, m.d);
      });
      watchdog = setInterval(() => { const now = Date.now(); N.conns.forEach((c, id) => { if (c.relay && now - (lastSeen.get(id) || now) > 12000) { N.conns.delete(id); cb && cb.onClose(id); } }); }, 3000);
      ready();
    }).catch(() => { });
    setTimeout(() => { if (!opened && my === gen && cb) cb.onError({ type: 'server' }); }, 16000);
  }

  // ---------- гость ----------
  async function join(code, handlers) {
    close(); const my = ++gen; cb = handlers; N.code = code.toUpperCase().trim(); N.active = true; N.isHost = false; N.isClient = true;
    if (LOCAL) {
      myId = 'g' + Math.random().toString(36).slice(2, 8);
      bc = new BroadcastChannel('bwnet-' + N.code);
      bc.onmessage = ev => { const m = ev.data; if (m.to === myId) cb.onData('host', m.d); };
      hostSend = d => bc.postMessage({ to: 'host', from: myId, d });
      bc.postMessage({ to: 'host', from: myId, hello: true });
      setTimeout(() => cb.onOpen(), 50);
      return;
    }
    let connected = false;
    const status = s => cb && cb.onStatus && cb.onStatus(s);
    // 1) прямое соединение
    status('p2p');
    const p2p = new Promise(res => {
      loadPeer().then(() => {
        if (my !== gen) return res(false);
        peer = new Peer({ debug: 0 });
        peer.on('open', () => {
          const c = peer.connect(ID(N.code), { reliable: true, serialization: 'json' });
          c.on('open', () => { if (my !== gen || connected) return; connected = true; N.via = 'p2p'; hostSend = d => c.send(d); res(true); cb.onOpen(); });
          c.on('data', d => cb && cb.onData('host', d));
          c.on('close', () => { if (N.via === 'p2p' && cb) cb.onClose(); });
        });
        peer.on('error', () => res(false));
      }).catch(() => res(false));
      setTimeout(() => res(false), 8000);
    });
    if (await p2p) return;
    if (my !== gen) return;
    try { if (peer) peer.destroy(); } catch (e) { } peer = null;
    // 2) ретранслятор
    status('relay');
    try {
      const cl = await mqttConnect(); if (my !== gen) { cl.end(true); return; }
      mq = cl; myId = 'g' + Math.random().toString(36).slice(2, 9);
      let lastHost = Date.now();
      mq.subscribe(T(N.code) + '/g/' + myId);
      mq.on('message', (topic, buf) => {
        const m = unpack(buf); if (!m) return; lastHost = Date.now();
        if (!connected) { connected = true; N.via = 'relay'; cb.onOpen(); }
        cb.onData('host', m);
      });
      hostSend = d => mq && mq.publish(T(N.code) + '/h', pack({ from: myId, d }));
      mq.publish(T(N.code) + '/h', pack({ from: myId, hello: true }));
      setTimeout(() => { if (!connected && my === gen && cb) cb.onError({ type: 'peer-unavailable' }); }, 9000);
      watchdog = setInterval(() => { if (connected && Date.now() - lastHost > 12000 && cb) { const f = cb.onClose; close(); f && f(); } }, 3000);
    } catch (e) { if (my === gen && cb) cb.onError({ type: 'server' }); }
  }
  const send = (id, msg) => { const c = N.conns.get(id); if (c) try { c.send(msg); } catch (e) { } };
  const broadcast = msg => N.conns.forEach(c => { try { c.send(msg); } catch (e) { } });
  const toHost = msg => { if (hostSend) try { hostSend(msg); } catch (e) { } };
  function close() {
    gen++;
    if (LOCAL && bc && N.isClient) try { bc.postMessage({ to: 'host', from: myId, bye: true }); } catch (e) { }
    if (mq && N.isClient && myId) try { mq.publish(T(N.code) + '/h', pack({ from: myId, bye: true })); } catch (e) { }
    try { if (peer) peer.destroy(); } catch (e) { }
    try { if (bc) bc.close(); } catch (e) { }
    try { if (mq) setTimeout((m => () => m.end(true))(mq), 200); } catch (e) { }
    if (watchdog) clearInterval(watchdog);
    peer = null; bc = null; mq = null; hostSend = null; cb = null; watchdog = null; myId = '';
    N.conns.clear(); N.active = false; N.isHost = false; N.isClient = false; N.code = ''; N.via = '';
  }
  return Object.assign(N, { host, join, send, broadcast, toHost, close, LOCAL, SANDBOXED });
})();
