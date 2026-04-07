#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère un PDF A4 (une page) d'un contrat de location au design du fichier HTML de référence
(contrat_location_CTR-*.html) — en-têtes #1a3c6e, grilles 2 colonnes, bloc total, signatures.

Usage:
  python scripts/contrat_pdf_reportlab.py contrat_location_CTR-D98B6C.html -o contrat.pdf
  python scripts/contrat_pdf_reportlab.py contrat.html   # sortie: contrat_CTR-....pdf

Intégration INVOORENT: exportez une réservation + client + véhicule en JSON et passez --json data.json
(voir build_contract_data_from_invoo() pour le schéma attendu).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None  # type: ignore

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

# Couleurs du design HTML
BLUE = colors.HexColor("#1a3c6e")
BLUE_LIGHT = colors.HexColor("#2e5c9a")
BLUE_MUTED = colors.HexColor("#a0b8d8")
BLUE_LINE = colors.HexColor("#3a6aaa")
TEXT_DARK = colors.HexColor("#1a1a1a")
TEXT_MED = colors.HexColor("#555555")
TEXT_DIM = colors.HexColor("#888888")
TEXT_LIGHT = colors.HexColor("#999999")
ORANGE_RESTE = colors.HexColor("#ff9966")
WHITE = colors.white


def _safe(s: Any) -> str:
    if s is None:
        return "—"
    t = str(s).strip()
    return t if t else "—"


def parse_contract_html(html_path: Path) -> dict[str, Any]:
    """Extrait les données du HTML exporté (même structure que contrat_location_CTR-*.html)."""
    if BeautifulSoup is None:
        raise RuntimeError("Installez beautifulsoup4: pip install -r scripts/requirements-pdf.txt")
    raw = html_path.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(raw, "html.parser")

    data: dict[str, Any] = {
        "agency_name": "Agence",
        "slogan": "",
        "contact_line": "",
        "rc_patente": "",
        "contract_num": "CTR-000000",
        "contract_date": "",
        "locataire": {},
        "conducteurs": [],
        "vehicule": {},
        "location": {},
        "total_mad": "",
        "total_detail": "",
        "caution_mad": "",
        "reste_mad": "",
        "conditions": [],
        "sign_locataire": "",
        "sign_agency": "",
        "footer": "",
    }

    text = soup.get_text("\n", strip=True)

    m_ctr = re.search(r"CTR-[A-Z0-9]{6}", text)
    if m_ctr:
        data["contract_num"] = m_ctr.group(0)

    m_date = re.search(r"Date\s*:\s*(\d{2}/\d{2}/\d{4})", text)
    if m_date:
        data["contract_date"] = m_date.group(1)

    # En-tête agence : premiers blocs significatifs
    header = soup.find("div", style=lambda s: s and "justify-content:space-between" in s)
    if header:
        lines = [ln.strip() for ln in header.get_text("\n", strip=True).split("\n") if ln.strip()]
        if lines:
            # Heuristique : nom en gros = première ligne longue hors N° / Date / CTR
            for i, ln in enumerate(lines):
                if ln.startswith("CTR-") or ln.startswith("Date") or ln == "N° Contrat":
                    continue
                if len(ln) > 3 and "Tél" not in ln and "@" not in ln and "RC" not in ln:
                    data["agency_name"] = ln
                    if i + 1 < len(lines) and (
                        "Louez" in lines[i + 1] or "confiance" in lines[i + 1]
                    ):
                        data["slogan"] = lines[i + 1]
                    break
            for ln in lines:
                if "Tél" in ln or "@" in ln:
                    data["contact_line"] = ln
                if "RC" in ln or "Patente" in ln:
                    data["rc_patente"] = ln

    def section_rows(title: str) -> list[tuple[str, str]]:
        rows: list[tuple[str, str]] = []
        for tag in soup.find_all(string=re.compile(re.escape(title))):
            p = tag.parent
            if not p:
                continue
            grid = p.find_next_sibling("div")
            if not grid:
                continue
            for row in grid.find_all("div", recursive=False):
                spans = row.find_all("span")
                if len(spans) >= 2:
                    lab = spans[0].get_text(strip=True)
                    val = spans[1].get_text(strip=True)
                    rows.append((lab, val))
            break
        return rows

    loc = section_rows("INFORMATIONS DU LOCATAIRE")
    data["locataire"] = dict(loc)

    # Conducteur(s) — bandeau bleu clair
    for tag in soup.find_all(string=re.compile(r"CONDUCTEUR\(S\) ADDITIONNEL\(S\)")):
        p = tag.parent
        if not p:
            continue
        grid = p.find_next_sibling("div")
        if not grid:
            continue
        d: dict[str, str] = {}
        for row in grid.find_all("div", recursive=False):
            spans = row.find_all("span")
            if len(spans) >= 2:
                d[spans[0].get_text(strip=True)] = spans[1].get_text(strip=True)
        if d:
            data["conducteurs"].append(d)
        break

    # Bloc 2 colonnes véhicule / détails
    for div in soup.find_all("div", style=lambda s: s and "grid-template-columns:1fr 1fr" in (s or "")):
        st = div.get("style", "")
        if "gap:12px" not in st and "gap: 12px" not in st:
            continue
        if "VÉHICULE LOUÉ" not in div.get_text():
            continue
        cols = [c for c in div.find_all("div", recursive=False) if c.get_text(strip=True)]
        if len(cols) < 2:
            continue
        # Colonne 1 : véhicule
        vgrid = cols[0].find("div", style=lambda s: s and "padding:0 4px" in (s or "").replace(" ", ""))
        if vgrid is None:
            vgrid = cols[0].find_all("div")[-1] if cols[0].find_all("div") else cols[0]
        for row in vgrid.find_all("div", recursive=False):
            spans = row.find_all("span")
            if len(spans) >= 2:
                data["vehicule"][spans[0].get_text(strip=True)] = spans[1].get_text(strip=True)

        # Colonne 2 : détails + total
        dcol = cols[1]
        detail_divs = dcol.find_all("div", recursive=False)
        for block in detail_divs:
            if "DÉTAILS DE LA LOCATION" in block.get_text():
                inner = block.find("div", style=lambda s: s and "padding:0 4px" in (s or "").replace(" ", ""))
                if inner:
                    for row in inner.find_all("div", recursive=False):
                        spans = row.find_all("span")
                        if len(spans) >= 2:
                            data["location"][spans[0].get_text(strip=True)] = spans[1].get_text(
                                strip=True
                            )
            if "Montant total de la location" in block.get_text():
                t = block.get_text(" ", strip=True)
                mtot = re.search(r"(\d[\d\s]*)\s*MAD", t)
                if mtot and "Reste" not in block.get_text()[:50]:
                    data["total_mad"] = mtot.group(1).replace(" ", "") + " MAD"
                mrd = re.search(r"Reste dû.*?(\d[\d\s]*)\s*MAD", t)
                if mrd:
                    data["reste_mad"] = mrd.group(1).replace(" ", "") + " MAD"
                mcaut = re.search(r"Caution \(remboursable\).*?(\d[\d\s]*)\s*MAD", t)
                if mcaut:
                    data["caution_mad"] = mcaut.group(1).replace(" ", "") + " MAD"
                mdet = re.search(r"(\d+)\s*jours\s*×\s*(\d+)", t)
                if mdet:
                    data["total_detail"] = f"{mdet.group(1)} jours × {mdet.group(2)} MAD"
        break

    # Conditions — grille 2 colonnes sous CONDITIONS GÉNÉRALES
    for tag in soup.find_all(string=re.compile("CONDITIONS GÉNÉRALES")):
        p = tag.parent
        if not p:
            continue
        grid = p.find_next_sibling("div")
        if not grid:
            continue
        for cell in grid.find_all("div", recursive=False):
            t = cell.get_text(" ", strip=True)
            if t and re.match(r"^\d+\.", t):
                data["conditions"].append(t)
        break

    # Signatures
    for tag in soup.find_all("span", style=lambda s: s and "italic" in (s or "")):
        tx = tag.get_text(strip=True)
        if tx and len(tx) > 2:
            data["sign_locataire"] = tx
            break
    sig_ag = soup.find_all(string=re.compile("Cachet et signature"))
    for s in sig_ag:
        box = s.find_parent("div")
        if box:
            agency = box.get_text("\n", strip=True)
            for ln in agency.split("\n"):
                if ln and "Cachet" not in ln and "Signature" not in ln and len(ln) > 2:
                    data["sign_agency"] = ln
                    break
            break

    foot = soup.find("div", style=lambda s: s and "border-top:1px solid #1a3c6e" in (s or "").replace(" ", ""))
    if foot:
        data["footer"] = foot.get_text(" ", strip=True)

    return data


def build_contract_data_from_invoo(obj: dict[str, Any]) -> dict[str, Any]:
    """
    Mappe un export JSON type INVOORENT vers le dict attendu par draw_contract_pdf.
    Attendu (exemple) :
      { "settings": {...}, "client": {...}, "vehicule": {...}, "reservation": {...} }
    """
    s = obj.get("settings") or {}
    c = obj.get("client") or {}
    v = obj.get("vehicule") or {}
    r = obj.get("reservation") or {}
    rid = str(r.get("id", ""))
    ctr = "CTR-" + rid[-6:].upper() if rid else "CTR-000000"

    def fmt_date(d):
        if not d:
            return "—"
        return str(d)[:10] if len(str(d)) >= 10 else str(d)

    d1, d2 = r.get("debut"), r.get("fin")
    days = r.get("duree_jours")
    if days is None and d1 and d2:
        try:
            from datetime import datetime

            a = datetime.fromisoformat(str(d1)[:10])
            b = datetime.fromisoformat(str(d2)[:10])
            days = max(1, (b - a).days)
        except Exception:
            days = "—"
    tarif = v.get("tarif", "—")
    total = r.get("total", "")
    if total == "" and days and tarif != "—":
        try:
            total = int(days) * float(tarif)
        except Exception:
            total = ""

    cond = s.get("conditions") or ""
    clauses = [ln.strip() for ln in str(cond).split("\n") if ln.strip()][:10]

    paid = 0
    for p in r.get("paiements") or []:
        try:
            paid += float(p.get("montant", 0))
        except Exception:
            pass
    try:
        reste = max(0, float(total or 0) - paid)
    except Exception:
        reste = ""

    data = {
        "agency_name": s.get("nom") or "INVOORENT",
        "slogan": s.get("slogan") or "",
        "contact_line": f"{s.get('ville', '')} — Tél: {s.get('tel', '')}"
        + (f" — {s.get('email')}" if s.get("email") else ""),
        "rc_patente": (f"RC / Patente : {s.get('patente')}" if s.get("patente") else ""),
        "contract_num": ctr,
        "contract_date": __import__("datetime").datetime.now().strftime("%d/%m/%Y"),
        "locataire": {
            "Nom complet": f"{c.get('prenom', '')} {c.get('nom', '')}".strip() or "—",
            "CIN / Passeport": _safe(c.get("cin")),
            "Téléphone": _safe(c.get("tel")),
            "N° Permis de conduire": _safe(c.get("permis")),
            "Email": _safe(c.get("email")),
            "Adresse": _safe(c.get("adresse")),
            "Ville": _safe(c.get("ville")),
            "Nationalité": _safe(c.get("nat")),
        },
        "conducteurs": [],
        "vehicule": {
            "Marque / Modèle": f"{v.get('marque', '')} {v.get('modele', '')}".strip() or "—",
            "Immatriculation": _safe(v.get("immat")),
            "Année": _safe(v.get("annee")),
            "Catégorie": _safe(v.get("cat")),
            "Couleur": _safe(v.get("couleur")),
            "Carburant": _safe(v.get("carburant")),
            "Kilométrage départ": f"{v.get('km'):,} km".replace(",", " ") if v.get("km") else "—",
            "Tarif journalier": f"{tarif} MAD/j" if tarif != "—" else "—",
        },
        "location": {
            "Date de départ": fmt_date(d1),
            "Date de retour prévue": fmt_date(d2),
            "Durée": f"{days} jours" if days != "—" else "—",
            "Lieu de prise en charge": _safe(r.get("lieu")),
            "Caution (remboursable)": f"{int(r.get('caution', 0)):,} MAD".replace(",", " ")
            if r.get("caution")
            else "—",
        },
        "total_mad": f"{int(total):,} MAD".replace(",", " ") if total != "" else "—",
        "total_detail": f"{days} jours × {tarif} MAD" if days != "—" and tarif != "—" else "",
        "caution_mad": f"{int(r.get('caution', 0)):,} MAD".replace(",", " ")
        if r.get("caution")
        else "—",
        "reste_mad": f"{int(reste):,} MAD".replace(",", " ") if reste != "" else "—",
        "conditions": [f"{i + 1}. {cl}" for i, cl in enumerate(clauses)] or ["1. —"],
        "sign_locataire": f"{c.get('prenom', '')} {c.get('nom', '')}".strip(),
        "sign_agency": s.get("nom") or "Agence",
        "footer": s.get("documentFooter") or "",
    }
    sec = c.get("conducteursSecondaires") or []
    if sec and isinstance(sec, list):
        x = sec[0]
        if isinstance(x, dict):
            dt = x.get("docType") or "cin"
            lab = "CIN" if dt == "cin" else "Passeport" if dt == "passeport" else "N° Permis de conduire"
            data["conducteurs"].append(
                {
                    "Nom complet": f"{x.get('prenom', '')} {x.get('nom', '')}".strip() or "—",
                    lab: _safe(x.get("docNum")),
                }
            )
    return data


def draw_contract_pdf(data: dict[str, Any], out_path: Path) -> None:
    """Dessine le PDF sur une seule page A4."""
    w, h = A4
    margin = 10 * mm
    x0, y0 = margin, margin
    cw = w - 2 * margin
    c = canvas.Canvas(str(out_path), pagesize=A4)

    y0 = h - margin

    def draw_section_header(label: str, color=BLUE, font_size: float = 9.5) -> None:
        nonlocal y0
        bh = 5 * mm
        c.setFillColor(color)
        c.roundRect(x0, y0 - bh, cw, bh, 1.5 * mm, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", font_size)
        c.drawString(x0 + 2.5 * mm, y0 - bh + 1.2 * mm, label)
        y0 -= bh + 1.5 * mm

    def row_line(label: str, value: str, line_h: float = 3.2 * mm) -> None:
        nonlocal y0
        bold = label in ("Nom complet", "Téléphone", "Ville", "N° Permis de conduire")
        c.setFont("Helvetica", 8)
        c.setFillColor(TEXT_DIM)
        c.drawString(x0 + 1 * mm, y0 - 2.5 * mm, label[:40])
        c.setFillColor(TEXT_DARK)
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 8)
        c.drawString(x0 + 28 * mm, y0 - 2.5 * mm, value[:55])
        c.setStrokeColor(colors.HexColor("#eeeeee"))
        c.setLineWidth(0.2)
        c.line(x0, y0 - line_h, x0 + cw, y0 - line_h)
        y0 -= line_h

    # --- Header ---
    c.setFillColor(BLUE)
    c.roundRect(x0, y0 - 11 * mm, 11 * mm, 11 * mm, 1.5 * mm, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(x0 + 2.5 * mm, y0 - 7 * mm, "CAR")
    c.setFillColor(BLUE)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(x0 + 13 * mm, y0 - 4 * mm, _safe(data.get("agency_name"))[:32])
    c.setFillColor(TEXT_MED)
    c.setFont("Helvetica", 8)
    c.drawString(x0 + 13 * mm, y0 - 7.5 * mm, _safe(data.get("slogan"))[:48])
    c.setFillColor(TEXT_DIM)
    c.setFont("Helvetica", 7.5)
    c.drawString(x0 + 13 * mm, y0 - 10.5 * mm, _safe(data.get("contact_line"))[:52])
    c.setFillColor(TEXT_LIGHT)
    c.setFont("Helvetica", 7)
    rp = _safe(data.get("rc_patente"))
    if rp:
        c.drawString(x0 + 13 * mm, y0 - 13.5 * mm, rp[:52])

    c.setFillColor(TEXT_DIM)
    c.setFont("Helvetica", 8)
    c.drawRightString(x0 + cw, y0 - 3 * mm, "N° Contrat")
    c.setFillColor(BLUE)
    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(x0 + cw, y0 - 8 * mm, _safe(data.get("contract_num")))
    c.setFillColor(TEXT_MED)
    c.setFont("Helvetica", 8)
    c.drawRightString(x0 + cw, y0 - 11.5 * mm, f"Date : {_safe(data.get('contract_date'))}")

    y0 -= 15 * mm
    c.setStrokeColor(BLUE)
    c.setLineWidth(1.2)
    c.line(x0, y0, x0 + cw, y0)
    y0 -= 3 * mm

    # Titre principal
    th = 6 * mm
    c.setFillColor(BLUE)
    c.roundRect(x0, y0 - th, cw, th, 1 * mm, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(x0 + cw / 2, y0 - th + 1.8 * mm, "CONTRAT DE LOCATION DE VÉHICULE")
    y0 -= th + 2.5 * mm

    # Locataire
    loc = data.get("locataire") or {}
    order = [
        "Nom complet",
        "CIN / Passeport",
        "Téléphone",
        "N° Permis de conduire",
        "Email",
        "Adresse",
        "Ville",
        "Nationalité",
    ]

    def _loc_val(key: str) -> str:
        if key == "N° Permis de conduire":
            return _safe(loc.get(key) or loc.get("N° Permis"))
        return _safe(loc.get(key, "—"))

    pairs = [(k, _loc_val(k)) for k in order]

    draw_section_header("INFORMATIONS DU LOCATAIRE")
    col_w = (cw - 4 * mm) / 2
    half = len(pairs) // 2 + len(pairs) % 2
    left, right = pairs[:half], pairs[half:]
    y_save = y0
    for i, (lab, val) in enumerate(left):
        c.setFont("Helvetica", 8)
        c.setFillColor(TEXT_DIM)
        c.drawString(x0 + 1 * mm, y0 - 2.5 * mm, lab)
        c.setFillColor(BLUE if lab == "Email" else TEXT_DARK)
        c.setFont(
            "Helvetica-Bold"
            if lab in ("Nom complet", "Téléphone", "Ville", "N° Permis de conduire")
            else "Helvetica",
            8,
        )
        c.drawString(x0 + 28 * mm, y0 - 2.5 * mm, val[:40])
        c.setStrokeColor(colors.HexColor("#eeeeee"))
        c.line(x0, y0 - 3.2 * mm, x0 + col_w, y0 - 3.2 * mm)
        y0 -= 3.2 * mm
    y_mid = y0
    y0 = y_save
    mid = x0 + col_w + 4 * mm
    for lab, val in right:
        c.setFont("Helvetica", 8)
        c.setFillColor(TEXT_DIM)
        c.drawString(mid + 1 * mm, y0 - 2.5 * mm, lab)
        c.setFillColor(BLUE if lab == "Email" else TEXT_DARK)
        c.setFont(
            "Helvetica-Bold"
            if lab in ("Nom complet", "Téléphone", "Ville", "N° Permis de conduire")
            else "Helvetica",
            8,
        )
        c.drawString(mid + 28 * mm, y0 - 2.5 * mm, val[:40])
        c.line(mid, y0 - 3.2 * mm, mid + col_w, y0 - 3.2 * mm)
        y0 -= 3.2 * mm
    y0 = min(y_mid, y0) - 2 * mm

    # Conducteurs additionnels
    conds = data.get("conducteurs") or []
    if conds:
        draw_section_header("CONDUCTEUR(S) ADDITIONNEL(S)", BLUE_LIGHT)
        cd = conds[0]
        for lab, val in cd.items():
            row_line(lab, str(val))
        y0 -= 1 * mm

    # Véhicule | Détails (2 colonnes)
    veh_order = [
        "Marque / Modèle",
        "Immatriculation",
        "Année",
        "Catégorie",
        "Couleur",
        "Carburant",
        "Kilométrage départ",
        "Tarif journalier",
    ]
    loc_b = data.get("location") or {}
    det_order = [
        "Date de départ",
        "Date de retour prévue",
        "Durée",
        "Lieu de prise en charge",
        "Caution (remboursable)",
    ]
    veh = data.get("vehicule") or {}

    def _veh_field(key: str) -> str:
        if key == "Kilométrage départ":
            return _safe(veh.get(key) or veh.get("Km départ"))
        return _safe(veh.get(key))

    def _loc_detail_field(key: str) -> str:
        if key == "Date de retour prévue":
            return _safe(loc_b.get(key) or loc_b.get("Date de retour"))
        if key == "Lieu de prise en charge":
            return _safe(loc_b.get(key) or loc_b.get("Lieu de prise"))
        if key == "Caution (remboursable)":
            return _safe(loc_b.get(key) or loc_b.get("Caution"))
        return _safe(loc_b.get(key))

    left_rows = [(k, _veh_field(k)) for k in veh_order]
    right_rows = [(k, _loc_detail_field(k)) for k in det_order]

    col_w = (cw - 3 * mm) / 2
    mid = x0 + col_w + 3 * mm

    c.setFillColor(BLUE)
    bh = 5 * mm
    c.roundRect(x0, y0 - bh, col_w, bh, 1.5 * mm, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x0 + 2 * mm, y0 - bh + 1.2 * mm, "VÉHICULE LOUÉ")
    c.setFillColor(BLUE)
    c.roundRect(mid, y0 - bh, col_w, bh, 1.5 * mm, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.drawString(mid + 2 * mm, y0 - bh + 1.2 * mm, "DÉTAILS DE LA LOCATION")
    y0 -= bh + 1.5 * mm

    y_block = y0
    y_l = y0
    for lab, val in left_rows:
        c.setFont("Helvetica", 8)
        c.setFillColor(TEXT_DIM)
        c.drawString(x0 + 1 * mm, y_l - 2.5 * mm, lab[:20])
        c.setFillColor(BLUE if "Tarif" in lab else TEXT_DARK)
        c.setFont(
            "Helvetica-Bold"
            if "Marque" in lab
            or "Immat" in lab
            or "Km" in lab
            or "Kilométrage" in lab
            or "Tarif" in lab
            else "Helvetica",
            8,
        )
        c.drawString(x0 + 24 * mm, y_l - 2.5 * mm, str(val)[:26])
        c.setStrokeColor(colors.HexColor("#eeeeee"))
        c.line(x0, y_l - 3.2 * mm, x0 + col_w, y_l - 3.2 * mm)
        y_l -= 3.2 * mm
    y_r = y_block
    for lab, val in right_rows:
        c.setFont("Helvetica", 8)
        c.setFillColor(TEXT_DIM)
        c.drawString(mid + 1 * mm, y_r - 2.5 * mm, lab[:20])
        c.setFillColor(BLUE if "Caution" in lab or "caution" in lab.lower() else TEXT_DARK)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(mid + 24 * mm, y_r - 2.5 * mm, str(val)[:26])
        c.line(mid, y_r - 3.2 * mm, mid + col_w, y_r - 3.2 * mm)
        y_r -= 3.2 * mm
    y0 = min(y_l, y_r) - 2 * mm

    # Bloc total (colonne droite alignée — largeur demi-page à droite)
    box_w = col_w
    box_x = mid
    box_h = 28 * mm
    c.setFillColor(BLUE)
    c.roundRect(box_x, y0 - box_h, box_w, box_h, 1.2 * mm, stroke=0, fill=1)
    c.setFillColor(BLUE_MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(box_x + 3 * mm, y0 - 5 * mm, "Montant total de la location")
    c.setFont("Helvetica", 8)
    c.drawString(box_x + 3 * mm, y0 - 8 * mm, _safe(data.get("total_detail"))[:36])
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(box_x + box_w - 3 * mm, y0 - 13 * mm, _safe(data.get("total_mad")))
    c.setStrokeColor(BLUE_LINE)
    c.line(box_x + 3 * mm, y0 - 15 * mm, box_x + box_w - 3 * mm, y0 - 15 * mm)
    c.setFillColor(BLUE_MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(box_x + 3 * mm, y0 - 18 * mm, "Caution (remboursable)")
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(box_x + box_w - 3 * mm, y0 - 18 * mm, _safe(data.get("caution_mad")))
    c.setFillColor(BLUE_MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(box_x + 3 * mm, y0 - 22 * mm, "Reste dû")
    c.setFillColor(ORANGE_RESTE)
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(box_x + box_w - 3 * mm, y0 - 22 * mm, _safe(data.get("reste_mad")))
    y0 -= box_h + 3 * mm

    # Conditions — 2 colonnes compact
    draw_section_header("CONDITIONS GÉNÉRALES")
    cond_list = data.get("conditions") or ["1. —"]
    mid_c = x0 + cw / 2
    n = len(cond_list)
    half_c = (n + 1) // 2
    col1, col2 = cond_list[:half_c], cond_list[half_c:]
    y_c = y0
    row_h = 3 * mm
    max_rows = max(len(col1), len(col2))
    for i in range(max_rows):
        if i < len(col1):
            c.setFont("Helvetica", 8)
            c.setFillColor(BLUE)
            c.drawString(x0 + 1 * mm, y_c - 2.5 * mm, col1[i][:3])
            c.setFillColor(TEXT_DARK)
            c.drawString(x0 + 5 * mm, y_c - 2.5 * mm, col1[i][3:][:42])
        if i < len(col2):
            c.setFillColor(BLUE)
            c.drawString(mid_c + 1 * mm, y_c - 2.5 * mm, col2[i][:3])
            c.setFillColor(TEXT_DARK)
            c.drawString(mid_c + 5 * mm, y_c - 2.5 * mm, col2[i][3:][:42])
        c.setStrokeColor(colors.HexColor("#f0f0f0"))
        c.line(x0, y_c - row_h, x0 + cw, y_c - row_h)
        y_c -= row_h
    y0 = y_c - 2 * mm

    # Signatures
    sig_w = (cw - 4 * mm) / 2
    sh = 22 * mm
    c.setStrokeColor(colors.HexColor("#dddddd"))
    c.setLineWidth(0.5)
    c.roundRect(x0, y0 - sh, sig_w, sh, 1 * mm, stroke=1, fill=0)
    c.roundRect(x0 + sig_w + 4 * mm, y0 - sh, sig_w, sh, 1 * mm, stroke=1, fill=0)
    c.setFillColor(TEXT_DIM)
    c.setFont("Helvetica", 8)
    c.drawString(x0 + 3 * mm, y0 - 4 * mm, "Signature du locataire")
    c.drawString(x0 + sig_w + 7 * mm, y0 - 4 * mm, "Cachet et signature de l'agence")
    c.setStrokeColor(colors.HexColor("#aaaaaa"))
    c.line(x0 + 3 * mm, y0 - 14 * mm, x0 + sig_w - 3 * mm, y0 - 14 * mm)
    c.line(x0 + sig_w + 7 * mm, y0 - 14 * mm, x0 + cw - 3 * mm, y0 - 14 * mm)
    c.setFillColor(BLUE)
    c.setFont("Helvetica-Oblique", 11)
    c.drawString(x0 + 3 * mm, y0 - 12 * mm, _safe(data.get("sign_locataire"))[:28])
    c.setFont("Helvetica", 8)
    c.setFillColor(TEXT_MED)
    c.drawString(x0 + 3 * mm, y0 - 18 * mm, _safe(data.get("sign_locataire"))[:32])
    c.setFillColor(BLUE)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(x0 + sig_w + 4 * mm + sig_w / 2, y0 - 10 * mm, "AGENCE")
    c.setFillColor(TEXT_MED)
    c.setFont("Helvetica", 8)
    c.drawCentredString(
        x0 + sig_w + 4 * mm + sig_w / 2, y0 - 18 * mm, _safe(data.get("sign_agency"))[:24]
    )
    y0 -= sh + 3 * mm

    # Footer
    c.setStrokeColor(BLUE)
    c.setLineWidth(0.5)
    c.line(x0, y0, x0 + cw, y0)
    y0 -= 4 * mm
    c.setFillColor(TEXT_LIGHT)
    c.setFont("Helvetica", 7.5)
    ft = _safe(data.get("footer"))
    if not ft:
        ft = f"{_safe(data.get('agency_name'))} | {_safe(data.get('contact_line'))} | {_safe(data.get('rc_patente'))}"
    for i, line in enumerate(split_footer(ft, c, cw - 4 * mm, "Helvetica", 7.5)):
        c.drawCentredString(x0 + cw / 2, y0 - i * 3.2 * mm, line)

    c.showPage()
    c.save()


def split_footer(text: str, canv: canvas.Canvas, max_w: float, font: str, size: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        test = (cur + " " + w).strip()
        if canv.stringWidth(test, font, size) <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines[:3]


def main() -> int:
    ap = argparse.ArgumentParser(description="Contrat location → PDF (ReportLab), design HTML #1a3c6e")
    ap.add_argument("input", nargs="?", help="Fichier HTML contrat_location_*.html")
    ap.add_argument("-o", "--output", help="Fichier PDF de sortie")
    ap.add_argument("--json", type=Path, help="Données INVOORENT (JSON) au lieu du HTML")
    args = ap.parse_args()

    if args.json:
        obj = json.loads(args.json.read_text(encoding="utf-8"))
        data = build_contract_data_from_invoo(obj)
    else:
        if not args.input:
            ap.print_help()
            return 1
        html_path = Path(args.input)
        if not html_path.is_file():
            print("Fichier introuvable:", html_path, file=sys.stderr)
            return 1
        data = parse_contract_html(html_path)

    out = Path(args.output) if args.output else Path(f"contrat_{data.get('contract_num', 'export')}.pdf")
    draw_contract_pdf(data, out)
    print("PDF écrit:", out.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
