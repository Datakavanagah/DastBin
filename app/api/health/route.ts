export async function GET() {
  return Response.json({
    status: 'ok',
    product: 'Dastbin AI Hand Vision',
    model: 'MediaPipe Gesture Recognizer',
    modelVersion: '0.10.21',
    runtime: 'browser-wasm',
    capabilities: [
      'multi-hand',
      'finger-count',
      'gesture',
      'tracking',
      'custom-landmark-classifier',
    ],
  });
}
