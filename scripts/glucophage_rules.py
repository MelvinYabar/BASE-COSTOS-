"""Identificación conservadora de las presentaciones Glucophage de FDS."""

import json
import re
from pathlib import Path


RULES = json.loads((Path(__file__).resolve().parents[1] / "data" / "fds_glucophage_promo.json").read_text(encoding="utf-8"))
SKU_BY_KEY = {item["key"]: item for item in RULES["skus"]}


def sku_key(provider, description):
    if provider.upper() != "FDS":
        return ""
    text = str(description or "").upper()
    match = re.search(r"\bGLUCOPHAGE\s+(XR\s+)?(500|750|850|1000)\b", text)
    if not match:
        return ""
    key = ("xr_" if match.group(1) else "regular_") + match.group(2)
    return key if key in SKU_BY_KEY else ""


def is_bonus(description):
    return bool(re.search(r"\bBONI(?:FICACION)?\b", str(description or "").upper()))
