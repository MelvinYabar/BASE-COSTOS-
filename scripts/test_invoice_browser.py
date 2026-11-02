import importlib.util
import unittest
from pathlib import Path


SPEC = importlib.util.spec_from_file_location(
    "invoice_browser", Path(__file__).with_name("prepare_invoice_browser.py")
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class InvoiceBrowserLogicTest(unittest.TestCase):
    def test_document_numbers_match_pdf_keys(self):
        self.assertEqual(MODULE.normalize_document("F100-000879558"), "F100-879558")
        self.assertEqual(MODULE.normalize_document("factura f001_00001234.pdf"), "F001-1234")
        self.assertEqual(MODULE.normalize_document("SU F002-266 10.07.26.pdf"), "F002-266")

    def test_discrete_presentations_are_split(self):
        self.assertEqual(MODULE.units_per_package("Jardiance Duo x 60 Comp")[0], 60)
        self.assertEqual(MODULE.units_per_package("XUMER 120MG X7COMP")[0], 7)
        self.assertEqual(MODULE.units_per_package("GRAVERGOL TAB CJA X 100")[0], 100)

    def test_volume_weight_and_doses_remain_whole(self):
        self.assertEqual(MODULE.units_per_package("Jarabe x 120 ML")[0], 1)
        self.assertEqual(MODULE.units_per_package("Crema x 50 GR")[0], 1)
        self.assertEqual(MODULE.units_per_package("Seretide x 120 DOSIS")[0], 1)

    def test_unclear_presentations_stay_pending(self):
        self.assertIsNone(MODULE.units_per_package("MEDICORT 4MG/2ML INY CJA X10")[0])


if __name__ == "__main__":
    unittest.main()
