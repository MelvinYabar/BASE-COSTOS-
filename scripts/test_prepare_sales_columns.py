import unittest

from prepare_sales import columns_for, number


class OkfacColumnsTest(unittest.TestCase):
    def test_original_report_without_category(self):
        row = [None, 'Fecha', 'Código', 'Producto / Servicio', 'Tipo', 'Cantidad', 'Total Vendido']
        self.assertEqual(columns_for(row), {'date': 1, 'code': 2, 'product': 3,
                                            'type': 4, 'qty': 5, 'amount': 6})

    def test_new_report_with_category(self):
        row = [None, 'Fecha', 'Código', 'Categoría', 'Producto / Servicio',
               'Tipo', 'Cantidad', 'Total Vendido']
        self.assertEqual(columns_for(row), {'date': 1, 'code': 2, 'product': 4,
                                            'type': 5, 'qty': 6, 'amount': 7})

    def test_formatted_amounts(self):
        self.assertEqual(number('S/ 2,859,317.52'), number('2859317.52'))


if __name__ == '__main__':
    unittest.main()
