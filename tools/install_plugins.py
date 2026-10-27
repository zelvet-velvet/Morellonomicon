#!/usr/bin/env python3
"""Download the Obsidian community plugins listed in community-plugins.json.

Plugin code is not stored in git. For each id this looks up the plugin's GitHub repo in
obsidianmd/obsidian-releases and saves main.js, manifest.json and styles.css (if any) from its
latest release into .obsidian/plugins/<id>/. Standard library only. Run:

    python3 tools/install_plugins.py [id ...]     # no ids = every plugin in the list
"""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

VAULT = Path(__file__).resolve().parent.parent   # the repo root is the Obsidian vault
OBSIDIAN = VAULT / ".obsidian"
REGISTRY = "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json"
ASSETS = ("main.js", "manifest.json", "styles.css")
OPTIONAL = {"styles.css"}
OWN_PLUGINS = {"morellonomicon"}   # built from plugin/ (npm run build && npm run install-vault), committed in the vault


def get(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read()


def install(plugin_id, repo):
    release = json.loads(get(f"https://api.github.com/repos/{repo}/releases/latest"))
    urls = {a["name"]: a["browser_download_url"] for a in release["assets"]}
    folder = OBSIDIAN / "plugins" / plugin_id
    folder.mkdir(parents=True, exist_ok=True)
    for name in ASSETS:
        if name not in urls:
            if name not in OPTIONAL:
                raise RuntimeError(f"release {release['tag_name']} has no {name}")
            continue
        (folder / name).write_bytes(get(urls[name]))
    return release["tag_name"]


def main():
    wanted = sys.argv[1:] or json.loads((OBSIDIAN / "community-plugins.json").read_text())
    registry = {p["id"]: p["repo"] for p in json.loads(get(REGISTRY))}
    failed = []
    for plugin_id in wanted:
        if plugin_id in OWN_PLUGINS:
            continue
        if plugin_id not in registry:
            print(f"? {plugin_id}: not in the community list")
            failed.append(plugin_id)
            continue
        try:
            print(f"+ {plugin_id} {install(plugin_id, registry[plugin_id])}")
        except (urllib.error.URLError, RuntimeError, KeyError) as e:
            print(f"! {plugin_id}: {e}")
            failed.append(plugin_id)
    print("done" if not failed else f"done, failed: {', '.join(failed)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
