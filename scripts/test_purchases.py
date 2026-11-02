import json
import unittest
from pathlib import Path

import scripts.prepare_purchases as purchases
import scripts.prepare_data as historical


class PurchasePreparationTests(unittest.TestCase):
    def test_historical_bonuses_include_boni_zero_and_full_discount(self):
        self.assertTrue(historical.is_bonus({"descripcion": "MEDICAMENTO BONI", "nota": ""}))
        self.assertTrue(historical.is_bonus({"descripcion": "MEDICAMENTO", "nota": "", "importe": "0.00"}))
        self.assertTrue(historical.is_bonus({"descripcion": "MEDICAMENTO", "nota": "", "dcto1": "100"}))
        self.assertFalse(historical.is_bonus({"descripcion": "MEDICAMENTO", "nota": "", "importe": "10.00", "dcto1": "20"}))

    def test_provider_rules_are_explicit(self):
        self.assertEqual(purchases.provider_name("DIST. DROGUERIA ALFARO S.A.C."), "ALFARO")
        self.assertEqual(purchases.provider_name("FP MAYORISTA S.A.C."), "FP MAYORISTA (QUIMICA SUIZA)")
        self.assertNotEqual(purchases.provider_name("HNOS. DIAZ & ASOCIADOS S.A.C."), "EBENEL")

    def test_names_preserve_strength_and_pack(self):
        self.assertEqual(purchases.pack_count("KEPPRA 500MG CAJA X 30 TAB"), 30)
        self.assertIsNone(purchases.pack_count("GOTAS X 10 ML"))
        self.assertEqual(purchases.strengths("JARDIANCE DUO 12.5mg/850mg x 60"), {"12.5MG", "850MG"})

    def test_generated_payload_reconciles_and_excludes_sensitive_fields(self):
        project = Path(__file__).resolve().parents[1]
        payload = json.loads((project / "dist" / "purchases.json").read_text(encoding="utf-8"))
        central = json.loads((project / "data" / "purchase_associations.json").read_text(encoding="utf-8"))
        self.assertEqual(payload["meta"]["detailRows"], len(payload["rows"]))
        self.assertEqual(payload["meta"]["registerRows"], len(payload["register"]))
        self.assertEqual(payload["meta"]["uniqueMappings"], len(payload["mappings"]))
        self.assertEqual(payload["meta"]["catalogTargets"], len(payload["catalog"]))
        self.assertEqual(payload["meta"]["productMasterRows"], 2185)
        self.assertEqual(len({item["gtin"] for item in payload["catalog"]}), len(payload["catalog"]))
        self.assertTrue(all(item["gtin"] and item["systemName"] for item in payload["catalog"]))
        by_gtin = {item["gtin"]: item for item in payload["catalog"]}
        self.assertEqual(by_gtin["7751859000446"]["systemName"], "ZETALER 5 MG/5 ML (CETIRIZINA) X FRASCO 60 ML")
        self.assertEqual(by_gtin["7406048002069"]["systemName"], "LATIXA 500 MG (RANOLAZINA) CAJA COMP")
        self.assertEqual(sum(payload["meta"]["mappingCounts"].values()), len(payload["mappings"]))
        self.assertEqual(payload["meta"]["centralAssociations"], len(central["associations"]))
        self.assertEqual(payload["meta"]["centralRejected"], len(central["rejected"]))
        self.assertEqual(sum(item.get("method") == "manual_central" for item in payload["mappings"]), len(central["associations"]))
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
