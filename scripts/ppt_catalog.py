"""Resolve stable room/slot prefixes to the maintained PowerPoint filenames."""
import json
import pathlib


def resolve_decks(root):
    folder = pathlib.Path(root) / 'PPT'
    mapping = json.loads((folder / 'decks.json').read_text(encoding='utf-8-sig'))
    files = [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() == '.pptx']
    resolved = {}
    for key, canonical in mapping.items():
        prefix = pathlib.Path(canonical).stem.casefold()
        matches = [p.name for p in files if p.stem.casefold() == prefix or p.stem.casefold().startswith(prefix + '_')]
        if len(matches) != 1:
            raise ValueError(f'Expected one PPT for {canonical}; found {len(matches)}: {", ".join(sorted(matches))}')
        resolved[key] = matches[0]
    return resolved
