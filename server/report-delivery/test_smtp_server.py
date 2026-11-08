import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('delivery', Path(__file__).parent / 'smtp_server.py')
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)

class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).parent)
        app.DATA = Path(self.temp.name)
        app.initialize()
        self.payload = dict(email='aluna@example.com', sessionId='test-session', examId='pcpe-agente-2024-02-25', consent=True,
                            report='SESSAO_ESTRUTURADA_JSON_INICIO test-session: relatório completo')
    def tearDown(self):
        self.temp.cleanup()
    def test_durable_and_idempotent(self):
        app.enqueue(self.payload)
        app.enqueue(self.payload)
        with app.database() as con:
            self.assertEqual(con.execute('SELECT count(*) FROM reports').fetchone()[0], 1)
        with self.assertRaises(FileExistsError):
            app.enqueue(dict(self.payload, email='outra@example.com'))
    def test_consent_and_header_injection(self):
        for change in [dict(consent=False), dict(email='bad\r\nBcc: x@example.com'), dict(sessionId='../etc')]:
            with self.assertRaises(ValueError):
                app.enqueue(dict(self.payload, **change))
    def test_delivery_and_no_double_send(self):
        app.enqueue(self.payload)
        with patch.object(app, 'deliver') as deliver:
            app.process_one()
            app.process_one()
            self.assertEqual(deliver.call_count, 1)
        with app.database() as con:
            self.assertEqual(con.execute('SELECT state FROM reports').fetchone()[0], 'sent')
    def test_ambiguous_delivery_is_retained(self):
        app.enqueue(self.payload)
        with patch.object(app, 'deliver', side_effect=TimeoutError()):
            app.process_one()
        with app.database() as con:
            row=con.execute('SELECT state,report FROM reports').fetchone()
            self.assertEqual(row['state'], 'uncertain')
            self.assertEqual(row['report'], self.payload['report'])
    def test_recover_after_restart(self):
        app.enqueue(self.payload)
        with app.database() as con:
            con.execute("UPDATE reports SET state='sending'")
        app.initialize()
        with app.database() as con:
            self.assertEqual(con.execute('SELECT state FROM reports').fetchone()[0], 'uncertain')

if __name__ == '__main__':
    unittest.main()
