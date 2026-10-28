"""Build browser-safe, 4K slide images from the maintained PowerPoints."""
import hashlib
import json
import pathlib
import subprocess
import tempfile

from ppt_catalog import resolve_decks
import argparse


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=pathlib.Path, default=pathlib.Path(__file__).resolve().parent.parent)
    parser.add_argument('--check', action='store_true', help='Refresh filename metadata; print whether slide rendering is needed.')
    args = parser.parse_args()
    root = args.root
    mapping = resolve_decks(root)
    manifest_path = root / 'PPT' / 'manifest.json'
    old_manifest = json.loads(manifest_path.read_text(encoding='utf-8-sig')) if manifest_path.is_file() else {}
    manifest = {}
    needs_render = False
    for key, name in mapping.items():
        source = root / 'PPT' / name
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        previous = old_manifest.get(key, {})
        if previous.get('sha256') == digest and previous.get('slides') and all((root / 'PPT' / slide).is_file() for slide in previous['slides']):
            manifest[key] = {**previous, 'source': name}
            if not args.check:
                print(key, 'cached', len(previous['slides']), 'slides')
            continue
        needs_render = True
        if args.check:
            continue
        output = root / 'PPT' / 'rendered' / key / digest[:12]
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
                slides.append(target.relative_to(root / 'PPT').as_posix())
            manifest[key] = {'source': name, 'sha256': digest, 'slides': slides}
            print(key, len(slides), 'slides')
    if not args.check or not needs_render:
        manifest_path.write_bytes((json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
    if args.check:
        print(str(needs_render).lower())


if __name__ == '__main__':
    main()
