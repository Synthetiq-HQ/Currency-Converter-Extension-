"""Exercise the optional legacy helper without installing or running Flask."""
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, patch

class FakeFlask:
    def __init__(self, *_args): pass
    def route(self, *_args): return lambda function: function

flask = types.ModuleType('flask')
flask.Flask = FakeFlask
flask.request = types.SimpleNamespace(args={})
flask.jsonify = lambda value: value
requests = types.ModuleType('requests')
requests.get = Mock()
with patch.dict(sys.modules, {'flask': flask, 'requests': requests}):
    spec = importlib.util.spec_from_file_location('qc_proxy', Path(__file__).resolve().parents[1] / 'proxy.py')
    proxy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(proxy)

class ProxyTests(unittest.TestCase):
    def test_primary_current_endpoint(self):
        requests.get.return_value = types.SimpleNamespace(ok=True,json=lambda:{'base':'USD','quote':'GBP','rate':.75})
        self.assertEqual(proxy.fetch_from_frankfurter('USD','GBP'),.75)
        self.assertEqual(requests.get.call_args.args[0],'https://api.frankfurter.dev/v2/rate/USD/GBP')
    def test_fallback_current_schema(self):
        requests.get.return_value = types.SimpleNamespace(ok=True,json=lambda:{'result':'success','base_code':'USD','rates':{'GBP':.75}})
        self.assertEqual(proxy.fetch_from_open_api('USD','GBP',1),.75)
    def test_nonfinite_amount_rejected(self):
        flask.request.args={'from':'USD','to':'GBP','amount':'nan'}
        self.assertEqual(proxy.convert()[1],400)
    def test_zero_and_same_currency(self):
        flask.request.args={'from':'USD','to':'USD','amount':'-100'}
        self.assertEqual(proxy.convert()[0]['result'],-100)
    def test_cache_bounded(self):
        proxy.CACHE.clear()
        for n in range(110):proxy.cache_rate(str(n),'GBP',.75)
        self.assertEqual(len(proxy.CACHE),100)

if __name__ == '__main__':unittest.main()
