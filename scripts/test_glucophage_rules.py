import json
import unittest
from pathlib import Path

from glucophage_rules import is_bonus, sku_key


SITE = Path(__file__).resolve().parents[1]


class GlucophageRulesTest(unittest.TestCase):
    def test_regular_and_xr_remain_distinct(self):
        self.assertEqual(sku_key("FDS", "GLUCOPHAGE 1000 MG CAJA X 30 COMP"), "regular_1000")
        self.assertEqual(sku_key("FDS", "GLUCOPHAGE XR 1000 CJA X 30 COMP"), "xr_1000")
        self.assertEqual(sku_key("DIMEXA", "GLUCOPHAGE XR 1000"), "")
        self.assertTrue(is_bonus("BONI GLUCOPHAGE XR 1000 CJA X 30"))

    def test_published_promotion_uses_paid_reference(self):
        data = json.loads((SITE / "dist" / "fds-glucophage.json").read_text(encoding="utf-8"))
        by_key = {row["key"]: row for row in data["skus"]}
        self.assertEqual(len(by_key), 7)
        self.assertEqual(by_key["xr_1000"]["gtin"], "7891721029189")
        self.assertEqual(by_key["xr_1000"]["paidBoxCost"], 84.68)
        self.assertEqual(by_key["xr_1000"]["invoice"], "F002-00073244")
        self.assertEqual(by_key["xr_500"]["invoice"], "F002-00081036")
        october = next(row for row in data["observations"] if row["invoice"] == "F002-00081036")
        self.assertEqual((october["paidBoxes"], october["bonusBoxes"]), (24, 8))

    def test_cost_base_separates_regular_xr_and_bonus(self):
        costs = json.loads((SITE / "dist" / "costs.json").read_text(encoding="utf-8"))
        detail = {row["n"]: row for row in costs["detail"]}
        self.assertEqual(detail[2248]["gtin"], "4054839427169")
        self.assertEqual(detail[2251]["gtin"], "7891721029189")
        self.assertEqual(detail[3719]["gtin"], "7891721029189")
        self.assertLess(detail[3719]["invoiceAmount"], .10)
        xr1000 = next(row for row in costs["base"] if row["provider"] == "FDS" and row["gtin"] == "7891721029189")
        self.assertEqual(xr1000["unitsPurchased"], 1440)
        self.assertAlmostEqual(xr1000["costs"][-1]["value"], 84.68 / 30, places=4)


if __name__ == "__main__":
    unittest.main()
