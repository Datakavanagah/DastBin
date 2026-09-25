let recognizer;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const { FilesetResolver, GestureRecognizer } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
      recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task', delegate: 'CPU' },
        runningMode: 'VIDEO', numHands: 1, minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.6,
      });
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame' && recognizer) {
      try {
        const result = recognizer.recognizeForVideo(data.bitmap, data.time);
        const points = result.landmarks[0] || [], gesture = result.gestures[0]?.[0];
        let state = points.length ? 'other' : 'none';
        if (points.length && gesture?.score >= 0.65) { if (gesture.categoryName === 'Open_Palm') state = 'open'; if (gesture.categoryName === 'Closed_Fist') state = 'closed'; }
        self.postMessage({ type: 'result', state, score: gesture?.score || 0, points });
      } finally { data.bitmap.close(); }
    }
  } catch { self.postMessage({ type: 'error' }); }
};
