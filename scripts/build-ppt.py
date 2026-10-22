"""Build browser-safe, 4K slide images from the four maintained PowerPoints."""
import hashlib
import json
import pathlib
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAPPING = {'clock': '設計_1.pptx', 'workshop': '製作_1.pptx', 'library': '驗証_1.pptx', 'lab': '模擬_1.pptx'}
manifest = {}
for key, name in MAPPING.items():
    source = ROOT / 'PPT' / name
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    output = ROOT / 'PPT' / 'rendered' / key / digest[:12]
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as work:
        subprocess.run(['libreoffice', '-env:UserInstallation=file://' + work + '/profile', '--headless', '--convert-to', 'pdf:impress_pdf_Export', '--outdir', work, str(source)], check=True, timeout=180)
        pdf = pathlib.Path(work) / (source.stem + '.pdf')
        if not pdf.is_file():
            raise RuntimeError('PowerPoint conversion failed: ' + name)
        subprocess.run(['pdftoppm', '-jpeg', '-jpegopt', 'quality=92', '-scale-to', '3840', str(pdf), str(pathlib.Path(work) / 'slide')], check=True, timeout=300)
        pages = sorted(pathlib.Path(work).glob('slide-*.jpg'), key=lambda p: int(p.stem.split('-')[-1]))
        if not pages:
            raise RuntimeError('No slides: ' + name)
        slides = []
        for index, page in enumerate(pages, 1):
            target = output / f'slide-{index:03d}.jpg'
            target.write_bytes(page.read_bytes())
            slides.append(target.relative_to(ROOT / 'PPT').as_posix())
        manifest[key] = {'source': name, 'sha256': digest, 'slides': slides}
        print(key, len(slides), 'slides')
(ROOT / 'PPT' / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
