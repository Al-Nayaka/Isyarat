#!/usr/bin/env python3
"""Ekstraksi landmark dari dataset VIDEO menjadi JSONL fitur Isyarat (Anggota C).

Dipakai untuk dataset video kata BISINDO, khususnya WL-BISINDO
(Kaggle: glennleonali/wl-bisindo). Karena classifier saat ini adalah KNN
statis (satu pose), setiap video diringkas menjadi satu atau beberapa frame
representatif. Ini adalah pendekatan kompromi: gerakan temporal tidak
dipahami model, hanya bentuk tangan pada frame yang dipilih.

Normalisasi mengikuti aturan B yang sama dengan recorder dan
ml/scripts/extract-images.py:
- wrist (landmark 0) menjadi origin,
- skala = jarak terbesar wrist -> landmark lain,
- 21 x (x, y, z) per tangan,
- mode dual: dua tangan diurutkan kiri->kanan layar, tangan kosong dipad nol.

Pemakaian:
  python ml/scripts/extract-videos.py \
    --videos "C:/path/wl-bisindo" \
    --out ml/data/raw/wl-bisindo.jsonl \
    --frames-per-video 1

Struktur yang didukung:
  A) Nama berkas WL-BISINDO: [signerID]_[labelID]_[sampleID].mp4
     contoh: 1_0_1.mp4 -> orang_id WL_S1, label air
  B) Folder kelas: <root>/<Nama Kelas>/*.mp4
  C) Kombinasi: label dari folder, signer dari nama berkas/a1_0_1.mp4

Pemetaan label 0-31 mengikuti README resmi WL-BISINDO. Bila nama folder
memakai teks (mis. "Terima kasih"), teks itu yang dipakai sebagai label.
"""
import argparse
import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

LANDMARKS_PER_HAND = 21
VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}

# Urutan resmi WL-BISINDO (README, label 0-31).
WL_LABELS = [
    "Air", "Belajar", "Cari", "Hari", "Ingat", "Lagi", "Maaf", "Makan",
    "Motor", "Saya", "Terima kasih", "Tuli", "Apa", "Siapa", "Kapan",
    "Di mana", "Mengapa", "Bagaimana", "Merah", "Kuning", "Hijau", "Hitam",
    "Dengar", "Berangkat", "Datang", "Teman", "Keluarga", "Rumah", "Pagi",
    "Siang", "Sore", "Malam",
]


def slugify(value: str) -> str:
    value = value.strip().lower().replace(" ", "_")
    value = re.sub(r"[^a-z0-9_]+", "", value)
    return re.sub(r"_+", "_", value).strip("_")


def mean_x(landmarks) -> float:
    return sum(point.x for point in landmarks) / len(landmarks)


def bbox_area(landmarks) -> float:
    xs = [point.x for point in landmarks]
    ys = [point.y for point in landmarks]
    return max(0.0, (max(xs) - min(xs)) * (max(ys) - min(ys)))


def hand_vector(landmarks, use_z: bool):
    wrist = landmarks[0]
    max_distance = 0.0
    for point in landmarks[1:]:
        dx = point.x - wrist.x
        dy = point.y - wrist.y
        dz = (point.z or 0.0) - (wrist.z or 0.0) if use_z else 0.0
        max_distance = max(max_distance, math.sqrt(dx * dx + dy * dy + dz * dz))
    if not math.isfinite(max_distance) or max_distance < 1e-4:
        return None
    vector = []
    for point in landmarks[:LANDMARKS_PER_HAND]:
        vector.append((point.x - wrist.x) / max_distance)
        vector.append((point.y - wrist.y) / max_distance)
        if use_z:
            vector.append(((point.z or 0.0) - (wrist.z or 0.0)) / max_distance)
    return vector


def normalize_hands(hands, mode: str, use_z: bool):
    usable = [
        {"landmarks": hand, "center": mean_x(hand), "area": bbox_area(hand)}
        for hand in hands
        if hand and len(hand) >= LANDMARKS_PER_HAND
    ]
    if not usable:
        return None

    per_hand = LANDMARKS_PER_HAND * (3 if use_z else 2)

    if mode == "single":
        dominant = max(usable, key=lambda hand: hand["area"])
        vector = hand_vector(dominant["landmarks"], use_z)
        if vector is None:
            return None
        return {"features": vector, "hands_present": 1, "feature_size": per_hand}

    ordered = sorted(usable, key=lambda hand: hand["center"])[:2]
    slots = []
    for hand in ordered:
        vector = hand_vector(hand["landmarks"], use_z)
        if vector is not None:
            slots.append(vector)
    if not slots:
        return None
    while len(slots) < 2:
        slots.append([0.0] * per_hand)
    return {
        "features": slots[0] + slots[1],
        "hands_present": len(slots),
        "feature_size": per_hand * 2,
    }


def build_landmarker(model_path: Path):
    options = vision.HandLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=str(model_path)),
        running_mode=vision.RunningMode.IMAGE,
        num_hands=2,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    return vision.HandLandmarker.create_from_options(options)


def parse_identity(video_path: Path, videos_root: Path):
    """Kembalikan (label_slug, orang_id, keterangan)."""
    stem = video_path.stem
    parent = video_path.parent.name

    # Pola nama resmi WL-BISINDO: signer<id>_label<id>_sample<id>.mp4
    # (signer dan label 0-based pada berkas asli).
    match = re.fullmatch(r"signer(\d+)_label(\d+)_sample(\d+)", stem, re.IGNORECASE)
    if match:
        signer, label_id, _sample = match.groups()
        signer_number = int(signer) + 1  # tampilkan 1-based: WL_S1..WL_S5
        label_id = int(label_id)
        if 0 <= label_id < len(WL_LABELS):
            return slugify(WL_LABELS[label_id]), f"WL_S{signer_number}", f"WL_BISINDO:{label_id}"
        return None, f"WL_S{signer_number}", f"label_id={label_id} di luar 0-31"

    # Pola ringkas: <signer>_<label>_<sample> (angka).
    match = re.fullmatch(r"(\d+)_(\d+)_(\d+)", stem)
    if match:
        signer, label_id, _sample = match.groups()
        label_id = int(label_id)
        if 0 <= label_id < len(WL_LABELS):
            return slugify(WL_LABELS[label_id]), f"WL_S{signer}", f"WL_BISINDO:{label_id}"
        return None, f"WL_S{signer}", f"label_id={label_id} di luar 0-31"

    # Nama berawalan signer, mis. S1_0_2 atau signer1_11_3.
    match = re.search(r"(?:^|[_-])s(?:igner)?[_-]?(\d+)[_-](\d+)[_-](\d+)$", stem, re.IGNORECASE)
    if match:
        signer, label_id, _sample = match.groups()
        label_id = int(label_id)
        if 0 <= label_id < len(WL_LABELS):
            return slugify(WL_LABELS[label_id]), f"WL_S{signer}", f"WL_BISINDO:{label_id}"

    # Fallback: label dari folder induk, signer dari awalan angka/teks.
    label = slugify(parent) if parent and parent.lower() not in {"videos", "dataset", "raw"} else None
    signer_match = re.search(r"(\d+)", stem)
    signer = f"WL_S{signer_match.group(1)}" if signer_match else "WL_UNKNOWN"
    if label and label in {slugify(item) for item in WL_LABELS}:
        return label, signer, "folder"
    if label:
        return label, signer, "folder-bebas"
    return None, signer, "tidak dikenali"


def frame_indices(total_frames: int, per_video: int, start: float, end: float):
    if total_frames <= 0:
        return []
    if per_video <= 1:
        position = (start + end) / 2
        return [min(total_frames - 1, max(0, int(round(position * (total_frames - 1)))))]
    low = int(round(start * (total_frames - 1)))
    high = int(round(end * (total_frames - 1)))
    if high <= low:
        return [low]
    step = (high - low) / (per_video - 1)
    indices = sorted({int(round(low + step * index)) for index in range(per_video)})
    return [min(total_frames - 1, index) for index in indices]


def read_frame(capture, index: int):
    capture.set(cv2.CAP_PROP_POS_FRAMES, index)
    ok, frame = capture.read()
    return frame if ok else None


_WORKER_LANDMARKER = None


def _init_worker(model_path):
    global _WORKER_LANDMARKER
    _WORKER_LANDMARKER = build_landmarker(Path(model_path))


def _process_video(task):
    """Dipanggil di worker: ekstrak frame representatif satu video."""
    video_path, videos_root, frames_per_video, start, end, mode, source, license_text, timestamp = task
    video_path = Path(video_path)
    videos_root = Path(videos_root)
    label, signer, _note = parse_identity(video_path, videos_root)
    if not label:
        return {"label": None, "records": [], "missing": 0, "unreadable": 0, "videos": 1}

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        capture.release()
        return {"label": label, "records": [], "missing": 0, "unreadable": 1, "videos": 1}

    total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    indices = frame_indices(total, frames_per_video, start, end)
    relative = str(video_path.relative_to(videos_root)).replace("\\", "/")
    records = []
    missing = 0
    unreadable = 0

    for index in indices:
        frame = read_frame(capture, index)
        if frame is None:
            unreadable += 1
            continue
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = _WORKER_LANDMARKER.detect(image)
        normalized = normalize_hands(result.hand_landmarks or [], mode, True)
        if normalized is None:
            missing += 1
            continue
        records.append({
            "label": label,
            "landmarks": [round(value, 6) for value in normalized["features"]],
            "feature_mode": mode,
            "feature_size": normalized["feature_size"],
            "tangan_terlihat": normalized["hands_present"],
            "orang_id": signer,
            "kondisi": {"cahaya": "campur", "jarak": "campur", "latar": "campur"},
            "sumber": source,
            "lisensi": license_text,
            "berkas_sumber": f"{relative}#frame={index}",
            "versi_normalisasi": "1.0",
            "dicatat_pada": timestamp,
        })
    capture.release()
    return {"label": label, "records": records, "missing": missing, "unreadable": unreadable, "videos": 1}


def main() -> int:
    parser = argparse.ArgumentParser(description="Ekstraksi landmark dataset video ke JSONL Isyarat.")
    parser.add_argument("--videos", required=True, help="Folder akar dataset video.")
    parser.add_argument("--out", default="ml/data/raw/wl-bisindo.jsonl", help="Path JSONL output.")
    parser.add_argument("--model", default="public/models/hand_landmarker.task", help="Model hand_landmarker.task.")
    parser.add_argument("--mode", choices=["dual", "single"], default="dual", help="Format fitur (default dual=126).")
    parser.add_argument("--frames-per-video", type=int, default=1, help="Jumlah frame representatif per video (default 1).")
    parser.add_argument("--start", type=float, default=0.25, help="Batas bawah posisi frame relatif (0..1).")
    parser.add_argument("--end", type=float, default=0.75, help="Batas atas posisi frame relatif (0..1).")
    parser.add_argument("--max-per-class", type=int, default=0, help="Batasi jumlah video per kelas (0=semua).")
    parser.add_argument("--workers", type=int, default=1, help="Jumlah proses paralel (default 1).")
    parser.add_argument("--source", default="kaggle:glennleonali/wl-bisindo")
    parser.add_argument("--license", default="CC BY-NC 4.0")
    args = parser.parse_args()

    videos_root = Path(args.videos)
    model_path = Path(args.model)
    output_path = Path(args.out)
    if not videos_root.is_dir():
        print(f"Folder video tidak ditemukan: {videos_root}", file=sys.stderr)
        return 1
    if not model_path.is_file():
        print(f"Model tidak ditemukan: {model_path}", file=sys.stderr)
        return 1
    if not (0.0 <= args.start < args.end <= 1.0):
        print("--start dan --end harus 0 <= start < end <= 1.", file=sys.stderr)
        return 1
    if args.frames_per_video < 1:
        print("--frames-per-video harus >= 1.", file=sys.stderr)
        return 1

    videos = sorted(
        [item for item in videos_root.rglob("*") if item.is_file() and item.suffix.lower() in VIDEO_EXTENSIONS],
        key=lambda item: str(item.relative_to(videos_root)).lower(),
    )
    if not videos:
        print(f"Tidak ada video di {videos_root}", file=sys.stderr)
        return 1

    grouped = {}
    unparsed = []
    for video_path in videos:
        label, signer, note = parse_identity(video_path, videos_root)
        if not label:
            unparsed.append((video_path, note))
            continue
        grouped.setdefault(label, []).append(video_path)

    if args.max_per_class > 0:
        for label in grouped:
            grouped[label] = grouped[label][: args.max_per_class]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).isoformat()
    tasks = [
        (str(video_path), str(videos_root), args.frames_per_video, args.start, args.end,
         args.mode, args.source, args.license, timestamp)
        for label in sorted(grouped)
        for video_path in grouped[label]
    ]

    stats = {label: {"videos": len(grouped[label]), "samples": 0} for label in grouped}
    written = 0
    frames_missing_hand = 0
    unreadable = 0
    workers = max(1, min(args.workers, 16))

    with output_path.open("w", encoding="utf-8") as handle:
        results = None
        executor = None
        try:
            if workers > 1:
                from concurrent.futures import ProcessPoolExecutor
                executor = ProcessPoolExecutor(
                    max_workers=workers,
                    initializer=_init_worker,
                    initargs=(str(model_path),),
                )
                results = executor.map(_process_video, tasks, chunksize=8)
            else:
                _init_worker(str(model_path))
                results = map(_process_video, tasks)

            done = 0
            for result in results:
                done += 1
                label = result["label"]
                frames_missing_hand += result["missing"]
                unreadable += result["unreadable"]
                for record in result["records"]:
                    handle.write(json.dumps(record, ensure_ascii=False) + "\n")
                    written += 1
                if label:
                    stats[label]["samples"] += len(result["records"])
                if workers == 1 and done % 25 == 0:
                    print(f"  {done}/{len(tasks)} video diproses, {written} sampel", flush=True)
                elif workers > 1 and done % 100 == 0:
                    print(f"  {done}/{len(tasks)} video diproses, {written} sampel", flush=True)
        finally:
            if executor is not None:
                executor.shutdown(wait=True)

    for label in sorted(stats):
        print(f"{label:20s} {stats[label]['samples']:4d} sampel dari {stats[label]['videos']} video")

    if unparsed:
        print("", file=sys.stderr)
        print(f"{len(unparsed)} berkas tidak dapat dipetakan ke label:", file=sys.stderr)
        for video_path, note in unparsed[:10]:
            print(f"  - {video_path}: {note}", file=sys.stderr)

    print("")
    print(f"Total sampel ditulis      : {written}")
    print(f"Frame tanpa tangan        : {frames_missing_hand}")
    print(f"Video/frame gagal dibaca  : {unreadable}")
    print(f"Berkas tak terpetakan     : {len(unparsed)}")
    print(f"Output                    : {output_path}")
    print("Catatan: model KNN statis; frame representatif bukan pengenalan gerakan.")
    print("Lisensi WL-BISINDO CC BY-NC 4.0 (non-komersial, atribusi wajib).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
