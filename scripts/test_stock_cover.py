"""Conciliación puntual de la cobertura publicada con los reportes originales."""

import json
import unittest
from datetime import datetime

from openpyxl import load_workbook

from prepare_stock_cover import PRODUCTS, SALES, OUTPUT, code, quantity, price_levels_need_review, suggested_order, exact_name_matches, name_key


class StockCoverTest(unittest.TestCase):
    def test_exact_name_requires_unique_active_and_observed_code(self):
        active = {'123': {'code': '123', 'name': 'JARDIANCE (X 60)'}}
        rows = [(None, '18/11/2026', '123', None, 'JARDIANCE (X 60)', 'Producto'),
                (None, '17/11/2026', None, None, 'JARDIANCE (X 60)', 'N/A')]
        snapshot = datetime(2026, 11, 19).date()
        self.assertEqual(exact_name_matches(active, rows, snapshot), {'JARDIANCE(X60)': '123'})
        self.assertEqual(exact_name_matches({**active, '456': {'code': '456', 'name': 'JARDIANCE (X 60)'}}, rows, snapshot), {})
        self.assertEqual(exact_name_matches(active, [rows[0], (None, '18/11/2026', '456', None, 'JARDIANCE(X60)', 'Producto')], snapshot), {})

    def test_jardiance_uncoded_sales_are_included_once(self):
        data = json.loads(OUTPUT.read_text(encoding='utf-8'))
        item = next(p for p in data['products'] if p['code'] == '4048846019820')
        self.assertEqual(item['matchedByNameHistory'], 600)
        self.assertEqual(item['matchedByName30'], 240)
        self.assertEqual(item['sold30'], 3180)
        self.assertEqual(item['suggestedOrder15'], 270)

    def test_order_suggestion_uses_30_day_rate_and_rounds_up(self):
        self.assertEqual(suggested_order(630, 3900, False), 1320)
        self.assertEqual(suggested_order(10, 21, False), 1)
        self.assertEqual(suggested_order(11, 21, False), 0)
        self.assertEqual(suggested_order(0, 0, False), None)
        self.assertEqual(suggested_order(-2, 10, False), None)
        self.assertEqual(suggested_order(0, 10, True), None)

    def test_mixed_price_levels_hold_ambiguous_coverage(self):
        self.assertTrue(price_levels_need_review([1.6, 1.6, 126.75, 126.75]))
        self.assertFalse(price_levels_need_review([1.6, 1.6, 2.1, 2.1]))
        data = json.loads(OUTPUT.read_text(encoding="utf-8"))
        trayenta = next(p for p in data["products"] if p["code"] == "4048846020178")
        self.assertEqual(trayenta["cover30"], round(trayenta["stock"] * 30 / trayenta["sold30"], 2))
        self.assertTrue(trayenta["reviewUnit90"])
        self.assertIsNone(trayenta["cover90"])

    def test_code_and_formatted_quantity(self):
        self.assertEqual(code(300651510454), "300651510454")
        self.assertEqual(quantity("1,020.00"), 1020)

    def test_xr1000_reconciles_with_source_rows(self):
        data = json.loads(OUTPUT.read_text(encoding="utf-8"))
        code_xr = "7891721029189"
        published = next(p for p in data["products"] if p["code"] == code_xr)
        book = load_workbook(PRODUCTS, read_only=True, data_only=True)
        active = [r for r in book.active.iter_rows(min_row=7, values_only=True)
                  if code(r[1]) == code_xr and r[20] == "Activo"]
        book.close()
        self.assertEqual(len(active), 1)
        self.assertEqual(published["stock"], active[0][17])
        snapshot = datetime.fromisoformat(data["meta"]["snapshot"]).date()
        start30 = datetime.fromisoformat(data["meta"]["start30"]).date()
        sold30 = 0
        book = load_workbook(SALES, read_only=True, data_only=True)
        for row in book.active.iter_rows(min_row=8, values_only=True):
            if code(row[2]) != code_xr and not (not code(row[2]) and name_key(row[4]) == name_key(published['name'])):
                continue
            day = datetime.strptime(row[1], "%d/%m/%Y").date()
            if start30 <= day < snapshot:
                sold30 += quantity(row[6])
        book.close()
        self.assertEqual(published["sold30"], sold30)
        self.assertEqual(published["cover30"], round(active[0][17] * 30 / sold30, 2))
        self.assertEqual(published["suggestedOrder15"], suggested_order(active[0][17], sold30, published["reviewUnit30"]))

    def test_only_active_codes_and_sane_periods(self):
        data = json.loads(OUTPUT.read_text(encoding="utf-8"))
        products = data["products"]
        self.assertEqual(len(products), data["meta"]["activeProducts"])
        self.assertEqual(len({p["code"] for p in products}), len(products))
        self.assertTrue(all(p["sold30"] <= p["sold90"] <= p["soldHistory"] for p in products))
        self.assertTrue(all(p["cover30"] is None or p["cover30"] >= 0 for p in products))


if __name__ == "__main__":
    unittest.main()
