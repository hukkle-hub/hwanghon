# Animation Donor Sources / License Record

이 파일은 donor 자산 자체가 아니라 **출처/사용조건 기록**이다.

## Epic / Fab — Game Animation Sample
- URL: https://www.fab.com/listings/880e319a-a59e-4ed2-b268-b32dac7fa016
- Free
- Unreal Engine sample.
- Epic documentation explicitly describes migrating its Animation Sequences into your own project.
- Fab listing currently marks AI usage as not allowed.
- Use: locomotion/traversal donor and system reference.

## Epic / Fab — Paragon donor packs
- Countess: https://www.fab.com/listings/0bf014eb-f2ed-4029-adda-81a855eb5220
- Kwang: https://www.fab.com/listings/f4c67e92-b976-4b5b-ab9f-4c25b010f6f3
- Greystone: https://www.fab.com/listings/122fd7bf-6f12-4304-a930-cccbbacdaebc
- Feng Mao: https://www.fab.com/listings/af344d79-eca6-4b6c-aae9-87c617a27ba1
- Serath: https://www.fab.com/listings/522b6160-15ab-492b-a2b0-c09f9bb5f6e6
- Morigesh: https://www.fab.com/listings/29e67175-fa08-448f-822b-37f411530749
- Phase: https://www.fab.com/listings/b2c95d5c-a805-460b-a01b-db6da3a778f0
- Dekker: https://www.fab.com/listings/6cc4f913-db56-44cc-9a42-6aeeeb147c79
- Sevarog: https://www.fab.com/listings/a4882b5e-cfad-4830-a3dd-46a6c31a79b2
- Grux: https://www.fab.com/listings/8c4bac2c-f7f7-4632-a644-47f4e104f5d8
- Rampage: https://www.fab.com/listings/0807cf74-08fd-4a33-8c8d-f33c9439fb1f
- Minions: https://www.fab.com/listings/039ea035-9360-4e76-ad06-5d3a92da6f65

Current Fab listings:
- Free.
- Released for use in Unreal Engine projects.
- Do not use PARAGON trademark/character identities to name or market Hwanghon.
- Listings currently show AI usage not allowed.
- Therefore: retarget/edit in UE/Blender pipeline only; do not upload these donor assets to generative-AI/training services.

## Quaternius Universal Animation Library
- URL: https://quaternius.com/packs/universalanimationlibrary.html
- CC0.
- 120+ animations.
- Unreal-ready retargetable humanoid rig.

## Quaternius Universal Animation Library 2
- URL: https://quaternius.com/packs/universalanimationlibrary2.html
- CC0.
- 130+ animations.
- 3/4 hit combos, armed/melee, parkour, etc.
- Tested with Unreal Engine 5+.

## Adobe Mixamo
- URL: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
- Adobe ID required.
- Adobe FAQ states characters/animations may be used royalty-free for personal, commercial and non-profit projects including video games.
- Do not redistribute raw Mixamo assets as an animation library.

## Rokoko Vision / Create
- URL: https://www.rokoko.com/products/vision
- Free Starter tier currently available with limited AI processing.
- Rokoko states generated Video-to-Motion/Text-to-Motion data can be used commercially.
- Use only our own recorded/generated motion for Hwanghon custom motions.

## AccuRIG
- URL: https://actorcore.reallusion.com/static-page/auto-rig/pre_page/accurig/accurig.html
- Free auto-rigging tool.
- Supports A/T pose humanoids and export to major 3D platforms.
- This tool does not replace the license of the underlying character mesh.

---

## Project rule

Every imported donor asset must record:
- source
- acquisition date
- license/source URL
- original asset path
- target character
- final derived animation asset path

Do not copy donor source files into public distributable source packages unless the original license explicitly permits redistribution.

## 확보 상태 (2026-09-28, 문서 134)

| donor | 경로 | 상태 |
|---|---|---|
| Paragon Countess | Fab → Epic 런처(VaultCache) → `/Game/ParagonCountess` | 프로젝트에 있음 |
| Kwang · Greystone · Feng Mao · Morigesh · Phase · Dekker · Grux · Rampage · Game Animation Sample | Fab 웹(디렉터 계정, 이미 로그인된 세션)에서 «Add to My Library» | 라이브러리에 추가함. **Epic 런처에서 «프로젝트에 추가 → HwanghonCombatUE» 가 남음**(런처 GUI, 디렉터) |
| Serath · Sevarog · Minions | 이미 라이브러리에 있었음 | 프로젝트 설치 전 |
| Quaternius UAL 1 · UAL 2 **Standard** | https://quaternius.itch.io/universal-animation-library(-2) — 무료 판(«No thanks, just take me to the downloads»). License.txt = CC0 1.0 | `/Game/Hwanghon/Animation/Donors/Quaternius/UAL1·UAL2`(원본 zip 은 커밋하지 않음) |

- 자동 다운로더는 만들지 않았다. 브라우저의 정상 다운로드 경로와 Fab 라이브러리 버튼만 썼다.
