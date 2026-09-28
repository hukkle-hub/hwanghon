# Novel → Game scene schema (docs/story/_scenes/EPxx.json)

Source of truth: 제1부_통합본_EP01-28.md (sha256 117d02a391165e09d5acc619548095321d5498bccd3792e97c250a691e018c2d),
in the repo at docs/story/source/ (EP01 canon: docs/story/source/황혼_1부_소설판_제01화_마감본.txt).

One JSON file per episode:

{
  "EpisodeId": "EP01", "TitleKo": "...",
  "NovelSource": {"file": "제1부_통합본_EP01-28.md", "lines": [start, end]},
  "SummaryKo": "5-10 sentence faithful summary",
  "Scenes": [ Scene, ... ],
  "Bosses": [ {"BossId": "boss_<romanized>", "NameKo": "...", "Scenes": ["EP01_SC012", ...],
               "NovelReasonForBattle": "...", "ArenaLocationId": "loc_...", "PhasesInNovel": ["..."],
               "PatternsInNovel": ["..."], "PartsOrWeakpointsInNovel": ["..."], "BreakCounterInNovel": ["..."],
               "EnvironmentInBattle": ["..."], "Outcome": "...", "Source": "L123-L456"} ],
  "Locations": [ {"LocationId": "loc_<romanized>", "NameKo": "...", "DescriptionKo": "...", "Scenes": [...]} ],
  "Characters": [ {"CharacterId": "char_<romanized>", "NameKo": "...", "RoleKo": "...", "Scenes": [...],
                   "StateChangesKo": ["injury / death / costume / equipment changes with scene id"]} ],
  "AnimationRequirements": [ {"Action": "open_door | sit | carry_on_back | ...", "Category": "combat|locomotion|interaction|emotion|gesture|injury|death|traversal|boss",
                              "Characters": [...], "Scenes": [...], "DonorLikely": true/false, "NotesKo": "..."} ],
  "Props": [ {"PropId": "prop_<romanized>", "NameKo": "...", "Scenes": [...]} ],
  "TBD_CANON": [ {"Scene": "EP01_SC003", "QuestionKo": "what the manuscript leaves unclear"} ]
}

Scene (every field required; [] or "TBD_CANON" when the manuscript does not say — never invent):
EpisodeId, SceneId ("EP01_SC001" sequential), NovelSource ("L<start>-L<end> §<section no> <section title>"),
NovelSummary, Location (LocationId), TimeOfDay, Characters [CharacterId], RequiredCostumes [..],
RequiredEquipment [..], StoryBeat, PlayerCharacter (CharacterId whose POV/body the player drives, or "none"),
NPCs [CharacterId], Dialogue [{"Speaker": CharacterId, "Line": "<= 40 chars excerpt", "Source": "L123"}] (key lines only, max 6),
GameMode [one or more of STORY_CINEMATIC, STORY_WALK, STORY_DIALOGUE, INVESTIGATION, TRANSITION, BOSS_ENTRY,
BOSS_BATTLE, BOSS_RESULT, FLASHBACK, ANIMATION_ONLY], PlayerGoal, Interaction [..], BossId ("" if none),
BossPhase ("" or "P1".."P3"), EnvironmentState, Props [PropId], VFX [..], SFX [..], Music (mood, "" if none),
GameplayEntry, GameplayExit, AnimationRequired [Action], CinematicRequired (true/false + reason in string),
SaveFlags [..], Prerequisites [SceneId|flag], NextScene (SceneId), RequiredAssets ["env:...", "char:...", "prop:...",
"anim:...", "vfx:...", "sfx:...", "bgm:..."], CanonStatus ("CANON" or "TBD_CANON").

Canonical IDs for the main cast: char_ain(아인) char_kain(카인) char_ryu(류) char_sera(세라) char_oh_jeonggil(오정길)
char_mateo(마태오) char_yujin(유진) char_han_jangin(한 장인) char_dr_jin(닥터 진). Others: romanized Korean name + NameKo.
