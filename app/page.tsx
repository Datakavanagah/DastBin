"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  BrainCircuit,
  Camera,
  Check,
  ChevronDown,
  Circle,
  CircleDot,
  Clock3,
  Download,
  Eye,
  Fingerprint,
  Gauge,
  Hand,
  History,
  Maximize,
  Mic,
  MicOff,
  Moon,
  MousePointer2,
  Pause,
  Play,
  Power,
  RotateCcw,
  Save,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Volume2,
  WandSparkles,
  Zap,
} from "lucide-react";
import {
  HAND_CONNECTIONS,
  CustomModel,
  CustomSample,
  HandSnapshot,
  MotionMemory,
  Point,
  analyzeHands,
  downloadFile,
  fingerNames,
  labelForGesture,
  normalizedVector,
  trainCustomModel,
} from "./hand-vision";

type Tab = "live" | "analytics" | "studio" | "roadmap";
type Phase = "idle" | "loading" | "running" | "error";
type HistoryItem = {
  id: string;
  time: number;
  gesture: string;
  hand: string;
  confidence: number;
  fingerCount: number;
  screenshot?: string;
};
type Settings = {
  threshold: number;
  targetFps: number;
  resolution: string;
  cameraId: string;
  modelMode: "base" | "hybrid";
  gestureMode: "all" | "static" | "dynamic";
  skeleton: boolean;
  joints: boolean;
  bbox: boolean;
  trail: boolean;
  mirror: boolean;
};
type Metrics = {
  fps: number;
  inference: number;
  latency: number;
  frames: number;
  uptime: number;
};
type Recognizer = {
  close?: () => void;
  recognizeForVideo: (
    video: HTMLVideoElement,
    time: number,
  ) => {
    landmarks: Point[][];
    handedness: { categoryName: string; score: number }[][];
    gestures: { categoryName: string; score: number }[][];
  };
};

const STORAGE = {
  history: "dastbin-history-v3",
  samples: "dastbin-samples-v3",
  model: "dastbin-model-v3",
  settings: "dastbin-settings-v3",
};
const resolutions: Record<string, [number, number]> = {
  "480p": [640, 480],
  "720p": [1280, 720],
  "1080p": [1920, 1080],
};
const defaultSettings: Settings = {
  threshold: 0.62,
  targetFps: 15,
  resolution: "720p",
  cameraId: "",
  modelMode: "hybrid",
  gestureMode: "all",
  skeleton: true,
  joints: true,
  bbox: true,
  trail: true,
  mirror: true,
};
const roadmap = [
  {
    level: "01",
    title: "تشخیص دست",
    done: 6,
    total: 6,
    items: [
      "وجود دست",
      "چپ / راست",
      "یک یا دو دست",
      "اسکلت",
      "مفاصل",
      "Bounding Box",
    ],
  },
  {
    level: "02",
    title: "تشخیص انگشت",
    done: 4,
    total: 4,
    items: ["شمارش ۰ تا ۵", "وضعیت هر انگشت", "Open Palm", "Fist"],
  },
  {
    level: "03",
    title: "حرکت‌ها",
    done: 9,
    total: 9,
    items: [
      "Thumbs Up / Down",
      "Peace",
      "OK",
      "Fist",
      "Open Palm",
      "Wave",
      "Pinch",
      "حرکت سفارشی",
    ],
  },
  {
    level: "04",
    title: "رهگیری زنده",
    done: 6,
    total: 6,
    items: [
      "موقعیت دست",
      "انگشت‌ها",
      "مسیر حرکت",
      "جهت",
      "سرعت",
      "تشخیص لحظه‌ای",
    ],
  },
  {
    level: "05",
    title: "کنترل رایانه",
    done: 7,
    total: 9,
    items: [
      "اشاره‌گر داخل صفحه",
      "Pinch Click",
      "Pinch Drag",
      "دو انگشت Scroll",
      "Back / Forward داخل برنامه",
      "Volume",
      "Play / Pause",
      "کنترل سراسری: نسخه دسکتاپ",
    ],
  },
  {
    level: "06",
    title: "یادگیری سفارشی",
    done: 9,
    total: 13,
    items: [
      "جمع‌آوری نمونه",
      "Label",
      "پیش‌پردازش",
      "Train / Test",
      "آموزش Centroid",
      "اعتبارسنجی",
      "ذخیره / Load",
      "Real-Time Inference",
      "CNN / ONNX: پایپ‌لاین Python",
    ],
  },
  {
    level: "07",
    title: "سنجه‌های مدل",
    done: 10,
    total: 10,
    items: [
      "Accuracy",
      "Precision",
      "Recall",
      "F1",
      "Confusion Matrix",
      "Loss / Accuracy Curve",
      "Inference Time",
      "FPS",
      "Latency",
      "Confidence",
    ],
  },
  {
    level: "08",
    title: "داشبورد AI",
    done: 12,
    total: 12,
    items: [
      "دوربین",
      "وضعیت AI",
      "دست‌ها",
      "چپ / راست",
      "حرکت",
      "انگشت",
      "اطمینان",
      "FPS",
      "Latency",
      "مدل / نسخه",
      "زمان پردازش",
      "تاریخچه",
    ],
  },
  {
    level: "09",
    title: "داده و تاریخچه",
    done: 9,
    total: 9,
    items: [
      "زمان",
      "حرکت",
      "Confidence",
      "Screenshot",
      "ذخیره محلی",
      "نمودار حرکت",
      "Confidence",
      "FPS",
      "Export",
    ],
  },
  {
    level: "10",
    title: "صدا + حرکت",
    done: 6,
    total: 6,
    items: [
      "فرمان صوتی",
      "فعال / غیرفعال",
      "Start",
      "Stop",
      "Change Mode",
      "Voice + Gesture",
    ],
  },
  {
    level: "11",
    title: "بینایی پیشرفته",
    done: 6,
    total: 8,
    items: [
      "Multi-Hand",
      "Classification",
      "Dynamic Gesture",
      "Motion",
      "Temporal Window",
      "Sequence",
      "Custom Training",
      "Object Interaction: بعدی",
    ],
  },
  {
    level: "12",
    title: "رابط حرفه‌ای",
    done: 11,
    total: 11,
    items: [
      "Dark / Light",
      "انتخاب دوربین",
      "Resolution",
      "FPS",
      "Threshold",
      "Model",
      "Gesture Mode",
      "Start / Stop",
      "Fullscreen",
      "Dashboard",
      "Responsive",
    ],
  },
  {
    level: "13",
    title: "انتشار",
    done: 5,
    total: 10,
    items: [
      "CPU / WASM",
      "کاهش Latency",
      "Web",
      "API سلامت",
      "نسخه منتشرشده",
      "ONNX / GPU",
      "Desktop",
      "Mobile: مسیر جدا",
    ],
  },
];

const formatTime = (ms: number) =>
  new Date(ms).toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
const handFa = (value: string) =>
  value === "Left" ? "چپ" : value === "Right" ? "راست" : "نامشخص";

function MiniLine({
  values,
  color = "#b8ff6a",
}: {
  values: number[];
  color?: string;
}) {
  const max = Math.max(...values, 1),
    min = Math.min(...values, 0),
    spread = Math.max(0.001, max - min);
  const points = values
    .map(
      (v, i) =>
        `${(i / Math.max(1, values.length - 1)) * 100},${38 - ((v - min) / spread) * 34}`,
    )
    .join(" ");
  return (
    <svg
      className="mini-line"
      viewBox="0 0 100 42"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("live");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [hands, setHands] = useState<HandSnapshot[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [metrics, setMetrics] = useState<Metrics>({
    fps: 0,
    inference: 0,
    latency: 0,
    frames: 0,
    uptime: 0,
  });
  const [metricSeries, setMetricSeries] = useState<{
    fps: number[];
    latency: number[];
  }>({ fps: [0], latency: [0] });
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [samples, setSamples] = useState<CustomSample[]>([]);
  const [customModel, setCustomModel] = useState<CustomModel | null>(null);
  const [sampleLabel, setSampleLabel] = useState("حرکت من");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [voiceActive, setVoiceActive] = useState(false),
    [voiceText, setVoiceText] = useState("");
  const [controlMode, setControlMode] = useState(false),
    [cursor, setCursor] = useState({ x: 0.5, y: 0.5, pinch: false });
  const [controlLog, setControlLog] = useState<string[]>([
    "کنترل حرکتی آماده است",
  ]);
  const [volume, setVolume] = useState(55),
    [playing, setPlaying] = useState(false),
    [dragPos, setDragPos] = useState({ x: 0.76, y: 0.72 });
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]),
    [settingsOpen, setSettingsOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null),
    canvasRef = useRef<HTMLCanvasElement>(null),
    stageRef = useRef<HTMLDivElement>(null),
    controlPadRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null),
    recognizerRef = useRef<Recognizer | null>(null),
    rafRef = useRef(0);
  const generationRef = useRef(0),
    motionRef = useRef<MotionMemory>({}),
    lastRunRef = useRef(0),
    sessionStartRef = useRef(0);
  const timingRef = useRef<number[]>([]),
    frameTimesRef = useRef<number[]>([]),
    lastHistoryRef = useRef<Record<string, { gesture: string; time: number }>>(
      {},
    );
  const previousPinchRef = useRef(false),
    lastControlActionRef = useRef(0),
    lastWristRef = useRef<Point | null>(null);
  const settingsRef = useRef(settings),
    modelRef = useRef(customModel),
    handsRef = useRef(hands),
    phaseRef = useRef(phase),
    tabRef = useRef(tab),
    voiceRef = useRef<any>(null);
  settingsRef.current = settings;
  modelRef.current = customModel;
  handsRef.current = hands;
  phaseRef.current = phase;
  tabRef.current = tab;

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(STORAGE.settings),
        savedHistory = localStorage.getItem(STORAGE.history),
        savedSamples = localStorage.getItem(STORAGE.samples),
        savedModel = localStorage.getItem(STORAGE.model);
      if (savedSettings)
        setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });
      if (savedHistory) setHistoryItems(JSON.parse(savedHistory).slice(0, 100));
      if (savedSamples) setSamples(JSON.parse(savedSamples).slice(0, 600));
      if (savedModel) setCustomModel(JSON.parse(savedModel));
      if (localStorage.getItem("dastbin-theme") === "light") setTheme("light");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE.settings, JSON.stringify(settings));
    } catch {}
  }, [settings]);
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE.history,
        JSON.stringify(historyItems.slice(0, 100)),
      );
    } catch {}
  }, [historyItems]);
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE.samples,
        JSON.stringify(samples.slice(0, 600)),
      );
    } catch {}
  }, [samples]);
  useEffect(() => {
    try {
      customModel
        ? localStorage.setItem(STORAGE.model, JSON.stringify(customModel))
        : localStorage.removeItem(STORAGE.model);
    } catch {}
  }, [customModel]);
  useEffect(() => {
    localStorage.setItem("dastbin-theme", theme);
  }, [theme]);
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool(
        {
          name: "get_hand_vision_status",
          title: "Get hand vision status",
          description:
            "Read the current Dastbin AI detection state, visible hands, gesture and live performance without changing the camera.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute: () => ({
            phase: phaseRef.current,
            tab: tabRef.current,
            hands: handsRef.current.map((hand) => ({
              side: hand.handedness,
              gesture: hand.gesture,
              fingerCount: hand.fingerCount,
              confidence: hand.confidence,
            })),
          }),
        },
        { signal: lifecycle.signal },
      );
      await context.registerTool(
        {
          name: "open_hand_vision_section",
          title: "Open dashboard section",
          description:
            "Open a Dastbin dashboard section. This changes only the visible application tab.",
          inputSchema: {
            type: "object",
            properties: {
              section: {
                type: "string",
                enum: ["live", "analytics", "studio", "roadmap"],
              },
            },
            required: ["section"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: (input: unknown) => {
            const section = (input as { section?: Tab })?.section;
            if (
              !section ||
              !["live", "analytics", "studio", "roadmap"].includes(section)
            )
              throw new Error("Invalid section");
            setTab(section);
            return { section };
          },
        },
        { signal: lifecycle.signal },
      );
    };
    void register().catch(() => {});
    return () => lifecycle.abort();
  }, []);

  const addLog = useCallback(
    (text: string) => setControlLog((prev) => [text, ...prev].slice(0, 5)),
    [],
  );
  const addHistory = useCallback(
    (item: Omit<HistoryItem, "id">) =>
      setHistoryItems((prev) =>
        [
          {
            ...item,
            id: `${item.time}-${Math.random().toString(36).slice(2, 7)}`,
          },
          ...prev,
        ].slice(0, 100),
      ),
    [],
  );
  const stop = useCallback((quiet = false) => {
    generationRef.current++;
    cancelAnimationFrame(rafRef.current);
    recognizerRef.current?.close?.();
    recognizerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    motionRef.current = {};
    lastWristRef.current = null;
    previousPinchRef.current = false;
    setHands([]);
    setPhase("idle");
    if (!quiet) setMessage("");
  }, []);
  useEffect(() => () => stop(true), [stop]);

  const runControls = useCallback(
    (snapshot: HandSnapshot[], now: number) => {
      if (!snapshot.length) return;
      const hand = snapshot[0],
        tip = hand.landmarks[8],
        wrist = hand.landmarks[0];
      setCursor({ x: 1 - tip.x, y: tip.y, pinch: hand.pinch > 0.72 });
      if (controlMode && controlPadRef.current) {
        const rect = controlPadRef.current.getBoundingClientRect(),
          clientX = rect.left + (1 - tip.x) * rect.width,
          clientY = rect.top + tip.y * rect.height;
        if (
          hand.pinch > 0.72 &&
          !previousPinchRef.current &&
          now - lastControlActionRef.current > 450
        ) {
          const target = document
            .elementFromPoint(clientX, clientY)
            ?.closest<HTMLElement>("[data-gesture-target]");
          if (target) {
            target.click();
            addLog(`Pinch Click → ${target.dataset.gestureTarget}`);
            lastControlActionRef.current = now;
          }
        }
        if (hand.pinch > 0.72 && previousPinchRef.current)
          setDragPos({
            x: Math.max(0.05, Math.min(0.95, 1 - tip.x)),
            y: Math.max(0.1, Math.min(0.9, tip.y)),
          });
        if (hand.fingerCount === 2 && lastWristRef.current) {
          const dy = wrist.y - lastWristRef.current.y;
          if (Math.abs(dy) > 0.015) controlPadRef.current.scrollTop += dy * 850;
        }
      }
      previousPinchRef.current = hand.pinch > 0.72;
      lastWristRef.current = wrist;
      if (now - lastControlActionRef.current < 700) return;
      if (hand.gesture === "Thumb_Up") {
        setVolume((v) => Math.min(100, v + 5));
        addLog("Volume Up");
        lastControlActionRef.current = now;
      }
      if (hand.gesture === "Thumb_Down") {
        setVolume((v) => Math.max(0, v - 5));
        addLog("Volume Down");
        lastControlActionRef.current = now;
      }
      if (hand.gesture === "Victory") {
        setPlaying((v) => !v);
        addLog("Play / Pause");
        lastControlActionRef.current = now;
      }
      if (hand.gesture === "Swipe_Left") {
        setTab("analytics");
        addLog("رفتن به تحلیل");
        lastControlActionRef.current = now;
      }
      if (hand.gesture === "Swipe_Right") {
        setTab("live");
        addLog("بازگشت به نمای زنده");
        lastControlActionRef.current = now;
      }
    },
    [addLog, controlMode],
  );

  const processHistory = useCallback(
    (snapshot: HandSnapshot[], now: number) => {
      for (const hand of snapshot) {
        if (hand.gesture === "None") continue;
        const key = hand.handedness,
          previous = lastHistoryRef.current[key];
        if (
          !previous ||
          previous.gesture !== hand.gesture ||
          now - previous.time > 2200
        ) {
          addHistory({
            time: Date.now(),
            gesture: hand.gesture,
            hand: hand.handedness,
            confidence: hand.confidence,
            fingerCount: hand.fingerCount,
          });
          lastHistoryRef.current[key] = { gesture: hand.gesture, time: now };
        }
      }
    },
    [addHistory],
  );

  const start = useCallback(async () => {
    stop(true);
    const generation = generationRef.current;
    setPhase("loading");
    setMessage("");
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error("این مرورگر دسترسی امن به دوربین ندارد.");
      const [width, height] =
        resolutions[settingsRef.current.resolution] || resolutions["720p"];
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: settingsRef.current.cameraId
            ? { exact: settingsRef.current.cameraId }
            : undefined,
          facingMode: settingsRef.current.cameraId ? undefined : "user",
          width: { ideal: width },
          height: { ideal: height },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      if (generation !== generationRef.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = media;
      media.getVideoTracks()[0].onended = () => stop();
      if (!videoRef.current) return;
      videoRef.current.srcObject = media;
      await videoRef.current.play();
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter((device) => device.kind === "videoinput"));
      const moduleUrl = new URL("/vision/vision_bundle.mjs", location.href)
          .href,
        wasmUrl = new URL("/vision/wasm", location.href).href,
        modelUrl = new URL("/models/gesture_recognizer.task", location.href)
          .href;
      const module = await import(/* @vite-ignore */ moduleUrl),
        vision = await module.FilesetResolver.forVisionTasks(wasmUrl);
      recognizerRef.current = await module.GestureRecognizer.createFromOptions(
        vision,
        {
          baseOptions: { modelAssetPath: modelUrl, delegate: "CPU" },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        },
      );
      if (generation !== generationRef.current) return;
      sessionStartRef.current = performance.now();
      lastRunRef.current = 0;
      timingRef.current = [];
      frameTimesRef.current = [];
      setPhase("running");
      setMessage("");
      const loop = (now: number) => {
        if (
          generation !== generationRef.current ||
          !recognizerRef.current ||
          !videoRef.current
        )
          return;
        const interval = 1000 / settingsRef.current.targetFps;
        if (
          now - lastRunRef.current >= interval &&
          videoRef.current.readyState >= 2
        ) {
          const begin = performance.now();
          try {
            const result = recognizerRef.current.recognizeForVideo(
                videoRef.current,
                now,
              ),
              elapsed = performance.now() - begin;
            const chosenModel =
              settingsRef.current.modelMode === "hybrid"
                ? modelRef.current
                : null;
            const snapshot = analyzeHands(
              result,
              motionRef.current,
              chosenModel,
              now,
            ).map((hand) => {
              const isDynamic =
                hand.gesture === "Wave" || hand.gesture.startsWith("Swipe_");
              const allowedMode =
                settingsRef.current.gestureMode === "all" ||
                (settingsRef.current.gestureMode === "dynamic"
                  ? isDynamic
                  : !isDynamic);
              return allowedMode &&
                (hand.confidence >= settingsRef.current.threshold ||
                  ["Pinch", "Wave"].includes(hand.gesture) ||
                  hand.gesture.startsWith("Swipe_"))
                ? hand
                : { ...hand, gesture: "None" };
            });
            setHands(snapshot);
            processHistory(snapshot, now);
            runControls(snapshot, now);
            timingRef.current = [...timingRef.current.slice(-29), elapsed];
            frameTimesRef.current = [
              ...frameTimesRef.current.filter((t) => now - t < 1000),
              now,
            ];
            const inference =
              timingRef.current.reduce((a, b) => a + b, 0) /
              timingRef.current.length;
            setMetrics((previous) => ({
              fps: frameTimesRef.current.length,
              inference,
              latency: elapsed + Math.max(0, interval - elapsed),
              frames: previous.frames + 1,
              uptime: (now - sessionStartRef.current) / 1000,
            }));
            if (
              Math.round(now / 1000) !== Math.round(lastRunRef.current / 1000)
            )
              setMetricSeries((series) => ({
                fps: [...series.fps.slice(-29), frameTimesRef.current.length],
                latency: [...series.latency.slice(-29), elapsed],
              }));
          } catch (error) {
            setMessage(`پردازش متوقف شد: ${(error as Error).message}`);
          }
          lastRunRef.current = now;
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (error) {
      const e = error as Error,
        detail =
          e.name === "NotAllowedError"
            ? "اجازهٔ دوربین داده نشد. دسترسی Camera را برای این سایت فعال کنید."
            : e.name === "NotFoundError"
              ? "هیچ دوربینی پیدا نشد."
              : e.name === "NotReadableError"
                ? "دوربین در برنامهٔ دیگری در حال استفاده است."
                : `مدل آماده نشد: ${e.message || "خطای ناشناخته"}`;
      stop(true);
      setPhase("error");
      setMessage(detail);
    }
  }, [processHistory, runControls, stop]);

  useEffect(() => {
    const canvas = canvasRef.current,
      video = videoRef.current;
    if (!canvas || !video) return;
    const width = video.videoWidth || 1280,
      height = video.videoHeight || 720;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const x = (value: number) => (settings.mirror ? 1 - value : value) * width,
      y = (value: number) => value * height;
    hands.forEach((hand, handIndex) => {
      const color = handIndex ? "#66d9ff" : "#b8ff6a";
      if (settings.trail) {
        const key = `${hand.id}-${hand.handedness}`,
          trail = motionRef.current[key] || [];
        ctx.beginPath();
        trail.forEach((point, index) =>
          index
            ? ctx.lineTo(x(point.x), y(point.y))
            : ctx.moveTo(x(point.x), y(point.y)),
        );
        ctx.strokeStyle = `${color}80`;
        ctx.lineWidth = 5;
        ctx.stroke();
      }
      if (settings.skeleton) {
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, width / 500);
        HAND_CONNECTIONS.forEach(([a, b]) => {
          ctx.beginPath();
          ctx.moveTo(x(hand.landmarks[a].x), y(hand.landmarks[a].y));
          ctx.lineTo(x(hand.landmarks[b].x), y(hand.landmarks[b].y));
          ctx.stroke();
        });
      }
      if (settings.joints)
        hand.landmarks.forEach((point, index) => {
          ctx.beginPath();
          ctx.arc(
            x(point.x),
            y(point.y),
            index === 0 || [4, 8, 12, 16, 20].includes(index) ? 6 : 3.5,
            0,
            Math.PI * 2,
          );
          ctx.fillStyle = index === 4 || index === 8 ? "#fff" : color;
          ctx.fill();
        });
      if (settings.bbox) {
        const left = settings.mirror
          ? 1 - hand.bbox.x - hand.bbox.width
          : hand.bbox.x;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(
          left * width,
          hand.bbox.y * height,
          hand.bbox.width * width,
          hand.bbox.height * height,
        );
        const label = `${handFa(hand.handedness)} · ${labelForGesture(hand.gesture)} · ${hand.fingerCount}`;
        ctx.font = `600 ${Math.max(15, width / 60)}px Tahoma`;
        const labelWidth = ctx.measureText(label).width + 20;
        ctx.fillStyle = "#0e120ed9";
        ctx.fillRect(
          left * width,
          Math.max(0, hand.bbox.y * height - 34),
          labelWidth,
          32,
        );
        ctx.fillStyle = color;
        ctx.fillText(
          label,
          left * width + 10,
          Math.max(23, hand.bbox.y * height - 10),
        );
      }
    });
  }, [hands, settings]);

  const takeScreenshot = useCallback(() => {
    const video = videoRef.current,
      overlay = canvasRef.current;
    if (!video || !overlay || !video.videoWidth) return;
    const shot = document.createElement("canvas");
    shot.width = video.videoWidth;
    shot.height = video.videoHeight;
    const ctx = shot.getContext("2d");
    if (!ctx) return;
    if (settings.mirror) {
      ctx.translate(shot.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, shot.width, shot.height);
    if (settings.mirror) ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(overlay, 0, 0);
    shot.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `dastbin-${Date.now()}.png`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
    const primary = handsRef.current[0];
    addHistory({
      time: Date.now(),
      gesture: primary?.gesture || "Screenshot",
      hand: primary?.handedness || "Unknown",
      confidence: primary?.confidence || 0,
      fingerCount: primary?.fingerCount || 0,
      screenshot: "downloaded",
    });
  }, [addHistory, settings.mirror]);

  const toggleVoice = useCallback(() => {
    if (voiceActive) {
      voiceRef.current?.stop?.();
      setVoiceActive(false);
      return;
    }
    const speechWindow = window as unknown as {
        SpeechRecognition?: new () => any;
        webkitSpeechRecognition?: new () => any;
      },
      SpeechRecognition =
        speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceText("مرورگر شما فرمان صوتی را پشتیبانی نمی‌کند.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "fa-IR";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const text = event.results[event.results.length - 1][0].transcript.trim();
      setVoiceText(text);
      if (/شروع|استارت/.test(text)) void start();
      if (/توقف|خاموش/.test(text)) stop();
      if (/روشن/.test(text)) setTheme("light");
      if (/تاریک|دارک/.test(text)) setTheme("dark");
      if (/تحلیل|داشبورد/.test(text)) setTab("analytics");
      if (/آموزش/.test(text)) setTab("studio");
    };
    recognition.onerror = () => {
      setVoiceActive(false);
      setVoiceText("فرمان صوتی متوقف شد.");
    };
    recognition.onend = () => {
      voiceRef.current = null;
      setVoiceActive(false);
    };
    voiceRef.current = recognition;
    recognition.start();
    setVoiceActive(true);
    setVoiceText("گوش می‌دهم…");
  }, [start, stop, voiceActive]);

  const captureSample = useCallback(() => {
    const points = handsRef.current[0]?.landmarks;
    if (!points?.length || !sampleLabel.trim()) {
      setMessage(
        "برای ثبت نمونه، یک دست را در قاب نگه دارید و نام حرکت را وارد کنید.",
      );
      return;
    }
    setSamples((prev) =>
      [
        ...prev,
        {
          label: sampleLabel.trim(),
          vector: normalizedVector(points),
          capturedAt: Date.now(),
        },
      ].slice(-600),
    );
    setMessage(`نمونهٔ «${sampleLabel.trim()}» ثبت شد.`);
  }, [sampleLabel]);
  const train = useCallback(() => {
    const model = trainCustomModel(samples);
    if (!model) {
      setMessage("برای هر حرکت سفارشی حداقل ۳ نمونه ثبت کنید.");
      return;
    }
    setCustomModel(model);
    setMessage(
      `مدل سفارشی با ${model.sampleCount.toLocaleString("fa-IR")} نمونه آموزش دید.`,
    );
  }, [samples]);
  const customEvaluation = useMemo(() => {
    if (!customModel || !samples.length)
      return {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1: 0,
        labels: [] as string[],
        matrix: {} as Record<string, Record<string, number>>,
        accuracyCurve: [0],
        lossCurve: [1],
      };
    let correct = 0;
    const matrix: Record<string, Record<string, number>> = {},
      perLabel: Record<string, { tp: number; fp: number; fn: number }> = {};
    customModel.labels.forEach((label) => {
      perLabel[label] = { tp: 0, fp: 0, fn: 0 };
      matrix[label] = {};
      customModel.labels.forEach((predicted) => (matrix[label][predicted] = 0));
    });
    const classify = (model: CustomModel, sample: CustomSample) => {
      let best = { label: "", distance: Infinity };
      model.labels.forEach((label) => {
        const centroid = model.centroids[label],
          distance = Math.sqrt(
            sample.vector.reduce(
              (sum, value, index) => sum + (value - centroid[index]) ** 2,
              0,
            ) / sample.vector.length,
          );
        if (distance < best.distance) best = { label, distance };
      });
      return best;
    };
    samples.forEach((sample) => {
      const best = classify(customModel, sample);
      if (matrix[sample.label]?.[best.label] !== undefined)
        matrix[sample.label][best.label]++;
      if (best.label === sample.label) {
        correct++;
        perLabel[sample.label] && perLabel[sample.label].tp++;
      } else {
        perLabel[best.label] && perLabel[best.label].fp++;
        perLabel[sample.label] && perLabel[sample.label].fn++;
      }
    });
    const scores = Object.values(perLabel),
      precision =
        scores.reduce((s, v) => s + v.tp / Math.max(1, v.tp + v.fp), 0) /
        Math.max(1, scores.length),
      recall =
        scores.reduce((s, v) => s + v.tp / Math.max(1, v.tp + v.fn), 0) /
        Math.max(1, scores.length);
    const accuracyCurve: number[] = [],
      lossCurve: number[] = [];
    for (let step = 1; step <= 10; step++) {
      const partial = trainCustomModel(
        samples.slice(0, Math.max(3, Math.ceil((samples.length * step) / 10))),
      );
      if (!partial) {
        accuracyCurve.push(0);
        lossCurve.push(1);
        continue;
      }
      const guesses = samples.map((sample) => classify(partial, sample));
      accuracyCurve.push(
        guesses.filter((guess, index) => guess.label === samples[index].label)
          .length / samples.length,
      );
      lossCurve.push(
        guesses.reduce((sum, guess) => sum + Math.min(1, guess.distance), 0) /
          samples.length,
      );
    }
    return {
      accuracy: correct / samples.length,
      precision,
      recall,
      f1: (2 * precision * recall) / Math.max(0.001, precision + recall),
      labels: customModel.labels,
      matrix,
      accuracyCurve,
      lossCurve,
    };
  }, [customModel, samples]);
  const gestureCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    historyItems.forEach(
      (item) =>
        (counts[labelForGesture(item.gesture)] =
          (counts[labelForGesture(item.gesture)] || 0) + 1),
    );
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7);
  }, [historyItems]);
  const exportHistory = () =>
    downloadFile(
      `dastbin-history-${Date.now()}.csv`,
      "\uFEFFزمان,حرکت,دست,انگشت,اطمینان\n" +
        historyItems
          .map(
            (item) =>
              `${new Date(item.time).toISOString()},${labelForGesture(item.gesture)},${handFa(item.hand)},${item.fingerCount},${Math.round(item.confidence * 100)}`,
          )
          .join("\n"),
      "text/csv;charset=utf-8",
    );
  const running = phase === "running",
    primary = hands[0];

  return (
    <div className={`vision-app ${theme}`}>
      <header className="app-header">
        <a href="/" className="brand">
          <span className="brand-mark">
            <ScanLine />
          </span>
          <span>
            <b>دست‌بین AI</b>
            <small>HAND VISION LAB</small>
          </span>
        </a>
        <nav className="main-tabs" aria-label="بخش‌های برنامه">
          {(
            [
              ["live", "زنده", Eye],
              ["analytics", "تحلیل", BarChart3],
              ["studio", "استودیو", BrainCircuit],
              ["roadmap", "نقشه‌راه", Target],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              className={tab === value ? "active" : ""}
              onClick={() => setTab(value)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className={`icon-button ${voiceActive ? "active" : ""}`}
            onClick={toggleVoice}
            title="فرمان صوتی"
          >
            {voiceActive ? <Mic size={19} /> : <MicOff size={19} />}
          </button>
          <button
            className="icon-button"
            onClick={() =>
              setTheme((value) => (value === "dark" ? "light" : "dark"))
            }
            title="تغییر پوسته"
          >
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button
            className="icon-button"
            onClick={() => setSettingsOpen((value) => !value)}
            title="تنظیمات"
          >
            <Settings2 size={19} />
          </button>
          {running ? (
            <button className="stop-button" onClick={() => stop()}>
              <Power size={17} /> توقف
            </button>
          ) : (
            <button
              className="start-button"
              disabled={phase === "loading"}
              onClick={() => void start()}
            >
              <Camera size={18} />
              {phase === "loading" ? "آماده‌سازی…" : "شروع تشخیص"}
            </button>
          )}
        </div>
      </header>
      {voiceText && (
        <div className="voice-toast">
          <Mic size={15} />
          <span>{voiceText}</span>
          <button onClick={() => setVoiceText("")}>×</button>
        </div>
      )}
      {message && (
        <div className={`system-message ${phase === "error" ? "error" : ""}`}>
          <CircleDot size={17} />
          <span>{message}</span>
          <button onClick={() => setMessage("")}>×</button>
        </div>
      )}
      <main className="app-main">
        {tab === "live" && (
          <>
            <section className="status-strip">
              <div>
                <span className={`status-led ${running ? "on" : ""}`} />
                <p>
                  وضعیت AI
                  <strong>
                    {running
                      ? "فعال"
                      : phase === "loading"
                        ? "در حال بارگذاری"
                        : "آماده"}
                  </strong>
                </p>
              </div>
              <div>
                <Hand />
                <p>
                  دست‌های دیده‌شده
                  <strong>{hands.length.toLocaleString("fa-IR")}</strong>
                </p>
              </div>
              <div>
                <Fingerprint />
                <p>
                  حرکت فعلی
                  <strong>
                    {primary ? labelForGesture(primary.gesture) : "—"}
                  </strong>
                </p>
              </div>
              <div>
                <Gauge />
                <p>
                  سرعت پردازش
                  <strong>{metrics.fps.toLocaleString("fa-IR")} FPS</strong>
                </p>
              </div>
              <div>
                <Clock3 />
                <p>
                  تاخیر
                  <strong>
                    {metrics.latency
                      ? `${Math.round(metrics.latency).toLocaleString("fa-IR")} ms`
                      : "—"}
                  </strong>
                </p>
              </div>
              <div>
                <BrainCircuit />
                <p>
                  مدل
                  <strong>
                    {customModel ? "پایه + سفارشی" : "MediaPipe v0.10"}
                  </strong>
                </p>
              </div>
            </section>
            <div className="live-grid">
              <section className="camera-card">
                <div className="card-heading">
                  <span>
                    <Camera size={18} /> دوربین زنده
                  </span>
                  <div className="camera-badges">
                    <span className="privacy-pill">
                      <ShieldCheck size={14} /> محلی
                    </span>
                    <span className={running ? "live-pill" : "offline-pill"}>
                      {running ? "● LIVE" : "OFFLINE"}
                    </span>
                  </div>
                </div>
                <div className="camera-stage" ref={stageRef}>
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className={`${running || phase === "loading" ? "visible" : ""} ${settings.mirror ? "mirrored" : ""}`}
                  />
                  <canvas ref={canvasRef} />
                  {!running && (
                    <div className="camera-placeholder">
                      <div className="scan-orbit">
                        <Hand size={50} />
                        <i />
                        <i />
                      </div>
                      <h1>
                        {phase === "loading"
                          ? "مدل بینایی در حال آماده‌شدن است"
                          : "دستت را وارد قاب کن"}
                      </h1>
                      <p>
                        {phase === "loading"
                          ? "مدل و WebAssembly از همین دستگاه بارگیری می‌شوند."
                          : "تا دو دست، ۲۱ نقطهٔ مفصل و حرکت‌ها را هم‌زمان تشخیص می‌دهیم."}
                      </p>
                      {phase !== "loading" && (
                        <button
                          className="start-button large"
                          onClick={() => void start()}
                        >
                          <Camera size={19} /> روشن کردن دوربین
                        </button>
                      )}
                    </div>
                  )}
                  {running && (
                    <div className="viewfinder">
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                  )}
                  {controlMode && running && (
                    <span
                      className={`virtual-cursor ${cursor.pinch ? "pinching" : ""}`}
                      style={{
                        left: `${cursor.x * 100}%`,
                        top: `${cursor.y * 100}%`,
                      }}
                    >
                      <MousePointer2 />
                    </span>
                  )}
                  <div className="stage-info">
                    <span>
                      {videoRef.current?.videoWidth ||
                        resolutions[settings.resolution][0]}{" "}
                      ×{" "}
                      {videoRef.current?.videoHeight ||
                        resolutions[settings.resolution][1]}
                    </span>
                    <span>
                      {settings.mirror ? "تصویر آینه‌ای" : "تصویر واقعی"}
                    </span>
                  </div>
                </div>
                <div className="camera-toolbar">
                  <div className="toolbar-toggles">
                    {(
                      [
                        ["skeleton", "اسکلت"],
                        ["bbox", "کادر"],
                        ["trail", "مسیر"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key}>
                        <input
                          type="checkbox"
                          checked={settings[key]}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              [key]: e.target.checked,
                            }))
                          }
                        />
                        <span /> {label}
                      </label>
                    ))}
                  </div>
                  <div className="toolbar-actions">
                    <button
                      onClick={takeScreenshot}
                      disabled={!running}
                      title="ثبت تصویر"
                    >
                      <Save size={18} />
                    </button>
                    <button
                      onClick={() => stageRef.current?.requestFullscreen()}
                      title="تمام‌صفحه"
                    >
                      <Maximize size={18} />
                    </button>
                  </div>
                </div>
              </section>
              <aside className="inspector">
                <section className="inspector-card current-card">
                  <div className="section-title">
                    <span>
                      <Sparkles size={17} /> نتیجهٔ لحظه‌ای
                    </span>
                    <small>
                      {primary
                        ? `${Math.round(primary.confidence * 100).toLocaleString("fa-IR")}٪`
                        : "—"}
                    </small>
                  </div>
                  <div
                    className={`gesture-symbol ${primary?.gesture === "Closed_Fist" ? "fist" : ""}`}
                  >
                    {primary?.gesture === "Closed_Fist" ? (
                      "✊"
                    ) : primary?.gesture === "Victory" ? (
                      "✌️"
                    ) : primary?.gesture === "Thumb_Up" ? (
                      "👍"
                    ) : (
                      <Hand />
                    )}
                  </div>
                  <h2>
                    {primary
                      ? labelForGesture(primary.gesture)
                      : "در انتظار دست"}
                  </h2>
                  <p>
                    {primary
                      ? `دست ${handFa(primary.handedness)} · ${primary.fingerCount.toLocaleString("fa-IR")} انگشت باز`
                      : "دوربین را روشن کنید و دست را کامل در قاب نگه دارید."}
                  </p>
                  <div className="confidence-bar">
                    <span
                      style={{ width: `${(primary?.confidence || 0) * 100}%` }}
                    />
                  </div>
                  <div className="mini-stats">
                    <div>
                      <small>سرعت</small>
                      <b>{primary ? `${primary.speed.toFixed(2)} /s` : "—"}</b>
                    </div>
                    <div>
                      <small>جهت</small>
                      <b>{primary?.direction || "—"}</b>
                    </div>
                    <div>
                      <small>Pinch</small>
                      <b>
                        {primary ? `${Math.round(primary.pinch * 100)}٪` : "—"}
                      </b>
                    </div>
                  </div>
                </section>
                <section className="inspector-card fingers-card">
                  <div className="section-title">
                    <span>
                      <Fingerprint size={17} /> وضعیت انگشت‌ها
                    </span>
                    <b>{primary?.fingerCount ?? 0}/5</b>
                  </div>
                  {fingerNames.map((name, index) => (
                    <div className="finger-row" key={name}>
                      <span>{name}</span>
                      <i className={primary?.fingers[index] ? "open" : ""} />
                      <b>
                        {primary
                          ? primary.fingers[index]
                            ? "باز"
                            : "بسته"
                          : "—"}
                      </b>
                    </div>
                  ))}
                </section>
                <section className="inspector-card hands-card">
                  <div className="section-title">
                    <span>
                      <Hand size={17} /> دست‌ها
                    </span>
                    <small>{hands.length}/2</small>
                  </div>
                  {hands.length ? (
                    hands.map((hand, index) => (
                      <div
                        className="hand-row"
                        key={`${hand.handedness}-${index}`}
                      >
                        <span className={`hand-index h${index}`}>
                          {index + 1}
                        </span>
                        <p>
                          <b>دست {handFa(hand.handedness)}</b>
                          <small>{labelForGesture(hand.gesture)}</small>
                        </p>
                        <strong>{Math.round(hand.confidence * 100)}٪</strong>
                      </div>
                    ))
                  ) : (
                    <div className="empty-mini">هنوز دستی دیده نشده است</div>
                  )}
                </section>
              </aside>
            </div>
            <section className="control-section">
              <div className="section-head">
                <div>
                  <small>LEVEL 5</small>
                  <h2>آزمایشگاه کنترل حرکتی</h2>
                  <p>
                    اشاره‌گر را با نوک انگشت حرکت بده؛ پینچ یعنی کلیک و دو انگشت
                    یعنی اسکرول.
                  </p>
                </div>
                <label className="master-switch">
                  <input
                    type="checkbox"
                    checked={controlMode}
                    onChange={(e) => setControlMode(e.target.checked)}
                  />
                  <span />
                  <b>{controlMode ? "فعال" : "غیرفعال"}</b>
                </label>
              </div>
              <div
                className={`control-pad ${controlMode ? "enabled" : ""}`}
                ref={controlPadRef}
              >
                <span
                  className={`pad-cursor ${cursor.pinch ? "pinching" : ""}`}
                  style={{
                    left: `${cursor.x * 100}%`,
                    top: `${cursor.y * 100}%`,
                  }}
                >
                  <MousePointer2 />
                </span>
                <span
                  className="drag-orb"
                  style={{
                    left: `${dragPos.x * 100}%`,
                    top: `${dragPos.y * 100}%`,
                  }}
                >
                  DRAG
                </span>
                <div className="control-targets">
                  <button
                    data-gesture-target="Play / Pause"
                    onClick={() => setPlaying((v) => !v)}
                  >
                    {playing ? <Pause /> : <Play />}
                    <span>{playing ? "توقف" : "پخش"}</span>
                  </button>
                  <button
                    data-gesture-target="Volume Up"
                    onClick={() => setVolume((v) => Math.min(100, v + 10))}
                  >
                    <Volume2 />
                    <span>صدا +</span>
                  </button>
                  <button
                    data-gesture-target="Analytics"
                    onClick={() => setTab("analytics")}
                  >
                    <BarChart3 />
                    <span>تحلیل</span>
                  </button>
                  <button
                    data-gesture-target="Screenshot"
                    onClick={takeScreenshot}
                  >
                    <Camera />
                    <span>اسکرین‌شات</span>
                  </button>
                </div>
                <div className="volume-demo">
                  <Volume2 />
                  <div>
                    <span style={{ width: `${volume}%` }} />
                  </div>
                  <b>{volume}٪</b>
                </div>
                <div className="control-feed">
                  {controlLog.map((item, index) => (
                    <span key={`${item}-${index}`}>
                      <Zap size={13} />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
        {tab === "analytics" && (
          <section className="dashboard-view">
            <div className="view-heading">
              <div>
                <small>PERFORMANCE MONITOR</small>
                <h1>تحلیل زنده و تاریخچه</h1>
                <p>عملکرد مدل، الگوی حرکت‌ها و رکوردهای این مرورگر.</p>
              </div>
              <div className="heading-actions">
                <button onClick={exportHistory}>
                  <Download size={17} /> خروجی CSV
                </button>
                <button
                  className="danger-ghost"
                  onClick={() => setHistoryItems([])}
                >
                  <Trash2 size={17} /> پاک‌کردن
                </button>
              </div>
            </div>
            <div className="metric-grid">
              {[
                ["FPS", metrics.fps, metricSeries.fps, "#b8ff6a"],
                [
                  "زمان پردازش",
                  Math.round(metrics.inference),
                  metricSeries.latency,
                  "#68d7ff",
                ],
                [
                  "Latency",
                  Math.round(metrics.latency),
                  metricSeries.latency,
                  "#ffbd67",
                ],
                ["فریم‌ها", metrics.frames, [0, metrics.frames], "#c8a7ff"],
              ].map(([label, value, series, color]) => (
                <article className="metric-card" key={String(label)}>
                  <small>{label}</small>
                  <strong>
                    {Number(value).toLocaleString("fa-IR")}
                    <em>
                      {label === "FPS"
                        ? " fps"
                        : label === "فریم‌ها"
                          ? ""
                          : " ms"}
                    </em>
                  </strong>
                  <MiniLine values={series as number[]} color={String(color)} />
                </article>
              ))}
            </div>
            <div className="analytics-grid">
              <article className="chart-card">
                <div className="section-title">
                  <span>
                    <BarChart3 size={18} /> فراوانی حرکت‌ها
                  </span>
                  <small>
                    {historyItems.length.toLocaleString("fa-IR")} رویداد
                  </small>
                </div>
                <div className="bar-chart">
                  {gestureCounts.length ? (
                    gestureCounts.map(([label, count]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <div>
                          <i
                            style={{
                              width: `${(count / Math.max(...gestureCounts.map((v) => v[1]))) * 100}%`,
                            }}
                          />
                        </div>
                        <b>{count.toLocaleString("fa-IR")}</b>
                      </div>
                    ))
                  ) : (
                    <div className="empty-chart">
                      با شروع تشخیص، نمودار ساخته می‌شود.
                    </div>
                  )}
                </div>
              </article>
              <article className="model-card">
                <div className="section-title">
                  <span>
                    <BrainCircuit size={18} /> مدل فعال
                  </span>
                  <span className="ok-badge">
                    <Check size={13} /> آماده
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>نام مدل</dt>
                    <dd>MediaPipe Gesture Recognizer</dd>
                  </div>
                  <div>
                    <dt>نسخه</dt>
                    <dd>0.10.21 / float16</dd>
                  </div>
                  <div>
                    <dt>Runtime</dt>
                    <dd>WebAssembly · CPU</dd>
                  </div>
                  <div>
                    <dt>ورودی</dt>
                    <dd>تا ۲ دست · ۲۱ Landmark</dd>
                  </div>
                  <div>
                    <dt>مدل سفارشی</dt>
                    <dd>
                      {customModel
                        ? `${customModel.labels.length} کلاس`
                        : "غیرفعال"}
                    </dd>
                  </div>
                </dl>
              </article>
            </div>
            <article className="history-card">
              <div className="section-title">
                <span>
                  <History size={18} /> تاریخچهٔ تشخیص
                </span>
                <small>ذخیره روی همین مرورگر</small>
              </div>
              <div className="history-table">
                <div className="table-head">
                  <span>زمان</span>
                  <span>حرکت</span>
                  <span>دست</span>
                  <span>انگشت</span>
                  <span>اطمینان</span>
                </div>
                {historyItems.length ? (
                  historyItems.slice(0, 30).map((item) => (
                    <div className="table-row" key={item.id}>
                      <span>{formatTime(item.time)}</span>
                      <strong>
                        {labelForGesture(item.gesture)}
                        {item.screenshot && <Camera size={13} />}
                      </strong>
                      <span>{handFa(item.hand)}</span>
                      <span>{item.fingerCount.toLocaleString("fa-IR")}</span>
                      <span>
                        <i style={{ width: `${item.confidence * 100}%` }} />
                        <b>{Math.round(item.confidence * 100)}٪</b>
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="empty-history">
                    <History />
                    <p>تاریخچه هنوز خالی است.</p>
                  </div>
                )}
              </div>
            </article>
          </section>
        )}
        {tab === "studio" && (
          <section className="studio-view">
            <div className="view-heading">
              <div>
                <small>CUSTOM GESTURE LAB</small>
                <h1>استودیو آموزش حرکت سفارشی</h1>
                <p>
                  بدون ارسال تصویر؛ فقط مختصات نرمال‌شدهٔ ۲۱ نقطه ذخیره می‌شوند.
                </p>
              </div>
              <span className="local-chip">
                <ShieldCheck /> داده محلی
              </span>
            </div>
            <div className="studio-grid">
              <article className="capture-card">
                <div className="step-number">01</div>
                <h2>جمع‌آوری نمونه</h2>
                <p>
                  نام حرکت را وارد کن، دست را در چند زاویه نگه دار و هر بار «ثبت
                  نمونه» را بزن.
                </p>
                <label className="text-field">
                  <span>نام حرکت</span>
                  <input
                    value={sampleLabel}
                    maxLength={24}
                    onChange={(e) => setSampleLabel(e.target.value)}
                    placeholder="مثلاً تماس"
                  />
                </label>
                <div className="capture-preview">
                  <Hand />
                  <span>
                    {hands[0]
                      ? "دست آمادهٔ ثبت است"
                      : "ابتدا تشخیص زنده را شروع کن"}
                  </span>
                  <b>{hands[0]?.landmarks.length || 0}/21</b>
                </div>
                <button
                  className="primary-wide"
                  onClick={captureSample}
                  disabled={!hands[0]}
                >
                  <CircleDot /> ثبت نمونه
                </button>
              </article>
              <article className="dataset-card">
                <div className="step-number">02</div>
                <h2>Dataset</h2>
                <p>
                  برای نتیجهٔ پایدار، برای هر کلاس حداقل ۱۵ نمونه در نور و
                  زاویه‌های مختلف ثبت کن.
                </p>
                <div className="dataset-list">
                  {Object.entries(
                    samples.reduce(
                      (acc, item) => ({
                        ...acc,
                        [item.label]: (acc[item.label] || 0) + 1,
                      }),
                      {} as Record<string, number>,
                    ),
                  ).map(([label, count]) => (
                    <div key={label}>
                      <span>
                        <Fingerprint />
                        {label}
                      </span>
                      <b>{count.toLocaleString("fa-IR")} نمونه</b>
                      <button
                        onClick={() =>
                          setSamples((rows) =>
                            rows.filter((row) => row.label !== label),
                          )
                        }
                      >
                        <Trash2 />
                      </button>
                    </div>
                  ))}
                  {!samples.length && (
                    <div className="empty-mini">هنوز نمونه‌ای ثبت نشده است</div>
                  )}
                </div>
                <div className="dataset-footer">
                  <span>کل داده</span>
                  <b>{samples.length.toLocaleString("fa-IR")} نمونه</b>
                </div>
              </article>
              <article className="train-card">
                <div className="step-number">03</div>
                <h2>آموزش و ارزیابی</h2>
                <p>
                  مدل Centroid روی بردارهای نرمال‌شده آموزش می‌بیند و در تشخیص
                  زنده استفاده می‌شود.
                </p>
                <button className="train-button" onClick={train}>
                  <WandSparkles /> آموزش مدل
                </button>
                <div className="score-grid">
                  <div>
                    <span>Accuracy</span>
                    <b>{Math.round(customEvaluation.accuracy * 100)}٪</b>
                  </div>
                  <div>
                    <span>Precision</span>
                    <b>{Math.round(customEvaluation.precision * 100)}٪</b>
                  </div>
                  <div>
                    <span>Recall</span>
                    <b>{Math.round(customEvaluation.recall * 100)}٪</b>
                  </div>
                  <div>
                    <span>F1 Score</span>
                    <b>{Math.round(customEvaluation.f1 * 100)}٪</b>
                  </div>
                </div>
                {customModel && (
                  <div className="training-metrics">
                    <div className="curve-grid">
                      <div>
                        <span>Accuracy Curve</span>
                        <MiniLine values={customEvaluation.accuracyCurve} />
                      </div>
                      <div>
                        <span>Loss Curve</span>
                        <MiniLine
                          values={customEvaluation.lossCurve}
                          color="#ffbd67"
                        />
                      </div>
                    </div>
                    <div className="confusion-matrix">
                      <span>Confusion Matrix</span>
                      <div
                        className="matrix-grid"
                        style={{
                          gridTemplateColumns: `repeat(${customEvaluation.labels.length + 1}, minmax(38px, 1fr))`,
                        }}
                      >
                        <i />
                        {customEvaluation.labels.map((label) => (
                          <b key={`header-${label}`}>{label}</b>
                        ))}
                        {customEvaluation.labels.flatMap((actual) => [
                          <b key={`row-${actual}`}>{actual}</b>,
                          ...customEvaluation.labels.map((predicted) => (
                            <span
                              key={`${actual}-${predicted}`}
                              className={actual === predicted ? "hit" : ""}
                            >
                              {customEvaluation.matrix[actual]?.[predicted] ||
                                0}
                            </span>
                          )),
                        ])}
                      </div>
                    </div>
                  </div>
                )}
                {customModel && (
                  <div className="trained-model">
                    <Check />
                    <p>
                      <b>مدل فعال است</b>
                      <span>
                        {customModel.labels.join("، ")} ·{" "}
                        {customModel.sampleCount} نمونه
                      </span>
                    </p>
                    <button onClick={() => setCustomModel(null)}>
                      حذف مدل
                    </button>
                  </div>
                )}
              </article>
            </div>
            <article className="pipeline-card">
              <div className="section-title">
                <span>
                  <BrainCircuit /> پایپ‌لاین یادگیری
                </span>
                <small>LANDMARK CLASSIFIER</small>
              </div>
              <div className="pipeline">
                <span>
                  Camera<small>RGB Frame</small>
                </span>
                <i>→</i>
                <span>
                  MediaPipe<small>21 × XYZ</small>
                </span>
                <i>→</i>
                <span>
                  Normalize<small>Scale + Rotation</small>
                </span>
                <i>→</i>
                <span>
                  Centroid Model
                  <small>{customModel?.labels.length || 0} Classes</small>
                </span>
                <i>→</i>
                <span>
                  Real-Time<small>Confidence</small>
                </span>
              </div>
              <p className="pipeline-note">
                برای CNN، Data Augmentation، ONNX و GPU یک پایپ‌لاین Python جدا
                لازم است. خروجی Dataset این صفحه پایهٔ آن مرحله است.
              </p>
              <button
                onClick={() =>
                  downloadFile(
                    "dastbin-dataset.json",
                    JSON.stringify({ version: 1, samples }, null, 2),
                    "application/json",
                  )
                }
              >
                <Download /> Export Dataset
              </button>
            </article>
          </section>
        )}
        {tab === "roadmap" && (
          <section className="roadmap-view">
            <div className="view-heading">
              <div>
                <small>13 LEVELS · 100+ CAPABILITIES</small>
                <h1>نقشه‌راه پروژه</h1>
                <p>وضعیت واقعی قابلیت‌ها در نسخهٔ وب دست‌بین.</p>
              </div>
              <div className="overall-progress">
                <b>
                  {Math.round(
                    (roadmap.reduce((s, l) => s + l.done, 0) /
                      roadmap.reduce((s, l) => s + l.total, 0)) *
                      100,
                  )}
                  ٪
                </b>
                <span>پیشرفت نسخه وب</span>
              </div>
            </div>
            <div className="roadmap-grid">
              {roadmap.map((level) => (
                <article className="roadmap-card" key={level.level}>
                  <div className="roadmap-top">
                    <span>LEVEL {level.level}</span>
                    <b>
                      {level.done}/{level.total}
                    </b>
                  </div>
                  <h2>{level.title}</h2>
                  <div className="roadmap-progress">
                    <i
                      style={{ width: `${(level.done / level.total) * 100}%` }}
                    />
                  </div>
                  <ul>
                    {level.items.map((item, index) => (
                      <li
                        key={item}
                        className={index < level.done ? "done" : ""}
                      >
                        {index < level.done ? <Check /> : <Circle />}
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
      {settingsOpen && (
        <aside className="settings-drawer">
          <div className="drawer-head">
            <div>
              <Settings2 />
              <span>
                <b>تنظیمات تشخیص</b>
                <small>Realtime configuration</small>
              </span>
            </div>
            <button onClick={() => setSettingsOpen(false)}>×</button>
          </div>
          <div className="drawer-body">
            <label className="setting-field">
              <span>دوربین</span>
              <select
                value={settings.cameraId}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, cameraId: e.target.value }))
                }
              >
                <option value="">دوربین پیش‌فرض</option>
                {cameras.map((camera, index) => (
                  <option value={camera.deviceId} key={camera.deviceId}>
                    {camera.label || `دوربین ${index + 1}`}
                  </option>
                ))}
              </select>
              <ChevronDown />
            </label>
            <div className="setting-row">
              <label>
                <span>رزولوشن</span>
                <select
                  value={settings.resolution}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, resolution: e.target.value }))
                  }
                >
                  {Object.keys(resolutions).map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>هدف FPS</span>
                <select
                  value={settings.targetFps}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, targetFps: +e.target.value }))
                  }
                >
                  {[10, 15, 20, 30].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="setting-row">
              <label>
                <span>مدل تشخیص</span>
                <select
                  value={settings.modelMode}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      modelMode: e.target.value as Settings["modelMode"],
                    }))
                  }
                >
                  <option value="hybrid">MediaPipe + Custom</option>
                  <option value="base">MediaPipe Base</option>
                </select>
              </label>
              <label>
                <span>حالت Gesture</span>
                <select
                  value={settings.gestureMode}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      gestureMode: e.target.value as Settings["gestureMode"],
                    }))
                  }
                >
                  <option value="all">همه</option>
                  <option value="static">ثابت</option>
                  <option value="dynamic">حرکتی</option>
                </select>
              </label>
            </div>
            <label className="range-field">
              <span>
                Confidence Threshold{" "}
                <b>{Math.round(settings.threshold * 100)}٪</b>
              </span>
              <input
                type="range"
                min="35"
                max="90"
                value={settings.threshold * 100}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    threshold: +e.target.value / 100,
                  }))
                }
              />
            </label>
            {(
              [
                ["skeleton", "نمایش Skeleton"],
                ["joints", "نمایش نقاط مفاصل"],
                ["bbox", "نمایش Bounding Box"],
                ["trail", "نمایش مسیر حرکت"],
                ["mirror", "تصویر آینه‌ای"],
              ] as const
            ).map(([key, label]) => (
              <label className="drawer-switch" key={key}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={settings[key]}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, [key]: e.target.checked }))
                  }
                />
                <i />
              </label>
            ))}
            <button
              className="reset-settings"
              onClick={() => setSettings(defaultSettings)}
            >
              <RotateCcw /> بازنشانی تنظیمات
            </button>
          </div>
          <div className="drawer-footer">
            <ShieldCheck />
            <p>
              <b>پردازش محلی</b>
              <span>هیچ فریمی به سرور ارسال نمی‌شود.</span>
            </p>
          </div>
        </aside>
      )}
      {settingsOpen && (
        <button
          className="drawer-backdrop"
          aria-label="بستن تنظیمات"
          onClick={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
