"""Where the notes live in the vault: the folder names, in one place.

Renaming a folder (say to English) is then a change here and in the plugin's defaults (plugin/src/settings.ts: championFolder,
itemFolder, guideFolder, augmentFolder, patchFolder), plus a `git mv`; no script needs to be edited.
"""

CHAMPIONS = "英雄"
ITEMS = "道具"
AUGMENTS = "強化"
GUIDE = "新手入門"
PATCH_NOTES = "版本更新"
