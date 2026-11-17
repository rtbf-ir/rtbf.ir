"""Build the deployable static site and API without adding generated files to Git."""

import argparse
import json
from pathlib import Path
import shutil
import tempfile

from build_api import ROOT, build_documents, write_documents


DIRECTORIES = ("assets", "data", "post", "api")


def build_site(output):
    output = Path(output).resolve()
    if output == ROOT or output in ROOT.parents or any(
        output == ROOT / name or ROOT / name in output.parents for name in DIRECTORIES
    ) or output.name.startswith("."):
        raise ValueError("Choose a build output directory separate from source files")
    marker = output / ".rtbf-build"
    if output.exists() and (not output.is_dir() or not marker.is_file()):
        raise ValueError("Refusing to replace a directory not created by this builder")
    documents = build_documents(json.loads((ROOT / "data/data.json").read_text()))
    with tempfile.TemporaryDirectory(prefix="rtbf-pages-") as temporary:
        site = Path(temporary)
        for path in ROOT.iterdir():
            if path.is_file() and (path.suffix in {".html", ".xml", ".txt"} or path.name == "CNAME"):
                shutil.copy2(path, site / path.name)
        for name in DIRECTORIES:
            shutil.copytree(ROOT / name, site / name,
                            ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        write_documents(site / "api/v1", documents)
        (site / ".nojekyll").touch()
        (site / ".rtbf-build").touch()
        if output.exists():
            shutil.rmtree(output)
        shutil.copytree(site, output)
    print(f"Built site and {len(documents)} API responses in {output}.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "_site")
    build_site(parser.parse_args().output)


if __name__ == "__main__":
    main()
