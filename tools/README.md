# tools

Scripts that build Morellonomicon's notes and `_data/`. Standard library only; run them from the repo root with `python3 -I tools/<path>`. Each script's docstring has its full usage.

## Run these
| Script | What it does |
| :--- | :--- |
| `update_patch.py` | One command for a new patch: every step below in order (`--commit` commits and pushes) |
| `mn.py` | Data CLI: `status`, `snapshot`, `report` (crawl dashboard), `tiers` (the private tier page, `.cache/reports/tiers.html`) |
| `crawl/mayhem_crawler.bat` | Double-click on Windows: the crawler's menu (`crawl/fetch_lcu.py`) in WSL |

## Shared
| Script | What it does |
| :--- | :--- |
| `datalib.py` | Loads `_data/`, its history per patch and the private game caches |
| `vault_paths.py` | The vault's folder names, in one place |
| `toolpath.py` | Puts `tools/` and the job folders on `sys.path`, so the scripts import each other by bare name |
| `data/` | Templates (`tiers.html`, `report.html`) and hand-kept lists the scripts read |

## crawl/: the games behind the tiers
| Script | What it does |
| :--- | :--- |
| `fetch_lcu.py` | Collects Mayhem games through the League client on this PC into `.cache/mayhem.sqlite` |
| `lcu_tui.py` | The crawler's terminal screens |
| `lcu_cache.py` | Our crawl in resg.top's cache format, as evidence for the tiers and builds |
| `fetch_resg.py` | Caches resg.top's Mayhem numbers |
| `augment_model.py` | Each augment's own effect on winning, with the champion and the other augments held fixed |

## reason/: augment tiers and item builds
| Script | What it does |
| :--- | :--- |
| `augment_tiers.py` | Tiers every augment for every champion from its kit, checked against games (`_data/augment-tiers.json`) |
| `build_tiers.py` | A main build and alternatives for every champion (`_data/item-builds.json`) |
| `reasoning_todo.py` | What the reasoning still needs after a patch (`Review/Reasoning Todo.md`) |

## fetch/: Riot, CommunityDragon and wiki data
| Script | What it does |
| :--- | :--- |
| `fetch_data.py` | Champion and item notes from Data Dragon (zh_TW) |
| `spells.py` | Per-rank skill numbers for `fetch_data.py` |
| `fetch_augments.py` | Mayhem augment notes from CommunityDragon |
| `fetch_augment_text.py` | Augment effect text (`_data/augment-text.json`) |
| `fetch_augment_data.py` | Augment numbers, levels and scaling (`_data/augment-data.json`) |
| `fetch_wiki_augments.py` | The League wiki's augment text (`_data/augment-wiki.json`) |
| `fetch_changes.py` | Champion changes across patches (`_data/changes.json`) |
| `fetch_patch_notes.py` | Riot's patch notes in short (`_data/patches.json`) |
| `fetch_item_roles.py` | The item shop's class tabs (`_data/item-roles.json`) |
| `fetch_positions.py` | Lanes per champion (`_data/positions.json`) |
| `fetch_loading_tips.py` | Loading screen tips (`_data/loading-tips.json`) |
| `fetch_builds.py` | What players build, from Riot's Match-V5 API |
| `fetch_mastery.py` | Your champion mastery (`_data/mastery.json`, git-ignored) |

## vault/: note upkeep and checks
| Script | What it does |
| :--- | :--- |
| `audit_tags.py` | `Review/Tag Audit.md`: which skill text gave each ability tag |
| `retag_features.py` | Re-reads every champion's ability tags from its stored skill text |
| `add_game_text.py` | Fills in game text for existing champion notes without regenerating them |
| `callouts.py` | Sets each callout's type from its boxes |
| `check_cards.py` | Handbook cards over the text limits |
| `list_ui_text.py` | The plugin's hint texts into `Dev Tools/UI Text.md` |
| `build_sounds.py` | Pinyin per character (`_data/sounds.json`) for 速查's search by sound |
| `install_plugins.py` | Downloads the Obsidian community plugins on a new machine |
