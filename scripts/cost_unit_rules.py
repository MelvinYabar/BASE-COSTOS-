"""Reglas conservadoras para unidades vendibles explícitas en facturas."""

import re
import unicodedata


DISCRETE = re.compile(
    r"(?:\bX|\*)\s*(\d{1,4})\s*"
    r"(?:TAB(?:S|LETAS?)?|COMP(?:S|RIMIDOS?)?|CAP(?:S|SULAS?)?|"
    r"AMP(?:OLLAS?)?|OVU(?:LOS?)?|SOB(?:RES?)?|SCH|SACH(?:ETS?)?|"
    r"PARES?|JER(?:INGAS?)?|UND|UNID(?:ADES?)?|VIAL(?:ES)?|PARCHES?|OCU)\b",
    re.I,
)
VOLUME = re.compile(r"(?:\bX|\*)\s*\d{1,4}(?:[.,]\d+)?\s*(?:ML|CC|GRS?|G|KG|DOSIS)\b", re.I)
CONTAINER = re.compile(
    r"\b(?:FRASCO|FCO|JBE|JARABE|GOTAS?|GOTERO|TUBO|CREMA|"
    r"UNG(?:UENTO)?|POTE|LOC(?:ION)?|SPRAY|INH(?:ALADOR)?|PULV(?:ER)?|"
    r"SUSP(?:ENSION)?|GEL|DOSIS)\b|\bSOL\s+(?:ORAL|OFT)",
    re.I,
)
BARE_DISCRETE = re.compile(r"\b(\d{1,4})\s*(?:SOBRES?|SACHETS?|AMPOLLAS?|VIALES?|OCU)\b", re.I)
REVERSED_DISCRETE = re.compile(
    r"\b(?:TAB(?:S|LETAS?)?|COMP(?:S|RIMIDOS?)?|CAP(?:S|SULAS?)?|"
    r"AMP(?:OLLAS?)?|OVU(?:LOS?)?|SOB(?:RES?)?|SCH|SACH(?:ETS?)?|"
    r"JER(?:INGAS?)?|VIAL(?:ES)?)\s+X\s*(\d{1,4})\b", re.I,
)


def explicit_pack(description):
    """Devuelve (unidades, evidencia) solo si la presentación es inequívoca."""
    text = "".join(
        char for char in unicodedata.normalize("NFKD", str(description or "").upper())
        if not unicodedata.combining(char)
    )
    counts = {int(match.group(1)) for pattern in (DISCRETE, REVERSED_DISCRETE)
              for match in pattern.finditer(text) if int(match.group(1)) > 0}
    if len(counts) == 1:
        return counts.pop(), "cantidad discreta impresa en la factura"
    if counts:
        return None, "varias cantidades discretas en la factura"
    bare_counts = {int(match.group(1)) for match in BARE_DISCRETE.finditer(text) if int(match.group(1)) > 0}
    if len(bare_counts) == 1:
        return bare_counts.pop(), "cantidad discreta impresa en la factura"
    if bare_counts:
        return None, "varias cantidades discretas en la factura"
    if VOLUME.search(text) and CONTAINER.search(text):
        return 1, "envase completo: volumen, peso o dosis"
    return None, "sin cantidad inequívoca"


def presentation_family(description):
    """Forma farmacéutica cuando el texto la indica sin ambigüedad."""
    text = "".join(
        char for char in unicodedata.normalize("NFKD", str(description or "").upper())
        if not unicodedata.combining(char)
    )
    if re.search(r"\b(?:TAB(?:LETAS?)?|COMP(?:RIMIDOS?)?|CAP(?:SULAS?)?|OVU(?:LOS?)?|GRAGEAS?)\b", text):
        return "sólido"
    if re.search(r"\b(?:OCUVIAL(?:ES)?|OCU|SOL\s+OFT|OFTALMICA)\b", text):
        return "oftálmico"
    if re.search(r"\b(?:INY(?:ECTABLE)?|INYECCION|VIAL(?:ES)?|AMP(?:OLLAS?)?)\b", text) and not re.search(r"AMPOLLA\s+BEBIBLE|SUSP\s+ORAL", text):
        return "inyectable"
    if re.search(r"\b(?:CREMA|GEL|UNG(?:UENTO)?|POMADA|TUBO|LOC(?:ION)?|CUTANEA)\b", text):
        return "tópico"
    if re.search(r"\b(?:JBE|JARABE|GOTAS?|GOTERO|SPRAY|INH(?:ALADOR)?|PULV(?:ER)?|DOSIS|SUSP(?:ENSION)?)\b|\bSOL\s+ORAL|\b(?:FRASCO|FCO)\b.{0,12}\b\d+(?:[.,]\d+)?\s*ML\b", text):
        return "líquido"
    if re.search(r"\b(?:GUANTES?|CATETER|JERINGAS?|AGUJAS?|GASA|CANULA|MASCARA|HISOPO)\b", text):
        return "accesorio"
    return ""


def strong_form_conflict(invoice_description, catalog_name):
    """Solo bloquea cruces sólidos frente a formas claramente no sólidas."""
    invoice_form = presentation_family(invoice_description)
    catalog_form = presentation_family(catalog_name)
    non_solid = {"líquido", "oftálmico", "inyectable", "tópico"}
    return (invoice_form == "sólido" and catalog_form in non_solid) or (
        catalog_form == "sólido" and invoice_form in non_solid
    )
