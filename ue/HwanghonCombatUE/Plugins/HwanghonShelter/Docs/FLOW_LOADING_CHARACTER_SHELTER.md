# Loading → Character Select → Shelter

## 1. Loading

Project `GameDefaultMap`:
`/Game/Hwanghon/Frontend/L_Loading`

GameMode:
`AHHLoadingGameMode`

최소 표시시간 뒤 `UHHOnlineFlowSubsystem::GoToCharacterSelect()`.

실제 제품에서는 MoviePlayer/PreLoadScreen 또는 Common Loading Screen으로 교체 가능하다.
흐름 API는 유지한다.

## 2. Character Select

Map:
`/Game/Hwanghon/Frontend/L_CharacterSelect`

GameMode:
`AHHCharacterSelectGameMode`

HUD:
`AHHCharacterSelectHUD`

선택:
- ain
- kain
- ryu
- sera

확정:
`UHHOnlineFlowSubsystem::RequestShelterAndTravel()`

## 3. Matchmaking

`POST /v1/match/shelter`

response:

```json
{
  "instanceId": "shelter-001",
  "address": "203.0.113.10:7777",
  "character": "ain"
}
```

client travel:

```text
203.0.113.10:7777?Character=ain
```

## 4. Shelter server

GameMode:
`AHHShelterOnlineGameMode`

PlayerState:
`AHHShelterOnlinePlayerState`

서버가 Character 옵션을 받아 PlayerState에 복제하고
`CharacterPawnClasses`에서 해당 Pawn을 고른다.

실제 서비스에서는 URL의 Character를 그대로 신뢰하지 말고
인증된 계정 캐릭터 DB와 대조해야 한다.
