import unittest

from cost_unit_rules import explicit_pack, strong_form_conflict
from prepare_costs import row_factor


class CostUnitRulesTest(unittest.TestCase):
    def test_whole_containers(self):
        for name in ("JARABE FRASCO X 120 ML", "CREMA TUBO X 30 GR", "INHALADOR X 200 DOSIS"):
            with self.subTest(name=name):
                self.assertEqual(explicit_pack(name)[0], 1)

    def test_discrete_units(self):
        self.assertEqual(explicit_pack("JARDIANCE DUO FRASCO X 60 COMP")[0], 60)
        self.assertEqual(explicit_pack("DEBLAX CAJA CAPS X 2")[0], 2)
        self.assertEqual(explicit_pack("SOBRES X 20 SOB")[0], 20)
        self.assertEqual(explicit_pack("EUROPRES-D 160/12.5 COMPX30")[0], 30)
        self.assertIsNone(explicit_pack("VIAL X 10 ML X 1")[0])
        self.assertIsNone(explicit_pack("SOBRE X 10 ML")[0])

    def test_ambiguous_pack(self):
        self.assertIsNone(explicit_pack("CAJA X 10 TAB X 20 TAB")[0])

    def test_strong_form_conflict(self):
        self.assertTrue(strong_form_conflict("DEGRALER GOTAS X 15 ML", "DEGRALER X 10 TAB"))
        self.assertFalse(strong_form_conflict("DEGRALER X 10 TAB", "DEGRALER X 20 TAB"))

    def test_igv_exceptions(self):
        self.assertEqual(row_factor({"provider": "DIMEXA", "tax": "+18%", "description": "MEDICAMENTO S/IGV"}), 1)
        self.assertEqual(row_factor({"provider": "EBENEL", "description": "MEDICAMENTO"}), 1)
        self.assertEqual(row_factor({"provider": "DIMEXA", "description": "MEDICAMENTO"}), 1.18)


if __name__ == "__main__":
    unittest.main()
