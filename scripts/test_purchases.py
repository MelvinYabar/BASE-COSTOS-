import json
import unittest
from pathlib import Path

import scripts.prepare_purchases as purchases


class PurchasePreparationTests(unittest.TestCase):
    def test_provider_rules_are_explicit(self):
        self.assertEqual(purchases.provider_name("DIST. DROGUERIA ALFARO S.A.C."), "ALFARO")
        self.assertEqual(purchases.provider_name("FP MAYORISTA S.A.C."), "FP MAYORISTA (QUIMICA SUIZA)")
        self.assertNotEqual(purchases.provider_name("HNOS. DIAZ & ASOCIADOS S.A.C."), "EBENEL")

    def test_names_preserve_strength_and_pack(self):
        self.assertEqual(purchases.pack_count("KEPPRA 500MG CAJA X 30 TAB"), 30)
        self.assertIsNone(purchases.pack_count("GOTAS X 10 ML"))
        self.assertEqual(purchases.strengths("JARDIANCE DUO 12.5mg/850mg x 60"), {"12.5MG", "850MG"})

    def test_generated_payload_reconciles_and_excludes_sensitive_fields(self):
        payload = json.loads((Path(__file__).resolve().parents[1] / "dist" / "purchases.json").read_text(encoding="utf-8"))
        self.assertEqual(payload["meta"]["detailRows"], len(payload["rows"]))
        self.assertEqual(payload["meta"]["registerRows"], len(payload["register"]))
        self.assertEqual(payload["meta"]["uniqueMappings"], len(payload["mappings"]))
        self.assertEqual(sum(payload["meta"]["mappingCounts"].values()), len(payload["mappings"]))
        forbidden = {"contacto", "telefono", "teléfono", "cuenta", "yape", "contrasena", "contraseña"}
        keys = set()

        def collect(value):
            if isinstance(value, dict):
                keys.update(str(key).lower() for key in value)
                for child in value.values():
                    collect(child)
            elif isinstance(value, list):
                for child in value:
                    collect(child)

        collect(payload)
        self.assertFalse(keys & forbidden)


if __name__ == "__main__":
    unittest.main()
