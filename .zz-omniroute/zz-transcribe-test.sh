#!/usr/bin/env bash
# Test the OpenAI-compatible transcription endpoint through OmniRoute
# with the CRM key. Generates a tiny WAV locally (python3), posts it as
# multipart (the same way lib/ai/provider.ts does), prints status + body.
set -uo pipefail
cd "$HOME/omniroute"
KEY="$(cat crm-key.txt)"

python3 - "$HOME/omniroute/zz-test.wav" <<'PY'
import math, struct, sys, wave
# 1.2 s of 440 Hz sine, 16 kHz mono — enough for whisper to say something/empty
path = sys.argv[1]
rate, secs, freq = 16000, 1.2, 440.0
frames = b''.join(
    struct.pack('<h', int(9000 * math.sin(2 * math.pi * freq * i / rate)))
    for i in range(int(rate * secs))
)
with wave.open(path, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
    w.writeframes(frames)
print("wav written", path)
PY

echo "--- direct /audio/transcriptions (model openrouter/openai/whisper-1) ---"
curl -s -m 90 -w $'\nstatus=%{http_code}\n' -X POST http://127.0.0.1:3111/v1/audio/transcriptions \
  -H "Authorization: Bearer ${KEY}" \
  -F "file=@$HOME/omniroute/zz-test.wav;type=audio/wav" \
  -F "model=openrouter/openai/whisper-1" | head -c 600

echo
echo "--- direct /audio/transcriptions (plain name whisper-1) ---"
curl -s -m 90 -w $'\nstatus=%{http_code}\n' -X POST http://127.0.0.1:3111/v1/audio/transcriptions \
  -H "Authorization: Bearer ${KEY}" \
  -F "file=@$HOME/omniroute/zz-test.wav;type=audio/wav" \
  -F "model=whisper-1" | head -c 600

rm -f "$HOME/omniroute/zz-test.wav"
