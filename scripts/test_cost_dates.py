import json
import unittest
from datetime import date
from pathlib import Path


DATA = Path(__file__).resolve().parents[1] / "dist" / "costs.json"
MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]


class CostDateIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payload = json.loads(DATA.read_text(encoding="utf-8"))

    def test_published_months_stop_at_real_invoice_cutoff(self):
        cutoff = date.fromisoformat(self.payload["meta"]["effectiveThrough"])
        self.assertEqual(self.payload["meta"]["months"], MONTHS[4:cutoff.month])
        self.assertNotIn("Noviembre", self.payload["meta"]["months"])
        self.assertNotIn("Diciembre", self.payload["meta"]["months"])

    def test_september_and_october_are_populated(self):
        counts = {}
        for row in self.payload["detail"]:
            counts[row["month"]] = counts.get(row["month"], 0) + 1
        self.assertGreater(counts.get("Septiembre", 0), 0)
        self.assertGreater(counts.get("Octubre", 0), 0)

    def test_known_fds_rows_use_real_july_and_august_dates(self):
        expected = {
            "F002-00073243": "Agosto",
            "F002-00073923": "Agosto",
            "F007-00021297": "Julio",
        }
        for invoice, month in expected.items():
            rows = [row for row in self.payload["detail"] if row["invoice"] == invoice]
            self.assertTrue(rows, invoice)
            self.assertEqual({row["month"] for row in rows}, {month})

    def test_base_has_observed_costs_in_both_new_months(self):
        month_index = {month: index for index, month in enumerate(self.payload["meta"]["months"])}
        for month in ("Septiembre", "Octubre"):
            observed = [
                row for row in self.payload["base"]
                if row["costs"][month_index[month]]["value"] is not None
                and not row["costs"][month_index[month]]["carried"]
            ]
            self.assertGreater(len(observed), 0, month)


if __name__ == "__main__":
    unittest.main()
