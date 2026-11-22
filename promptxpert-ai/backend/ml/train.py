"""Fine-tune EfficientNet-B0 for real vs AI-generated classification (run on your laptop / Colab GPU).

Dataset layout (e.g. a subset of GenImage, keep one generator for the test split):
  data/train/{real,ai}/*.jpg   data/val/{real,ai}/*.jpg   data/test/{real,ai}/*.jpg

  pip install torch torchvision scikit-learn
  python ml/train.py --data data --epochs 6
Outputs ml/weights/efficientnet_b0.pt and ml/weights/meta.json (threshold + inconclusive band chosen on VAL).
Commit the weights only if the file is small enough and the licence allows it (~16 MB).
No accuracy is claimed anywhere until you run ml/evaluate.py on the held-out test split.
"""
import argparse, json
from pathlib import Path

import torch
from sklearn.metrics import roc_auc_score
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms as T

OUT = Path(__file__).parent / "weights"
NORM = T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])


def loaders(root, bs):
    tr = T.Compose([T.Resize((224, 224)), T.RandomHorizontalFlip(), T.ToTensor(), NORM])
    ev = T.Compose([T.Resize((224, 224)), T.ToTensor(), NORM])
    ds = {s: datasets.ImageFolder(Path(root) / s, tr if s == "train" else ev) for s in ("train", "val")}
    assert ds["train"].class_to_idx == {"ai": 0, "real": 1}, "folders must be named 'ai' and 'real'"
    return (DataLoader(ds["train"], bs, shuffle=True, num_workers=2), DataLoader(ds["val"], bs, num_workers=2))


def predict(net, dl, dev):
    net.eval(); ys, ps = [], []
    with torch.no_grad():
        for x, y in dl:
            ps += torch.sigmoid(net(x.to(dev)).squeeze(1)).cpu().tolist(); ys += (1 - y).tolist()  # 1 = AI
    return ys, ps


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--data", required=True)
    ap.add_argument("--epochs", type=int, default=6); ap.add_argument("--bs", type=int, default=32)
    a = ap.parse_args()
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    tr, va = loaders(a.data, a.bs)
    net = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
    for p in net.features.parameters():
        p.requires_grad = False  # fine-tune final layers first (per synopsis 4.4)
    net.classifier[1] = nn.Linear(net.classifier[1].in_features, 1)
    net.to(dev)
    opt = torch.optim.AdamW([p for p in net.parameters() if p.requires_grad], lr=1e-3)
    loss_fn = nn.BCEWithLogitsLoss()
    for ep in range(a.epochs):
        if ep == a.epochs // 2:  # unfreeze for the second half
            for p in net.features.parameters(): p.requires_grad = True
            opt = torch.optim.AdamW(net.parameters(), lr=1e-4)
        net.train()
        for x, y in tr:
            x, y = x.to(dev), (1 - y).float().to(dev)  # target 1 = AI-generated
            opt.zero_grad(); loss = loss_fn(net(x).squeeze(1), y); loss.backward(); opt.step()
        ys, ps = predict(net, va, dev)
        print(f"epoch {ep+1}: val ROC-AUC {roc_auc_score(ys, ps):.4f}")
    ys, ps = predict(net, va, dev)
    best_t = max((t / 100 for t in range(20, 81)),
                 key=lambda t: sum((p >= t) == bool(y) for y, p in zip(ys, ps)))
    OUT.mkdir(exist_ok=True)
    torch.save(net.state_dict(), OUT / "efficientnet_b0.pt")
    (OUT / "meta.json").write_text(json.dumps({
        "version": "efficientnet-b0-v1", "threshold": best_t,
        "band_low": round(best_t - 0.15, 2), "band_high": round(best_t + 0.15, 2)}, indent=2))
    print("saved weights; threshold", best_t)


if __name__ == "__main__":
    main()
