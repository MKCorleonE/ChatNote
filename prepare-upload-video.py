from pathlib import Path
from fractions import Fraction
import json
import av

root = Path(__file__).resolve().parent
source = root / 'demo.mp4'
target = root / 'demo-github.mp4'
inspection = root / 'video-preview'
inspection.mkdir(exist_ok=True)

with av.open(str(source)) as incoming, av.open(str(target), 'w', options={'movflags': '+faststart'}) as outgoing:
    original_video = incoming.streams.video[0]
    encoded = outgoing.add_stream('libx264', rate=original_video.average_rate)
    encoded.width = original_video.codec_context.width
    encoded.height = original_video.codec_context.height
    encoded.pix_fmt = 'yuv420p'
    encoded.options = {'preset': 'medium', 'crf': '23', 'x264-params': 'vbv-maxrate=2500:vbv-bufsize=5000'}
    audio_map = {s.index: outgoing.add_stream_from_template(s) for s in incoming.streams.audio}
    frame_count = 0
    preview_times = [0.5, 6, 12, 19]
    next_preview = 0
    for packet in incoming.demux():
        if packet.stream.type == 'video':
            for frame in packet.decode():
                if next_preview < len(preview_times) and frame.time >= preview_times[next_preview]:
                    image = frame.to_image()
                    image.thumbnail((1280, 720))
                    image.save(inspection / f'frame-{next_preview+1}.jpg')
                    next_preview += 1
                for encoded_packet in encoded.encode(frame):
                    outgoing.mux(encoded_packet)
                frame_count += 1
        elif packet.stream.index in audio_map and packet.dts is not None:
            packet.stream = audio_map[packet.stream.index]
            outgoing.mux(packet)
    for encoded_packet in encoded.encode():
        outgoing.mux(encoded_packet)

if target.stat().st_size >= 10_000_000:
    raise RuntimeError('Upload copy is still above the conservative 10 MB limit')
with av.open(str(target)) as check:
    metadata = {'file': target.name, 'bytes': target.stat().st_size, 'duration_seconds': check.duration / av.time_base,
                'encoded_frames': frame_count,
                'streams': [{'type': s.type, 'codec': s.codec_context.name} for s in check.streams]}
print(json.dumps(metadata, ensure_ascii=False))
