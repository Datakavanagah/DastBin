"use client";
import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Hand, ScanLine, ShieldCheck, CircleHelp, Power, Maximize, Activity } from 'lucide-react';
type Reading = { state: string; score: number; points: { x: number; y: number }[] };
const labels: Record<string, string> = { idle: 'آمادهٔ شروع', none: 'دست دیده نمی‌شود', open: 'دست باز است', closed: 'دست بسته است', other: 'حالت نامشخص' };
const edges = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
export default function Home() {
  const [phase, setPhase] = useState('idle');
  const [message, setMessage] = useState('');
  const [reading, setReading] = useState<Reading>({ state: 'idle', score: 0, points: [] });
  const [overlay, setOverlay] = useState(true);
  const [help, setHelp] = useState(false);
  const video = useRef<HTMLVideoElement>(null), canvas = useRef<HTMLCanvasElement>(null), surface = useRef<HTMLDivElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recognizer = useRef<{ close?: () => void; recognizeForVideo: (video: HTMLVideoElement, time: number) => { landmarks: { x: number; y: number }[][]; gestures: { categoryName: string; score: number }[][] } } | null>(null);
  const generation = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stable = useRef({ value: '', count: 0 }), current = useRef(reading);
  current.current = reading;
  function release() {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    recognizer.current?.close?.(); recognizer.current = null;
    stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    stable.current = { value: '', count: 0 };
  }
  function stop() { release(); setPhase('idle'); setMessage(''); setReading({ state: 'idle', score: 0, points: [] }); }
  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => { release(); document.removeEventListener('visibilitychange', hide); };
  }, []);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d'); if (!ctx || !canvas.current) return;
    const { width: w, height: h } = canvas.current; ctx.clearRect(0,0,w,h); if (!overlay) return;
    ctx.strokeStyle = reading.state === 'closed' ? '#ffb56a' : '#b7fa68'; ctx.lineWidth = 3;
    for (const [a,b] of edges) { const p = reading.points[a], q = reading.points[b]; if (!p || !q) continue; ctx.beginPath(); ctx.moveTo(p.x*w,p.y*h); ctx.lineTo(q.x*w,q.y*h); ctx.stroke(); }
    for (const p of reading.points) { ctx.beginPath(); ctx.arc(p.x*w,p.y*h,4,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill(); }
  }, [reading, overlay]);
  useEffect(() => {
    const context = (document as unknown as { modelContext?: { registerTool: (tool: unknown, options: unknown) => Promise<void> } }).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try { Promise.resolve(context.registerTool({ name: 'get_hand_state', description: 'Read the current locally detected hand state; does not start the camera.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: (input: unknown) => { if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Expected an empty object'); return { state: current.current.state, confidence: current.current.score }; } }, { signal: lifecycle.signal })).catch(() => {}); } catch {}
    return () => lifecycle.abort();
  }, []);
  async function start() {
    release(); const id = generation.current; setMessage(''); setPhase('loading'); setReading({ state: 'idle', score: 0, points: [] });
    const fail = (text: string) => { if (id !== generation.current) return; release(); setPhase('error'); setMessage(text); setReading({ state: 'idle', score: 0, points: [] }); };
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('secure');
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
      if (id !== generation.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media; media.getVideoTracks()[0].onended = () => fail('ارتباط دوربین قطع شد. دوباره شروع کنید.');
      video.current!.srcObject = media; await video.current!.play(); if (id !== generation.current) return;
      canvas.current!.width = video.current!.videoWidth; canvas.current!.height = video.current!.videoHeight;
      const timeout = setTimeout(() => fail('بارگیری مدل طول کشید. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.'), 60000); timer.current = timeout;
      const moduleUrl = new URL('/vision/vision_bundle.mjs', window.location.href).href;
      const wasmUrl = new URL('/vision/wasm', window.location.href).href;
      const modelUrl = new URL('/models/gesture_recognizer.task', window.location.href).href;
      const { FilesetResolver, GestureRecognizer } = await import(/* @vite-ignore */ moduleUrl);
      const vision = await FilesetResolver.forVisionTasks(wasmUrl);
      recognizer.current = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' },
        runningMode: 'VIDEO', numHands: 1, minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.6,
      });
      if (id !== generation.current) return;
      clearTimeout(timeout); setPhase('running'); setReading({ state: 'none', score: 0, points: [] });
      const frame = () => {
        if (id !== generation.current || !video.current || !recognizer.current) return;
        try {
          const result = recognizer.current.recognizeForVideo(video.current, performance.now());
          const points = result.landmarks[0] || [], gesture = result.gestures[0]?.[0];
          let value = points.length ? 'other' : 'none';
          if (points.length && gesture?.score >= 0.65) { if (gesture.categoryName === 'Open_Palm') value = 'open'; if (gesture.categoryName === 'Closed_Fist') value = 'closed'; }
          stable.current = { value, count: value === stable.current.value ? stable.current.count + 1 : 1 };
          setReading(prev => ({ state: value === 'none' || stable.current.count >= 3 ? value : prev.state, score: value === 'none' ? 0 : (value === prev.state || stable.current.count >= 3 ? gesture?.score || 0 : 0), points }));
          timer.current = setTimeout(frame, 75);
        } catch (error) { fail(`پردازش تصویر انجام نشد: ${(error as Error).message || 'خطای ناشناخته'}`); }
      };
      frame();
    } catch (error) {
      const name = (error as Error).name;
      fail(name === 'NotAllowedError' ? 'اجازهٔ دوربین داده نشد. از تنظیمات کنار آدرس سایت، دسترسی دوربین را فعال کنید.' : name === 'NotFoundError' ? 'دوربینی پیدا نشد. اتصال دوربین دستگاه را بررسی کنید.' : name === 'NotReadableError' ? 'دوربین در برنامهٔ دیگری مشغول است. آن برنامه را ببندید و دوباره امتحان کنید.' : (error as Error).message === 'secure' ? 'برای دسترسی به دوربین، سایت را با HTTPS یا localhost باز کنید.' : `مدل تشخیص آماده نشد: ${(error as Error).message || 'خطای ناشناخته'}`);
    }
  }
  const running = phase === 'running', busy = phase === 'loading', recognized = reading.state === 'open' || reading.state === 'closed';
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="/" aria-label="دست‌بین، خانه"><span className="brand-icon"><ScanLine size={25}/></span><strong>دست‌بین<span>DASTBIN</span></strong></a><div className="top-note"><span className="dot"/> بینایی ماشین، همین‌جا در مرورگر</div><button className="help-btn" onClick={() => setHelp(!help)} aria-expanded={help}><CircleHelp size={18}/> راهنما</button></header>
    <main><div className="heading"><div><div className="eyebrow">دوربین شما. حرکت دست شما.</div><h1>دستت رو باز کن، ببند.</h1><p>دستت را جلوی دوربین بگیر و نتیجه را همان لحظه ببین.</p></div><span className="local-badge"><ShieldCheck size={17}/> پردازش روی دستگاه شما</span></div>
    <div className="workspace"><section className="camera-panel" aria-label="دوربین و کنترل‌ها">
      <div className="panel-bar"><span><Camera size={18}/> نمای دوربین</span><span className={running ? 'live' : 'muted'}><i className="dot"/>{running ? 'زنده' : busy ? 'در حال آماده‌سازی' : 'خاموش'}</span></div>
      <div className="viewport" ref={surface}><video ref={video} muted playsInline className={running || busy ? 'visible' : ''}/><canvas ref={canvas}/>
      {!running && <div className="camera-empty"><div className={'scan-icon ' + (busy ? 'pulsing' : '')}>{busy ? <ScanLine size={48}/> : <Hand size={48} strokeWidth={1.3}/>}</div><h2>{busy ? 'در حال آماده‌کردن تشخیص…' : 'همه‌چیز با یک حرکت شروع می‌شود'}</h2><p>{busy ? 'بار اول، دانلود مدل ممکن است کمی طول بکشد.' : 'دوربین را روشن کن و یک دست را کامل در قاب نگه دار.'}</p>{!busy && <button className="primary" onClick={() => void start()}><Camera size={19}/> روشن کردن دوربین</button>}</div>}
      {running && <><div className="frame-corner c1"/><div className="frame-corner c2"/><div className="frame-corner c3"/><div className="frame-corner c4"/><span className="on-screen-status">{labels[reading.state]}</span></>}
      <span className="viewport-caption">{running ? 'تصویر آینه‌ای' : 'بدون ضبط تصویر'}</span></div>
      <div className="camera-controls"><label className="switch-label"><input type="checkbox" checked={overlay} onChange={e => setOverlay(e.target.checked)}/><span className="switch"/> نمایش نقاط دست</label><div className="control-actions"><button aria-label="نمای تمام‌صفحه" title="تمام‌صفحه" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void surface.current?.requestFullscreen?.().catch(() => setMessage('نمای تمام‌صفحه در این مرورگر در دسترس نیست.')); }}><Maximize size={19}/></button>{(running || busy) && <button className="stop" onClick={stop}><Power size={17}/> {busy ? 'لغو' : 'خاموش کردن'}</button>}</div></div>
      {message && <div role="alert" className="error"><CameraOff size={20}/><span>{message}</span></div>}
    </section><aside className="results"><section className={'result-panel ' + (recognized ? reading.state : '')}><div className="section-label"><Activity size={17}/> نتیجهٔ تشخیص <span className="tiny-label">لحظه‌ای</span></div><div className="result-icon">{reading.state === 'closed' ? <span aria-hidden="true">✊</span> : <Hand size={47} strokeWidth={1.4}/>}</div><div className="result-text" role="status" aria-live="polite"><h2>{labels[reading.state]}</h2><p>{reading.state === 'idle' ? 'با روشن کردن دوربین، تشخیص شروع می‌شود.' : reading.state === 'none' ? 'یک دست را کامل روبه‌روی دوربین بگیر.' : reading.state === 'other' ? 'کف دست را باز کن یا مشتت را کامل ببند.' : reading.state === 'open' ? 'کف دست باز شناسایی شد.' : 'مشت بسته شناسایی شد.'}</p></div><div className="confidence"><span>اطمینان تشخیص</span><strong>{recognized && reading.score ? `${Math.round(reading.score*100).toLocaleString('fa-IR')}٪` : '—'}</strong></div><div className="confidence-track"><span style={{width: `${recognized ? reading.score*100 : 0}%`}}/></div></section>
    <section className="gesture-legend"><h3>دو حرکت، دو نتیجه</h3><div className={reading.state === 'open' ? 'selected' : ''}><Hand size={23}/><span>کف دست باز<small>انگشت‌ها را باز نگه دار</small></span><i className="legend-dot green"/></div><div className={reading.state === 'closed' ? 'selected' : ''}><span className="fist" aria-hidden="true">✊</span><span>مشت بسته<small>همهٔ انگشت‌ها را جمع کن</small></span><i className="legend-dot orange"/></div></section>
    <div className="privacy"><ShieldCheck size={21}/><p><strong>تصویرت پیش خودت می‌ماند.</strong> تصویر دوربین ذخیره یا ارسال نمی‌شود. فقط برای دریافت مدل تشخیص، اینترنت لازم است.</p></div></aside></div>
    <div className="tips"><span><b>۰۱</b> نور کافی، تشخیص بهتر</span><span><b>۰۲</b> تمام دست داخل تصویر</span><span><b>۰۳</b> کف دست رو به دوربین</span></div>
    {help && <section className="help-panel"><h2>چطور شروع کنم؟</h2><p>«روشن کردن دوربین» را بزن و پیام اجازهٔ مرورگر را تأیید کن. یک دست را جلوی دوربین بگیر؛ ابتدا کف دست را کامل باز کن و بعد مشتت را ببند. برای نتیجهٔ بهتر، هر حالت را یک لحظه نگه دار.</p><p>اگر دوربین باز نشد، دسترسی دوربین را از تنظیمات کنار آدرس سایت بررسی کن و برنامه‌های دیگری را که از دوربین استفاده می‌کنند ببند. با رفتن به تب دیگر، دوربین خودکار خاموش می‌شود.</p></section>}
    </main><footer><span>دست‌بین <span className="footer-sep">/</span> یک تجربهٔ کوچک از بینایی ماشین</span><a href="https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer" target="_blank" rel="noreferrer">با MediaPipe گوگل ↗</a></footer>
  </div>;
}
