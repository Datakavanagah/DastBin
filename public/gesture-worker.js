let recognizer;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const { FilesetResolver, GestureRecognizer } = await import('/vision/vision_bundle.mjs');
      const vision = await FilesetResolver.forVisionTasks('/vision/wasm');
      recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/models/gesture_recognizer.task', delegate: 'CPU' },
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
