"""Exercise the Python and PowerPoint exporters without changing maintained decks."""
import hashlib
import importlib.util
import json
import pathlib
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('ppt_catalog', root / 'scripts' / 'ppt_catalog.py')
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)

with tempfile.TemporaryDirectory(prefix='ppt-filenames-', dir=root / '.preview') as work:
    fixture = pathlib.Path(work)
    assert fixture.resolve().parent == (root / '.preview').resolve()
    folder = fixture / 'PPT'
    folder.mkdir()
    data = b'unchanged PowerPoint bytes'
    digest = hashlib.sha256(data).hexdigest()
    slides = ['rendered/clock/' + digest[:12] + '/slide-001.jpg']
    (folder / slides[0]).parent.mkdir(parents=True)
    (folder / slides[0]).write_bytes(b'cached slide')
    def save(name, value):
        (folder / name).write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')
    save('decks.json', {'clock': '設計_1.pptx'})
    save('manifest.json', {'clock': {'source': '設計_1.pptx', 'sha256': digest, 'slides': slides}})
    filename = '設計_1_搞定原理圖設計.pptx'
    (folder / filename).write_bytes(data)
    (folder / '設計_10_其他入口.pptx').write_bytes(b'unrelated')
    assert catalog.resolve_decks(fixture) == {'clock': filename}
    check = subprocess.run(['python', str(root / 'scripts' / 'build-ppt.py'), '--root', str(fixture), '--check'], capture_output=True, text=True, check=True)
    assert check.stdout.strip() == 'false'
    manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
    assert manifest['clock']['source'] == filename and manifest['clock']['slides'] == slides
    print('PASS named filename discovery, numeric slot boundary, rename reuses rendered slides')
    check = subprocess.run(['powershell', '-ExecutionPolicy', 'Bypass', '-File', str(root / 'scripts' / 'export-ppt.ps1'), '-Root', str(fixture)], capture_output=True, check=True)
    manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8-sig'))
    assert manifest['clock']['source'] == filename and manifest['clock']['slides'] == slides
    print('PASS Windows exporter discovers the same renamed deck without opening PowerPoint')
    (folder / '設計_1.pptx').write_bytes(data)
    before = (folder / 'manifest.json').read_bytes()
    try:
        catalog.resolve_decks(fixture)
        raise AssertionError('Duplicate slot accepted')
    except ValueError:
        pass
    check = subprocess.run(['powershell', '-ExecutionPolicy', 'Bypass', '-File', str(root / 'scripts' / 'export-ppt.ps1'), '-Root', str(fixture)], capture_output=True)
    assert check.returncode and (folder / 'manifest.json').read_bytes() == before
    print('PASS duplicate filenames stop both exporters without replacing the manifest')
    (folder / '設計_1.pptx').unlink()
    (folder / filename).write_bytes(b'replacement deck bytes')
    check = subprocess.run(['python', str(root / 'scripts' / 'build-ppt.py'), '--root', str(fixture), '--check'], capture_output=True, text=True, check=True)
    assert check.stdout.strip() == 'true' and (folder / 'manifest.json').read_bytes() == before
    print('PASS content changes request rendering and preserve the last complete manifest')
