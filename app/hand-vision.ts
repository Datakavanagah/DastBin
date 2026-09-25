export type Point = { x: number; y: number; z?: number };
export type GestureCategory = { categoryName: string; score: number };

export type RawResult = {
  landmarks: Point[][];
  handedness: GestureCategory[][];
  gestures: GestureCategory[][];
};

export type HandSnapshot = {
  id: number;
  handedness: 'Left' | 'Right' | 'Unknown';
  confidence: number;
  gesture: string;
  rawGesture: string;
  landmarks: Point[];
  fingers: boolean[];
  fingerCount: number;
  bbox: { x: number; y: number; width: number; height: number };
  center: Point;
  pinch: number;
  speed: number;
  direction: string;
};

export type TrailPoint = Point & { time: number };
export type MotionMemory = Record<string, TrailPoint[]>;
export type CustomSample = {
  label: string;
  vector: number[];
  capturedAt: number;
};
export type CustomModel = {
  labels: string[];
  centroids: Record<string, number[]>;
  trainedAt: number;
  sampleCount: number;
};

export const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
] as const;

export const fingerNames = ['شست', 'اشاره', 'میانی', 'حلقه', 'کوچک'];

export const gestureFa: Record<string, string> = {
  None: 'نامشخص',
  Open_Palm: 'کف دست باز',
  Closed_Fist: 'مشت بسته',
  Thumb_Up: 'شست بالا',
  Thumb_Down: 'شست پایین',
  Victory: 'علامت صلح',
  Pointing_Up: 'اشاره به بالا',
  ILoveYou: 'دوستت دارم',
  OK: 'علامت OK',
  Pinch: 'پینچ',
  Wave: 'دست تکان دادن',
  Swipe_Left: 'حرکت به چپ',
  Swipe_Right: 'حرکت به راست',
  Swipe_Up: 'حرکت به بالا',
  Swipe_Down: 'حرکت به پایین',
};

const dist = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

export function normalizedVector(points: Point[]) {
  if (points.length !== 21) return [];
  const wrist = points[0];
  const scale = Math.max(dist(points[0], points[9]), 0.001);
  const flattened = points.flatMap((p) => [
    (p.x - wrist.x) / scale,
    (p.y - wrist.y) / scale,
    ((p.z || 0) - (wrist.z || 0)) / scale,
  ]);
  const angle = Math.atan2(points[9].y - wrist.y, points[9].x - wrist.x);
  const cos = Math.cos(-angle + Math.PI / 2),
    sin = Math.sin(-angle + Math.PI / 2);
  for (let i = 0; i < flattened.length; i += 3) {
    const x = flattened[i],
      y = flattened[i + 1];
    flattened[i] = x * cos - y * sin;
    flattened[i + 1] = x * sin + y * cos;
  }
  return flattened.map((v) => Math.round(v * 1000) / 1000);
}

export function trainCustomModel(samples: CustomSample[]): CustomModel | null {
  const grouped: Record<string, number[][]> = {};
  for (const sample of samples)
    (grouped[sample.label] ||= []).push(sample.vector);
  const labels = Object.keys(grouped).filter(
    (label) => grouped[label].length >= 3,
  );
  if (!labels.length) return null;
  const centroids: Record<string, number[]> = {};
  for (const label of labels) {
    const rows = grouped[label];
    centroids[label] = rows[0].map(
      (_, index) =>
        rows.reduce((sum, row) => sum + row[index], 0) / rows.length,
    );
  }
  return {
    labels,
    centroids,
    trainedAt: Date.now(),
    sampleCount: samples.length,
  };
}

export function predictCustom(model: CustomModel | null, points: Point[]) {
  if (!model) return null;
  const vector = normalizedVector(points);
  if (!vector.length) return null;
  let best = { label: '', distance: Infinity };
  for (const label of model.labels) {
    const centroid = model.centroids[label];
    const distance = Math.sqrt(
      vector.reduce(
        (sum, value, index) => sum + (value - centroid[index]) ** 2,
        0,
      ) / vector.length,
    );
    if (distance < best.distance) best = { label, distance };
  }
  const confidence = Math.max(0, Math.min(1, 1 - best.distance / 1.25));
  return confidence >= 0.55 ? { label: best.label, confidence } : null;
}

export function analyzeHands(
  result: RawResult,
  memory: MotionMemory,
  customModel: CustomModel | null,
  now: number,
): HandSnapshot[] {
  return result.landmarks.map((points, index) => {
    const handedness = (result.handedness[index]?.[0]?.categoryName ||
      'Unknown') as HandSnapshot['handedness'];
    const raw = result.gestures[index]?.[0] || {
      categoryName: 'None',
      score: 0,
    };
    const wrist = points[0],
      key = `${index}-${handedness}`;
    const trail = [...(memory[key] || []), { ...wrist, time: now }]
      .filter((item) => now - item.time < 1100)
      .slice(-24);
    memory[key] = trail;
    const minX = Math.min(...points.map((p) => p.x)),
      maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y)),
      maxY = Math.max(...points.map((p) => p.y));
    const palm = Math.max(dist(points[0], points[9]), 0.015);
    const fingers = [
      dist(points[4], points[0]) > dist(points[3], points[0]) * 1.09,
      dist(points[8], points[0]) > dist(points[6], points[0]) * 1.17,
      dist(points[12], points[0]) > dist(points[10], points[0]) * 1.16,
      dist(points[16], points[0]) > dist(points[14], points[0]) * 1.14,
      dist(points[20], points[0]) > dist(points[18], points[0]) * 1.12,
    ];
    const fingerCount = fingers.filter(Boolean).length;
    const pinchDistance = dist(points[4], points[8]);
    const pinch = Math.max(0, Math.min(1, 1 - pinchDistance / (palm * 0.7)));
    const first = trail[0],
      last = trail.at(-1)!;
    const elapsed = Math.max(1, last.time - first.time);
    const dx = last.x - first.x,
      dy = last.y - first.y;
    const speed = (Math.hypot(dx, dy) / elapsed) * 1000;
    let direction = 'ثابت';
    if (speed > 0.11)
      direction =
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? 'چپ'
            : 'راست'
          : dy > 0
            ? 'پایین'
            : 'بالا';
    let gesture = raw.categoryName || 'None';
    if (pinch > 0.72) gesture = fingerCount >= 3 ? 'OK' : 'Pinch';
    const recent = trail.filter((item) => now - item.time < 650);
    if (recent.length > 8) {
      let reversals = 0,
        previous = 0;
      for (let i = 1; i < recent.length; i++) {
        const delta = recent[i].x - recent[i - 1].x,
          sign = Math.sign(delta);
        if (sign && previous && sign !== previous && Math.abs(delta) > 0.006)
          reversals++;
        if (sign) previous = sign;
      }
      const span =
        Math.max(...recent.map((p) => p.x)) -
        Math.min(...recent.map((p) => p.x));
      if (reversals >= 2 && span > 0.12 && fingerCount >= 3) gesture = 'Wave';
    }
    if (speed > 0.5 && elapsed < 1150)
      gesture =
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? 'Swipe_Left'
            : 'Swipe_Right'
          : dy > 0
            ? 'Swipe_Down'
            : 'Swipe_Up';
    const custom = predictCustom(customModel, points);
    if (custom && (gesture === 'None' || raw.score < 0.62))
      gesture = `custom:${custom.label}`;
    return {
      id: index,
      handedness,
      confidence:
        custom && gesture.startsWith('custom:') ? custom.confidence : raw.score,
      gesture,
      rawGesture: raw.categoryName || 'None',
      landmarks: points,
      fingers,
      fingerCount,
      bbox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      pinch,
      speed,
      direction,
    };
  });
}

export function labelForGesture(value: string) {
  return value.startsWith('custom:')
    ? value.slice(7)
    : gestureFa[value] || value.replaceAll('_', ' ');
}

export function downloadFile(
  name: string,
  content: string,
  type = 'text/plain;charset=utf-8',
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
