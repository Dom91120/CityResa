"""
Floute légèrement les visages d'une photo avant son dépôt dans prisma/assets/photos.

    py -3 scripts/flouter-visages.py <source.jpg> <destination.jpg> [--largeur 1600]
        [--zone x,y,w,h ...] [--controle apercu.jpg]

Détection par le modèle YuNet de l'OpenCV zoo (scripts/modeles/, licence Apache 2.0), à deux
échelles, complétée par des zones manuelles `--zone` en pixels de l'image de sortie.
Dépendances : `py -3 -m pip install --user "opencv-python-headless<5" numpy`. Le flou est doux (gaussien
proportionnel à la taille du visage, masque elliptique adouci) : les silhouettes restent
lisibles, les traits ne le sont plus. `--controle` écrit une copie réduite avec les zones
encadrées pour vérification. L'image de sortie est redimensionnée à `--largeur` pixels de
large (JPEG qualité 82), comme les autres photos du jeu de démonstration.
"""

import argparse
import os
import sys

import cv2
import numpy as np


# Chemin relatif au dossier courant : OpenCV lit mal les chemins accentués sous Windows.
MODELE = os.path.relpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "modeles", "face_detection_yunet_2023mar.onnx")
)


def detecter(img, seuil=0.45):
    """
    Toutes les boîtes (x, y, w, h) trouvées par YuNet (OpenCV zoo), à l'échelle 1 et à
    l'échelle 2 pour les petits visages de fond de salle.
    """
    detecteur = cv2.FaceDetectorYN.create(MODELE, "", (320, 320), seuil, 0.3, 5000)
    boites = []
    for echelle in (1, 2):
        image = img if echelle == 1 else cv2.resize(img, None, fx=echelle, fy=echelle)
        detecteur.setInputSize((image.shape[1], image.shape[0]))
        _, visages = detecteur.detect(image)
        for v in [] if visages is None else visages:
            x, y, w, h = (v[:4] / echelle).astype(int)
            boites.append((int(x), int(y), int(w), int(h)))
    return fusionner(boites)


def fusionner(boites):
    """Fusionne les boîtes qui se recouvrent largement (mêmes visages vus par plusieurs cascades)."""
    out = []
    for b in sorted(boites, key=lambda b: -b[2] * b[3]):
        x, y, w, h = b
        doublon = False
        for i, (ox, oy, ow, oh) in enumerate(out):
            ix = max(0, min(x + w, ox + ow) - max(x, ox))
            iy = max(0, min(y + h, oy + oh) - max(y, oy))
            if ix * iy > 0.4 * min(w * h, ow * oh):
                doublon = True
                break
        if not doublon:
            out.append(b)
    return out


def flouter(img, boites, marge=0.35):
    """Flou gaussien doux sous un masque elliptique adouci, pour chaque boîte élargie de `marge`."""
    sortie = img.copy()
    for x, y, w, h in boites:
        mx, my = int(w * marge), int(h * marge)
        x0, y0 = max(0, x - mx), max(0, y - my)
        x1, y1 = min(img.shape[1], x + w + mx), min(img.shape[0], y + h + my)
        zone = img[y0:y1, x0:x1]
        if zone.size == 0:
            continue
        k = max(5, (min(zone.shape[0], zone.shape[1]) // 9) | 1)
        flou = cv2.GaussianBlur(zone, (k, k), 0)
        masque = np.zeros(zone.shape[:2], dtype=np.float32)
        cv2.ellipse(
            masque,
            ((x1 - x0) // 2, (y1 - y0) // 2),
            (max(1, (x1 - x0) // 2), max(1, (y1 - y0) // 2)),
            0,
            0,
            360,
            1.0,
            -1,
        )
        masque = cv2.GaussianBlur(masque, (k, k), 0)[..., None]
        sortie[y0:y1, x0:x1] = (flou * masque + zone * (1 - masque)).astype(np.uint8)
    return sortie


def main():
    p = argparse.ArgumentParser()
    p.add_argument("source")
    p.add_argument("destination")
    p.add_argument("--largeur", type=int, default=1600)
    p.add_argument("--zone", action="append", default=[], help="x,y,w,h (image de sortie)")
    p.add_argument("--controle", help="aperçu réduit avec les zones encadrées")
    p.add_argument("--sans-detection", action="store_true")
    a = p.parse_args()

    donnees = np.fromfile(a.source, dtype=np.uint8)  # chemins accentués sous Windows
    img = cv2.imdecode(donnees, cv2.IMREAD_COLOR)
    if img is None:
        sys.exit(f"Image illisible : {a.source}")
    if img.shape[1] > a.largeur:
        echelle = a.largeur / img.shape[1]
        img = cv2.resize(img, (a.largeur, round(img.shape[0] * echelle)), interpolation=cv2.INTER_AREA)

    boites = [] if a.sans_detection else detecter(img)
    for z in a.zone:
        boites.append(tuple(int(v) for v in z.split(",")))
    print(f"{a.source} : {len(boites)} zone(s) floutée(s) {boites}")

    sortie = flouter(img, boites)
    ok, enc = cv2.imencode(".jpg", sortie, [cv2.IMWRITE_JPEG_QUALITY, 82])
    if not ok:
        sys.exit("Encodage JPEG impossible")
    enc.tofile(a.destination)

    if a.controle:
        apercu = sortie.copy()
        for x, y, w, h in boites:
            cv2.rectangle(apercu, (x, y), (x + w, y + h), (0, 0, 255), 3)
        apercu = cv2.resize(apercu, (800, round(apercu.shape[0] * 800 / apercu.shape[1])))
        ok, enc = cv2.imencode(".jpg", apercu, [cv2.IMWRITE_JPEG_QUALITY, 70])
        enc.tofile(a.controle)


if __name__ == "__main__":
    main()
