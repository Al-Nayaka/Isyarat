#!/usr/bin/env python3
"""Ekstraksi landmark dari dataset gambar menjadi JSONL fitur Isyarat (Anggota C).

Dipakai untuk dataset gambar BISINDO (mis. Kaggle Word Dataset). Hasilnya
mengikuti normalisasi B yang sama dengan recorder:
- wrist (landmark 0) menjadi origin,
- skala = jarak terbesar wrist -> landmark lain,
- 21 x (x, y, z) per tangan,
- mode dual: dua tangan diurutkan kiri->kanan layar, tangan kosong dipad nol.

Pemakaian:
  python ml/scripts/extract-images.py \
    --images "C:/path/dataset_kata" \
    --out ml/data/raw/bisindo-word.jsonl

Struktur folder yang diharapkan:
  dataset_kata/
    Damai/*.jpg
    Mendengar/*.jpg
    ...

Catatan:
- Tidak ada identitas partisipan pada dataset gambar; semua sampel diberi
  orang_id yang sama sehingga training akan memakai split sampel (bukan
  partisipan) dan menandai laporan sebagai tidak memenuhi syarat PRD.
- Atribusi dataset wajib dipertahankan sesuai lisensinya.
"""
import argparse
import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

LANDMARKS_PER_HAND = 21
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


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


def main() -> int:
    parser = argparse.ArgumentParser(description="Ekstraksi landmark dataset gambar ke JSONL Isyarat.")
    parser.add_argument("--images", required=True, help="Folder akar kelas (satu subfolder per label).")
    parser.add_argument("--out", default="ml/data/raw/bisindo-word.jsonl", help="Path JSONL output.")
    parser.add_argument("--model", default="public/models/hand_landmarker.task", help="Model hand_landmarker.task.")
    parser.add_argument("--mode", choices=["dual", "single"], default="dual", help="Format fitur (default dual=126).")
    parser.add_argument("--participant", default="KAGGLE_WORD", help="orang_id untuk semua sampel.")
    parser.add_argument("--max-per-class", type=int, default=0, help="Batasi jumlah gambar per kelas (0=semua).")
    parser.add_argument("--source", default="kaggle:mulkanfajri/indonesian-sign-language-bisindo-word-dataset")
    parser.add_argument("--license", default="CC BY 4.0")
    args = parser.parse_args()

    images_root = Path(args.images)
    model_path = Path(args.model)
    output_path = Path(args.out)
    if not images_root.is_dir():
        print(f"Folder gambar tidak ditemukan: {images_root}", file=sys.stderr)
        return 1
    if not model_path.is_file():
        print(f"Model tidak ditemukan: {model_path}", file=sys.stderr)
        return 1

    landmarker = build_landmarker(model_path)
    class_dirs = sorted([item for item in images_root.iterdir() if item.is_dir()])
    if not class_dirs:
        print("Tidak ada subfolder kelas.", file=sys.stderr)
        return 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).isoformat()
    stats = {}
    written = 0
    skipped = 0

    with output_path.open("w", encoding="utf-8") as handle:
        for class_dir in class_dirs:
            label = slugify(class_dir.name)
            files = sorted(
                [item for item in class_dir.rglob("*") if item.is_file() and item.suffix.lower() in IMAGE_EXTENSIONS],
                key=lambda item: item.name,
            )
            if args.max_per_class > 0:
                files = files[: args.max_per_class]

            detected = 0
            for image_path in files:
                try:
                    image = mp.Image.create_from_file(str(image_path))
                    result = landmarker.detect(image)
                except Exception as error:  # noqa: BLE001 - lanjutkan gambar berikutnya
                    skipped += 1
                    stats.setdefault(label, {"total": 0, "detected": 0})["total"] += 1
                    print(f"  lewati {image_path.name}: {error}", file=sys.stderr)
                    continue

                stats.setdefault(label, {"total": 0, "detected": 0})["total"] += 1
                normalized = normalize_hands(result.hand_landmarks or [], args.mode, True)
                if normalized is None:
                    skipped += 1
                    continue

                record = {
                    "label": label,
                    "landmarks": [round(value, 6) for value in normalized["features"]],
                    "feature_mode": args.mode,
                    "feature_size": normalized["feature_size"],
                    "tangan_terlihat": normalized["hands_present"],
                    "orang_id": args.participant,
                    "kondisi": {"cahaya": "campur", "jarak": "campur", "latar": "campur"},
                    "sumber": args.source,
                    "lisensi": args.license,
                    "berkas_sumber": str(image_path.relative_to(images_root)).replace("\\", "/"),
                    "versi_normalisasi": "1.0",
                    "dicatat_pada": timestamp,
                }
                handle.write(json.dumps(record, ensure_ascii=False) + "\n")
                written += 1
                detected += 1
                stats[label]["detected"] = detected

            print(f"{label:20s} {detected}/{len(files)} gambar menghasilkan landmark")
            if detected == 0:
                print(f"  PERINGATAN: kelas {label} tidak punya sampel valid.", file=sys.stderr)

    print("")
    print(f"Total sampel ditulis : {written}")
    print(f"Total dilewati       : {skipped}")
    print(f"Output               : {output_path}")
    print("Catatan: semua sampel memakai orang_id yang sama, sehingga split")
    print("         partisipan tidak mungkin; laporan akan menandai non-compliant.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
