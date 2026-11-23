"""Reconcile the published valuation with the OKFAC stock and sales controls."""

import json
import unittest
from decimal import Decimal

from openpyxl import load_workbook

from prepare_stock_cover import PRODUCTS, code, quantity
from prepare_stock_valuation import OUTPUT, money, rotation


class StockValuationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(OUTPUT.read_text(encoding="utf-8"))
        cls.by_code = {item["code"]: item for item in cls.data["products"]}

    def test_categories_cover_every_active_gtin_once(self):
        items = self.data["products"]
        self.assertEqual(len(items), self.data["meta"]["activeProducts"])
        self.assertEqual(len(self.by_code), len(items))
        self.assertEqual(sum(c["products"] for c in self.data["categories"]), len(items))
        self.assertEqual(money(sum(Decimal(str(c["value"])) for c in self.data["categories"])),
                         self.data["meta"]["totalValue"])
        self.assertEqual({c["name"] for c in self.data["categories"]},
                         {"Crónicos", "Alta rotación", "Media rotación", "Baja rotación", "Muy baja o nula rotación"})

    def test_stock_and_cost_reconcile_to_master(self):
        book = load_workbook(PRODUCTS, read_only=True, data_only=True)
        active = {code(row[1]): row for row in book.active.iter_rows(min_row=7, values_only=True)
                  if row[20] == "Activo"}
        book.close()
        self.assertEqual(set(active), set(self.by_code))
        for item_code, item in self.by_code.items():
            row = active[item_code]
            self.assertEqual(item["stock"], row[17])
            self.assertEqual(item["cost"], quantity(row[12]))
            if item["stock"] >= 0 and item["cost"] is not None and item["cost"] > 0:
                self.assertEqual(item["value"], money(Decimal(str(row[17])) * Decimal(str(item["cost"]))))

    def test_missing_cost_and_negative_stock_are_not_zero_valuations(self):
        items = self.data["products"]
        self.assertTrue(all(item["value"] is None for item in items
                            if item["valuationStatus"] in ("Costo faltante", "Stock negativo")))
        self.assertEqual(sum(item["valuationStatus"] == "Costo faltante" for item in items),
                         self.data["meta"]["missingCostProducts"])
        self.assertEqual(sum(item["valuationStatus"] == "Stock negativo" for item in items),
                         self.data["meta"]["negativeStockProducts"])

    def test_chronic_override_and_dose_separation(self):
        self.assertEqual(self.by_code["4048846019820"]["category"], "Crónicos")
        self.assertEqual(self.by_code["4048846013071"]["category"], "Crónicos")
        self.assertEqual(self.by_code["8002660032591"]["category"], "Crónicos")
        self.assertEqual(self.by_code["8002660032607"]["category"], "Crónicos")
        self.assertEqual(self.data["meta"]["chronicPdfEntries"], 110)
        self.assertEqual(self.data["meta"]["chronicPdfUnmatchedRows"], len(self.data["chronicUnmatched"]))

    def test_rotation_thresholds(self):
        self.assertEqual(rotation(90, False), "Alta rotación")
        self.assertEqual(rotation(89, False), "Media rotación")
        self.assertEqual(rotation(30, False), "Media rotación")
        self.assertEqual(rotation(9, False), "Baja rotación")
        self.assertEqual(rotation(8, False), "Muy baja o nula rotación")
        self.assertEqual(rotation(0, True), "Crónicos")

    def test_sales_report_reconciles_with_printed_totals(self):
        self.assertEqual(self.data["meta"]["salesReportControl"]["quantity"], 844399)
        self.assertEqual(self.data["meta"]["salesReportControl"]["amount"], 2954968.11)


if __name__ == "__main__":
    unittest.main()
