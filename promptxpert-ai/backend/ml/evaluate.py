"""Evaluate on the held-out test split, including resized/JPEG-compressed variants (synopsis 4.4 / 4.8).

  python ml/evaluate.py --data data/test
Prints precision, recall, F1, accuracy, ROC-AUC, confusion matrix and robustness deltas. Report these numbers as-is.
"""
import argparse, io, json, sys
from pathlib import Path

from PIL import Image
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.services import detector  # noqa: E402


def variants(img):
    yield "original", img
    yield "resized_50", img.resize((max(64, img.width // 2), max(64, img.height // 2)))
    buf = io.BytesIO(); img.convert("RGB").save(buf, "JPEG", quality=60); buf.seek(0)
    yield "jpeg_q60", Image.open(buf)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--data", required=True); a = ap.parse_args()
    res = {}
    for label, cls in (("ai", 1), ("real", 0)):
        for f in sorted((Path(a.data) / label).glob("*")):
            try: img = Image.open(f); img.load()
            except Exception: continue
            for name, v in variants(img):
                s = detector.analyze(v)["score"]
                res.setdefault(name, ([], []))[0].append(cls); res[name][1].append(s)
    thr = (json.loads((detector.WEIGHTS / "meta.json").read_text()).get("threshold", 0.5)
           if (detector.WEIGHTS / "meta.json").exists() else 0.5)
    for name, (y, s) in res.items():
        p = [int(x >= thr) for x in s]
        print(f"\n== {name} (n={len(y)}, threshold={thr}) ==")
        print("precision", round(precision_score(y, p), 4), "recall", round(recall_score(y, p), 4),
              "F1", round(f1_score(y, p), 4), "acc", round(accuracy_score(y, p), 4), "AUC", round(roc_auc_score(y, s), 4))
        print("confusion [[TN FP],[FN TP]]:", confusion_matrix(y, p).tolist())


if __name__ == "__main__":
    main()
