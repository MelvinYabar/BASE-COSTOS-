import json
import unittest
from pathlib import Path


DATA = Path(__file__).resolve().parents[1] / "dist" / "data.json"


class PriceMonthIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payload = json.loads(DATA.read_text(encoding="utf-8"))

    def test_global_price_filter_reaches_latest_invoice_month(self):
        self.assertEqual(
            self.payload["meta"]["months"],
            ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"],
        )
        self.assertEqual(self.payload["meta"]["effectiveThrough"], "2026-11-10")

    def test_september_and_october_have_price_rows(self):
        counts = {month: 0 for month in self.payload["meta"]["months"]}
        for row in self.payload["rows"]:
            month = row.get("date", "")[:7]
            if month in counts:
                counts[month] += 1
        self.assertGreater(counts["2026-09"], 0)
        self.assertGreater(counts["2026-10"], 0)


if __name__ == "__main__":
    unittest.main()
