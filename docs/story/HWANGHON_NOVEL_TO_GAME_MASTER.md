# 황혼 Novel → Game 마스터 (자동 생성 — `python tools/story/build_novel_master.py`)

- 원문: `제1부_통합본_EP01-28.md` (sha256 `117d02a391165e09…`, docs/story/source/)
- EP01: docs/story/source/황혼_1부_소설판_제01화_마감본.txt (EP01 canon: the finalized episode overrides the compiled text)
- 우선순위: 확정 소설 > 디자인 시트 > 이 마스터 > 게임 시스템 > UI. 원문에 없는 것은 `TBD_CANON`.

## 요약

- 에피소드 28 · 장면 405 · 장소 131 · 인물 63 · 보스 12 · 시네마틱 필요 장면 268 · TBD_CANON 342

- GameMode 분포: STORY_CINEMATIC 180, STORY_DIALOGUE 127, BOSS_BATTLE 77, INVESTIGATION 61, STORY_WALK 50, TRANSITION 26, BOSS_ENTRY 23, BOSS_RESULT 19, FLASHBACK 8, ANIMATION_ONLY 4

## 1. 에피소드

| EP | 제목 | 장면 | 보스 | 원문 줄 |
|---|---|---|---|---|
| EP01 | 황혼 아래 사신의 낫 | 22 | 훈련용 짚단 허수아비(각성체) | [1, 681] |
| EP02 | 어둠에 잠긴 강남역 | 15 | 클레이브 | [1170, 1985] |
| EP03 | 제3화 — 사형집행관 | 20 | 클레이브 | [1986, 3879] |
| EP04 | 케이블카 드로퍼 | 15 | 셀레스티얼 | [3949, 4855] |
| EP05 | 내려간다 | 17 | 셀레스티얼 | [4856, 5881] |
| EP06 | 여의도 금융가의 유령들 | 13 | 에이지스-07 | [5882, 6546] |
| EP07 | 소켓 | 14 | 에이지스-07 | [6616, 7282] |
| EP08 | 한 번 | 13 | TBD_CANON(한강 침수 터널의 마디진 수중체 — 산문에 명칭 없음) | [7351, 7776] |
| EP09 | 제9화 — 격벽 | 21 | 한강 침수 터널의 '놈' (정식 명칭 TBD_CANON) | [7778, 8236] |
| EP10 | 제10화 — 지상의 것들 | 15 | — | [8237, 8660] |
| EP11 | 제11화 — 표식 | 13 | — | [8661, 8978] |
| EP12 | 제12화 — 우선 | 14 | — | [8979, 9310] |
| EP13 | 제13화 — 두드림 | 16 | — | [9311, 9678] |
| EP14 | 봉합 | 13 | 실험체 09호 (개체 09) | [9679, 10167] |
| EP15 | 두 번 | 13 | 실험체 09호 (개체 09) | [10168, 10644] |
| EP16 | 밝은 쪽 | 13 | 섀도우 팽 (괴물을 먹는 괴물) | [10645, 10944] |
| EP17 | 빈칸 | 13 | 섀도우 팽 (괴물을 먹는 괴물), 셀레스티얼 (하늘의 왕) | [10945, 11298] |
| EP18 | 발현 | 17 | — | [11299, 11724] |
| EP19 | 제19화 — 손실 | 13 | — | [11725, 12074] |
| EP20 | 제20화 — 내일 | 15 | — | [12075, 12496] |
| EP21 | 제21화 — 배 속 | 15 | 아스널 오버로드 | [12497, 12893] |
| EP22 | 제22화 — 열여덟 | 13 | 아스널 오버로드, 박 준장(문지기) | [12894, 13307] |
| EP23 | 제23화 — 자라는 그래프 | 13 | 박 준장(문지기) | [13308, 13696] |
| EP24 | 황혼이 진 다음 날 | 13 | — | [13697, 14032] |
| EP25 | 새가 없다 | 8 | 정 장관 (정 장관이었던 것) | [14033, 14255] |
| EP26 | 자화상 | 8 | 정 장관 (정 장관이었던 것) | [14256, 14493] |
| EP27 | 경고 | 16 | 나노-노바 코어 (결정의 산·차한별) | [14494, 14971] |
| EP28 | 황혼의 서울: 사신의 각인 | 14 | 발사대 탑 (증폭기) | [14972, 15321] |

## 2. 보스 (디자인 시트 대조 포함 — 시트: UEIntroProject `Content/Twilight/UI/BossArt`)

| 보스 | 디자인 시트 | UEIntroProject 카탈로그 |
|---|---|---|
| 훈련용 짚단 허수아비 | T_BossArt_Scarecrow.png | TestBoss |
| 클레이브 | T_BossArt_Clave.png | Cleave |
| 셀레스티얼 | T_BossArt_Celestial.png | Celestial |
| 에이지스-07 | T_BossArt_Aegis07.png | Aegis07 |
| 레비아탄 (원문 EP27 L14590 «터널의 레비아탄», 시트 «레비아탄 나노») | T_BossArt_Leviathan.png | LeviathanNano |
| 실험체 09호 | T_BossArt_Subject09.png | Subject09 |
| 섀도우 팽 | T_BossArt_ShadowFang.png | ShadowFang |
| 아스널 오버로드 | T_BossArt_Arsenal.png | ArsenalOverlord |
| 박 준장 | T_BossArt_GeneralPark.png | GeneralPark |
| 정 장관 | **시트 없음** | MinisterJeong |
| 나노-노바 코어 | **시트 없음** | NanoNovaCore |
| 발사대 탑 (증폭기) | **시트 없음** | NanoNovaCore phase 2 «증폭 탑 앵커» (TBD_CANON: 별도 보스?) |
| 아이언 워든 (**1부 원문 등장 없음**) | T_BossArt_IronWarden.png | IronWarden |
| 이 중장 (**1부 원문 등장 없음**) | T_BossArt_GeneralLee.png | GeneralLee |

| 보스 | ID | EP | 전투 이유(원문) | 장면 |
|---|---|---|---|---|
| 훈련용 짚단 허수아비 | boss_training_heosuabi | EP01 | 마태오가 도장 찍기 전 두 사람의 호흡을 보려고 훈련용 허수아비를 치게 했고, 카인과 아인의 타격 후 짚단 안쪽의 문양이 폭발하며 3m 나노 강 | EP01_SC002, EP01_SC015, EP01_SC016, EP01_SC017, EP01_SC018, EP01_SC019 |
| 클레이브 | boss_clave | EP02, EP03 | '셔터 끄는 놈'이 광장을 지나가며 이쪽을 보고도 그냥 가지만, 생존자 하나가 견디지 못하고 총을 쏘자 돌아서 곧장 온다(두 사람이 싸움을 건 ; 전날 광장에서 벙커 쪽 누군가가 지나가던 클레이브에게 방아쇠를 당겨 놈이 돌아섰고(L2401), 패배 후 아인·카인이 셔터 경첩 공략을 세워 재 | EP02_SC013, EP02_SC014, EP02_SC015, EP03_SC008, EP03_SC009, EP03_SC010, EP03_SC011, EP03_SC012, EP03_SC013, EP03_SC014,  |
| 셀레스티얼 | boss_celestial | EP04, EP05, EP17 | 클레이브 수트 코어에서 해독된 좌표를 따라 남산 전망대에 올랐을 때 셀레스티얼이 습격해 난간을 부수며 일행을 떨어뜨리려 한다.; EP04에서 놓친 놈을 다시 잡으러 남산에 오지만, 놈은 나타나지 않는다(교전 없음).; 순찰 경로대로 골짜기 상공을 지나던 중 섀도우 팽에게 끌어내려져 추락 — 세라: '오늘이 아니면 못 잡아' | EP04_SC009, EP04_SC010, EP04_SC011, EP05_SC003, EP05_SC012, EP05_SC013, EP17_SC003, EP17_SC004, EP17_SC005, EP17_SC006,  |
| 에이지스-07 | boss_aegis_07 | EP06, EP07 | 여의도 안개 속에서 조우(지역③ 1/2). 놈은 정지해 배리어를 펼 뿐이고 아인이 먼저 들어간다. 명칭은 EP06 산문에 없고 EP07 L680; 여의도(지역③ 2/2) 재도전. 불가시 배리어의 쏠림을 이용해 등의 방열부를 노린다. | EP06_SC008, EP06_SC009, EP06_SC010, EP06_SC011, EP07_SC005, EP07_SC006, EP07_SC008, EP07_SC009, EP07_SC010 |
| 레비아탄 (원문 EP27 L14590 «터널의 레비아탄», 시트 «레비아탄 나노») | boss_leviathan | EP08, EP09 | 관제실 계측기가 사흘째 오르기만 하는 한강 침수 터널(지역④ 1/2) 원정. 두 번째 진입의 목표는 이기는 것이 아니라 600m 차수문 3-B까; 물을 당겨 커지고 있어(관제실 그래프 상승), 터널이 좁아지면 한강으로 나가 가둘 수 없게 되기 때문에 차수문이 있는 동안 터널에 가둔다 (L7 | EP08_SC005, EP08_SC006, EP08_SC010, EP08_SC011, EP08_SC012, EP09_SC008, EP09_SC009, EP09_SC010, EP09_SC011, EP09_SC012,  |
| 실험체 09호 | boss_subject_09 | EP14, EP15 | 닥터 진의 목록 중 냉장 보관 약품이 있는 지하 3층으로 내려가려는데, 콘크리트 봉인을 안쪽에서 밀어내고 나온 개체가 계단 아래에 있었음; 전날 분열한 3개체가 굳힌 계단 이음매를 아래에서 치고 올라옴. 카인은 이대로 두면 뒤따르는 벙커 사람들이 만난다고 주장 | EP14_SC004, EP14_SC005, EP14_SC006, EP14_SC007, EP14_SC008, EP14_SC009, EP14_SC010, EP14_SC011, EP15_SC003, EP15_SC004,  |
| 섀도우 팽 | boss_shadow_fang | EP16, EP17 | 인계 지점 추정 1호를 조사하던 중, 밝기를 사냥하는 것의 영역 한가운데에서 가장 밝은 코어를 지닌 아인을 노려 수풀 그늘에서 기습; EP16에서 이어진 전투 — 세라를 향해 도약한 놈을 4인 공식으로 마무리 | EP16_SC003, EP16_SC004, EP16_SC005, EP16_SC006, EP16_SC007, EP16_SC008, EP16_SC009, EP16_SC010, EP16_SC011, EP16_SC012,  |
| 아스널 오버로드 | boss_arsenal_overlord | EP21, EP22 | 계룡 지하 주 격납고 한가운데의 복합체. 세라가 이름을 대는 순간 포탑이 깨어나 일행을 조준·사출한다(격납고 출구는 등 뒤 하나).; EP21 진입 실패 후 재진입. 탑을 넘어야 격납고 안쪽(복도 문)으로 갈 수 있음. | EP21_SC006, EP21_SC007, EP21_SC008, EP21_SC009, EP21_SC010, EP21_SC011, EP21_SC012, EP21_SC013, EP22_SC002, EP22_SC003,  |
| 박 준장 | boss_general_park | EP22, EP23 | 각인 표본 보관실로 통하는 복도 끝 마지막 문의 문지기로 세워져 있음. 경례 후 공격 개시.; 각인 표본 보관실 강화문의 문지기. EP22 말미 경례 후 공격 개시. | EP22_SC012, EP22_SC013, EP23_SC001, EP23_SC002 |
| 정 장관 | boss_minister_jeong | EP25, EP26 | 발사장에 도착한 일행을 향해 의장대가 갈라지고 이 나라의 마지막 국방장관이 성숙한 집행관으로 걸어옴(EP25는 등장만, 전투는 EP26).; 발사장에 도착한 일행 앞에 의장대가 갈라지고 정 장관이었던 것이 「미확인 인원 다섯. 신원 대조」 명령 후 군도를 뽑아 공격. 발사대·갱도로 가 | EP25_SC008, EP26_SC001, EP26_SC002, EP26_SC003, EP26_SC004, EP26_SC005, EP26_SC006 |
| 나노-노바 코어 | boss_nano_nova_core | EP27 | 노바 1호가 싣고 돌아온 「부르는 것」이 수거된 코어로 지은 결정의 산. 다 익은 코어(일행)를 발사대 증폭기로 쏘아 올리기 위해 「그러니, 오 | EP27_SC002, EP27_SC003, EP27_SC004, EP27_SC005, EP27_SC006, EP27_SC007, EP27_SC008, EP27_SC009, EP27_SC010, EP27_SC011,  |
| 발사대 탑 (증폭기) | boss_amplifier_tower | EP28 | 「이 년의 마지막 적은, 괴물이 아니라 탑이었다」 — 다 익은 코어 넷(송신원)의 신호를 하늘까지 쏘아 올리는 증폭기. 멀어지는 것으로는 막을  | EP28_SC001, EP28_SC002, EP28_SC003 |

## 3. 장소

| 장소 | ID | EP | 장면 수 |
|---|---|---|---|
| 여의도 금융가 빌딩 협곡(안개) | loc_yeouido_fog_canyon | EP06, EP07 | 17 |
| 주 격납고 | loc_gyeryong_main_hangar | EP21, EP22 | 16 |
| 발사대 아래 지하 공간 (결정의 산) | loc_balsadae_jiha | EP27 | 14 |
| 강남역 지하상가 중앙 광장 | loc_gangnam_central_plaza | EP02, EP03 | 12 |
| 관제실 | loc_bunker_control_room | EP09, EP10, EP12, EP13, EP19 | 12 |
| 인계 지점 추정 1호 — 낡은 물류창고 앞마당 (무음의 전장) | loc_logistics_warehouse_yard | EP16 | 12 |
| 인계 지점 추정 1호 일대 골짜기 (무음의 전장) | loc_logistics_warehouse_yard | EP17 | 11 |
| 각인 표본 보관실(원형 홀) | loc_gyeryong_specimen_hall | EP23 | 11 |
| 판교 연구소 지상층 로비 | loc_pangyo_lab_lobby | EP15 | 10 |
| 빈 시골 마을의 폐가 | loc_sigol_maeul_pyega | EP24 | 9 |
| 지하 훈련장 | loc_heosuabi_training_ground | EP01 | 8 |
| 남행 야영지 | loc_south_camp | EP20 | 8 |
| 각인 평가소 | loc_gakin_pyeonggaso | EP01, EP03, EP05, EP09, EP12 | 7 |
| 벙커 통로 | loc_bunker_corridor | EP04, EP05, EP06, EP07, EP09 | 7 |
| 남태령 방면 지상 국도 | loc_namtaeryeong_national_road | EP10 | 7 |
| 발사장 도로·활주로 (의장대 도열지) | loc_balsajang_doro | EP25, EP26 | 7 |
| 판교 연구소 지하 3층 계단·지하실 | loc_pangyo_lab_b3 | EP14 | 6 |
| 강남 벙커 아이들 구역 | loc_gangnam_bunker_children_ward | EP18, EP28 | 6 |
| 벙커 (방 미특정) | loc_bunker | EP19 | 6 |
| 남산 케이블카 승강장 | loc_namsan_cablecar_station | EP04, EP05 | 5 |
| 한강 침수 터널 입구 | loc_hangang_tunnel_entrance | EP08, EP09 | 5 |
| 한강 침수 터널(수몰 구간) | loc_hangang_flooded_tunnel | EP08 | 5 |
| 외측 기계실 | loc_hangang_tunnel_outer_machine_room | EP09 | 5 |
| 탈영병 은신처 | loc_deserter_hideout | EP11 | 5 |
| 벙커 아이들 구역 | loc_bunker_children_area | EP13 | 5 |
| 소독약 냄새 복도 | loc_gyeryong_sterile_corridor | EP22, EP23 | 5 |
| 강남대로 | loc_gangnam_daero | EP02 | 4 |
| 강남역 지하상가 지하 1층 통로(침수) | loc_gangnam_mall_flooded | EP02 | 4 |
| 강남 벙커 | loc_gangnam_bunker | EP03, EP14, EP18 | 4 |
| 국방부 통신실 | loc_namsan_mnd_commroom | EP05 | 4 |
| 폐차장 언덕 능선 | loc_scrapyard_ridge | EP11 | 4 |
| 계룡 지하 경사로 | loc_gyeryong_ramp | EP21, EP22 | 4 |
| 방파제 | loc_bangpaje | EP25, EP28 | 4 |
| 강남 폐빌딩 옥상 | loc_gangnam_rooftop | EP01 | 3 |
| 강남역 지하상가 출격문 | loc_sortie_gate | EP01, EP02, EP03 | 3 |
| 한 장인 작업장 | loc_han_workshop | EP03 | 3 |
| 지하 2호선 침수 선로 | loc_line2_flooded_track | EP03 | 3 |
| 남산 계단 | loc_namsan_stairs | EP04 | 3 |
| 남산 전망대 | loc_namsan_observatory | EP04 | 3 |
| 의무실 | loc_bunker_infirmary | EP04, EP05 | 3 |
| 남산타워 하부 | loc_namsan_tower_lower | EP05 | 3 |
| 벙커 의무실 | loc_bunker_infirmary | EP07, EP10, EP12 | 3 |
| 전술 테이블 | loc_bunker_tactical_table | EP09 | 3 |
| 남태령 중계소 | loc_namtaeryeong_relay_station | EP10 | 3 |
| 고개 아래 폐주유소 | loc_abandoned_gas_station | EP10 | 3 |
| 판교 봉인 건물 | loc_pangyo_sealed_building | EP13 | 3 |
| 강남 벙커 관제실 | loc_gangnam_bunker_control_room | EP18, EP28 | 3 |
| 정비창(첫 격납고 층) | loc_gyeryong_maintenance_depot | EP21 | 3 |
| 지하 인력사무소 | loc_mateo_office | EP01 | 2 |
| 마태오의 사무소 | loc_mateo_office | EP06 | 2 |
| 벙커 식당 | loc_bunker_cafeteria | EP09, EP12 | 2 |
| 한강 침수 터널 | loc_hangang_flooded_tunnel | EP09 | 2 |
| 폐차장 공터 (집결지) | loc_scrapyard_lot | EP11 | 2 |
| 강남 벙커 출격문 | loc_bunker_sortie_gate | EP12, EP13 | 2 |
| 벙커 복도 | loc_bunker_corridor | EP12 | 2 |
| 판교 연구단지 (세 번째 건물 앞) | loc_pangyo_research_complex | EP14 | 2 |
| 골짜기 밖 (저녁의 갈림길) | loc_valley_outskirts | EP17 | 2 |
| 북으로 가는 길 | loc_north_road | EP18 | 2 |
| 한 장인의 작업장 | loc_han_workshop | EP18 | 2 |
| 폐쇄된 지방 평가소 | loc_local_assessment_post | EP20 | 2 |
| 발사대 탑 아래 정비 갱도 입구 | loc_balsadae_gangdo_ipgu | EP26 | 2 |
| 정비 갱도 | loc_jeongbi_gangdo | EP27 | 2 |
| 벙커 출격문 밖 외곽 초소 | loc_bunker_oegwak_choso | EP28 | 2 |
| 강남 벙커 (지하 3층) | loc_gangnam_bunker | EP01 | 1 |
| 한 장인의 작업대 | loc_han_workbench | EP01 | 1 |
| 강남역 5번 출구 | loc_gangnam_station_exit5 | EP02 | 1 |
| 중앙 광장 배수로 | loc_plaza_drain | EP02 | 1 |
| 강남 벙커 외곽 통로 | loc_gangnam_bunker_outer_passage | EP03 | 1 |
| 마태오 사무소 | loc_mateo_office | EP03 | 1 |
| 벙커 출격문 앞 | loc_bunker_sortie_gate | EP04 | 1 |
| 마태오의 홀로그램 테이블 | loc_bunker_mateo_table | EP04 | 1 |
| 끊긴 한강 다리(남쪽 절반) | loc_hangang_broken_bridge | EP04 | 1 |
| 소월로 | loc_sowolro | EP04 | 1 |
| 남산 중턱 | loc_namsan_midslope | EP04 | 1 |
| 훈련장 | loc_bunker_training_ground | EP05 | 1 |
| 마태오의 자리 | loc_bunker_mateo_table | EP05 | 1 |
| 남산타워 지하 3층 철문 앞 | loc_namsan_tower_b3 | EP05 | 1 |
| 여의도 지하 공동구 | loc_yeouido_utility_tunnel | EP06 | 1 |
| 여의도 지하주차장 | loc_yeouido_parking | EP06 | 1 |
| 벙커 관제실 | loc_bunker_control_room | EP08 | 1 |
| 유진의 평가소 | loc_yujin_evaluation_office | EP08 | 1 |
| 벙커 배급대 | loc_bunker_ration_line | EP09 | 1 |
| 내측 기계실 | loc_hangang_tunnel_inner_machine_room | EP09 | 1 |
| 지상 귀환길 | loc_surface_return_route | EP09 | 1 |
| 남쪽 국도 (행렬 추적 구간) | loc_south_national_road | EP11 | 1 |
| 국도변 마을 | loc_roadside_village | EP11 | 1 |
| 벙커 귀환길 | loc_return_road_to_bunker | EP12 | 1 |
| 옥상 환기구 | loc_bunker_rooftop_vent | EP12 | 1 |
| 아인의 자리 | loc_ain_seat | EP12 | 1 |
| 장비 정비 구역 | loc_bunker_equipment_maintenance | EP13 | 1 |
| 2030년 회상 — 분류가 이뤄진 거리 | loc_flashback_2030_street | EP13 | 1 |
| 남행 갈림길 | loc_south_road_junctions | EP13 | 1 |
| 방음벽 아래 야영지 | loc_soundwall_camp | EP13 | 1 |
| 판교 시가지 | loc_pangyo_streets | EP13 | 1 |
| 판교로 가는 길 | loc_route_pangyo | EP14 | 1 |
| 판교 연구소 지하 2층 시약 창고 | loc_pangyo_lab_b2 | EP14 | 1 |
| 판교 연구소 건물 옥상 | loc_pangyo_lab_rooftop | EP14 | 1 |
| 판교 연구소 지하 계단 (굳은 이음매) | loc_pangyo_lab_b3 | EP15 | 1 |
| 남쪽으로 내려가는 길 | loc_south_road | EP16 | 1 |
| 강남 벙커 통로·문과 셔터 | loc_gangnam_bunker_corridors | EP18 | 1 |
| 강남 벙커 외곽 무너진 진입로 | loc_gangnam_bunker_outer_approach | EP18 | 1 |
| 강남 벙커 환기구(함석 관) | loc_gangnam_bunker_vent_duct | EP18 | 1 |
| 강남 벙커 각인 평가소 | loc_gangnam_bunker_evaluation_office | EP18 | 1 |
| 벙커 훈련장 | loc_bunker_training | EP19 | 1 |
| 의무실 옆 빈 방 | loc_bunker_infirmary_annex | EP19 | 1 |
| 무전실 | loc_bunker_radio_room | EP19 | 1 |
| 세라의 방 | loc_bunker_sera_room | EP19 | 1 |
| 벙커 철문 | loc_bunker_gate | EP19 | 1 |
| 계룡 남행로 | loc_south_road | EP20 | 1 |
| 계룡 외곽 능선 | loc_gyeryong_ridge | EP20 | 1 |
| 능선 아래 바위 그늘 | loc_gyeryong_ridge_shelter | EP20 | 1 |
| 계룡 분지 철책·초소선 | loc_gyeryong_perimeter | EP20 | 1 |
| 지하 격납고 관문 | loc_gyeryong_hangar_gate | EP20 | 1 |
| 두 번째 층 세 갈래 길목 | loc_gyeryong_junction | EP21 | 1 |
| 경사로 중턱 정비실 | loc_gyeryong_ramp_workroom | EP21 | 1 |
| 북쪽으로 난 밤길 (빗속) | loc_bukjjok_gil | EP24 | 1 |
| 마을 어귀 | loc_sigol_maeul_eogwi | EP24 | 1 |
| 비 갠 젖은 국도 | loc_jeojeun_gukdo | EP24 | 1 |
| 고흥 방면 갈림길 이정표 | loc_galimgil_ijeongpyo | EP24 | 1 |
| 남해 해안선 | loc_namhae_haeanseon | EP25 | 1 |
| 발사장 외곽 방어선 | loc_balsajang_bangeoseon | EP25 | 1 |
| 배수로·케이블 트렌치 | loc_baesuro_teurenchi | EP25 | 1 |
| 발사 통제동 관제실 | loc_balsa_tongjedong | EP25 | 1 |
| 격리동 | loc_gyeokridong | EP25 | 1 |
| 고흥 발사장 (지상) | loc_goheung_balsajang | EP28 | 1 |
| 발사대 탑 | loc_balsadae_tap | EP28 | 1 |
| 북상 귀로 (국도) | loc_bukhyang_gukdo | EP28 | 1 |
| 강남 벙커 철문 | loc_gangnam_bunker_cheolmun | EP28 | 1 |
| 강남 벙커 의무실 | loc_bunker_uimusil | EP28 | 1 |
| 강남 벙커 옥상 | loc_bunker_oksang | EP28 | 1 |
| 강남 벙커 (방 미특정) | loc_gangnam_bunker | EP28 | 1 |

## 4. 인물 등장표

| 인물 | ID | EP | 장면 수 |
|---|---|---|---|
| 아인 | char_ain | EP01, EP02, EP03, EP04, EP05, EP06, EP07, EP08, EP09, EP10, EP11, EP12, EP13, EP14, EP15, EP16, EP17, EP18, EP19, EP20, EP21, EP22, EP23, EP24, EP25, EP26, EP27, EP28 | 359 |
| 카인 | char_kain | EP01, EP02, EP03, EP04, EP05, EP06, EP07, EP08, EP09, EP10, EP11, EP12, EP13, EP14, EP15, EP16, EP17, EP18, EP19, EP20, EP21, EP22, EP23, EP24, EP25, EP26, EP27, EP28 | 317 |
| 류 | char_ryu | EP06, EP07, EP08, EP09, EP10, EP11, EP12, EP13, EP14, EP15, EP16, EP17, EP18, EP19, EP20, EP21, EP22, EP23, EP24, EP25, EP26, EP27, EP28 | 206 |
| 세라 | char_sera | EP14, EP15, EP16, EP17, EP18, EP19, EP20, EP21, EP22, EP23, EP24, EP25, EP26, EP27, EP28 | 137 |
| 오정길 | char_oh_jeonggil | EP03, EP04, EP05, EP06, EP07, EP08, EP09, EP10, EP11, EP12, EP13, EP14, EP15, EP16, EP17, EP18, EP19, EP22, EP24, EP28 | 127 |
| 마태오 | char_mateo | EP01, EP02, EP03, EP04, EP05, EP06, EP08, EP09, EP10, EP12, EP13, EP14, EP18, EP19, EP24, EP25, EP28 | 39 |
| 서 하사 | char_seo_hasa | EP10, EP11, EP12, EP13, EP20, EP21, EP23, EP25, EP26, EP28 | 27 |
| 두호 | char_duho | EP02, EP03, EP12, EP13, EP18, EP19, EP28 | 25 |
| 차한별 | char_cha_hanbyeol | EP20, EP23, EP24, EP25, EP26, EP27, EP28 | 23 |
| 유진 | char_yujin | EP01, EP03, EP04, EP05, EP08, EP09, EP12, EP18, EP20, EP23, EP24, EP28 | 22 |
| 두나 | char_duna | EP02, EP13, EP18, EP19, EP28 | 18 |
| 탈영병들 | char_talyeongbyeong | EP10, EP11, EP12 | 14 |
| 안내인(이름 미상) | char_annaein | EP21, EP22 | 14 |
| 정 일병 | char_jeong_ilbyeong | EP11, EP24, EP25, EP26 | 13 |
| 닥터 진 | char_dr_jin | EP02, EP03, EP04, EP05, EP07, EP10, EP12, EP14, EP18, EP23, EP28 | 12 |
| 부르는 것 (위의 목소리) | char_bureuneun_geot | EP27 | 12 |
| 한 장인 | char_han_jangin | EP01, EP03, EP18, EP22, EP28 | 9 |
| 클레이브 | char_cleave | EP03 | 9 |
| 클레이브 | char_clave | EP02, EP10, EP11 | 8 |
| 집행관 의장대 | char_uijangdae | EP25, EP26 | 8 |
| 정 장관 (정 장관이었던 것) | char_jeong_janggwan | EP25, EP26, EP28 | 8 |
| 강 씨 | char_kang | EP08 | 7 |
| 구출된 아이 | char_guchul_ai | EP11, EP12, EP13 | 7 |
| 민경 | char_minkyung | EP14 | 7 |
| 박 준장 | char_bak_junjang | EP22, EP23, EP26 | 6 |
| 훈련용 짚단 허수아비(각성체) | char_training_heosuabi | EP01 | 5 |
| 광장 생존자들 | char_plaza_survivors | EP02 | 5 |
| 방호복 인원 | char_banghobok | EP11 | 5 |
| 줄 선 사람들 | char_julseon_saramdeul | EP11 | 5 |
| 구출된 노인 | char_guchul_noin | EP11, EP12 | 5 |
| 구출된 여자 | char_guchul_yeoja | EP11, EP12 | 5 |
| 벙커 사람들 | char_bunker_saramdeul | EP12, EP13 | 5 |
| 정 일병의 누나 | char_jeong_nuna | EP24, EP25, EP26 | 5 |
| 경비복 남자 | char_guard_man | EP02 | 4 |
| 방호복 인원 | char_hazmat_raiders | EP18 | 4 |
| 백 실장 | char_baek_siljang | EP19, EP20 | 4 |
| 셀레스티얼 | char_celestial | EP04 | 3 |
| 케이블카 드로퍼 | char_cablecar_dropper | EP05 | 3 |
| 현 중위 | char_hyeon_jungwi | EP10, EP11, EP23 | 3 |
| 마스크 쓴 장교 | char_mask_jangyo | EP11 | 3 |
| 군 표식 집행관 | char_military_executioner | EP18 | 3 |
| 수희 | char_suhui | EP01, EP28 | 2 |
| 스승(아인의) | char_ain_seuseung | EP03 | 2 |
| 박 씨 | char_park_ssi | EP12 | 2 |
| 난수 방송 발신자 | char_nansu_sender | EP19 | 2 |
| 강 기관사 | char_gang_gigwansa | EP23 | 2 |
| 스승 | char_seuseung | EP24, EP27 | 2 |
| 카인의 딸 | char_kain_ttal | EP24, EP28 | 2 |
| 쇼윈도 리퍼 | char_showwindow_reaper | EP02 | 1 |
| 2미터급 감염체 | char_infected_2m | EP02 | 1 |
| 현(중위) | char_hyeon | EP08 | 1 |
| 배급대 아주머니 | char_baegeup_ajumeoni | EP09 | 1 |
| 밤의 행렬 | char_bam_haengnyeol | EP10 | 1 |
| 정 일병의 누나 | char_jeong_ilbyeong_nuna | EP11 | 1 |
| 두호의 아빠 | char_duho_appa | EP13 | 1 |
| 두호의 엄마 | char_duho_eomma | EP13 | 1 |
| 2030년의 군인들 | char_2030_gunindeul | EP13 | 1 |
| 그것들 (괴물) | char_2030_geugeotdeul | EP13 | 1 |
| 무전수 박 씨 | char_mujeonsu_bak | EP19 | 1 |
| 노바 1호 승무원(박 항법사·윤 의무관·한 부기관사·조 통신사·서 화물관리관) | char_nova1_crew | EP23 | 1 |
| 정OO 일병·정OO 민간 | char_jeong_siblings | EP23 | 1 |
| 항해일지의 여섯 (강·박·윤·한·조·서) | char_hanghae_yeoseot | EP28 | 1 |
| 아인의 첫 스승(이름 미상) | char_ain_teacher | EP02 | 0 |

## 5. 장면 목록

### EP01 황혼 아래 사신의 낫

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP01_SC001 | TBD_CANON | STORY_CINEMATIC |  | 화 제목 '제01화 황혼 아래 사신의 낫'. 계측 대장 서식 3-A 한 줄: 성명 아인 / 나이 26 / 거주 구역 강남 벙커 | CANON | 마감본.txt L1-L6 제목 · 「각인 계측 대장 · 서식 3-A」 |
| EP01_SC002 | loc_heosuabi_training_ground | STORY_CINEMATIC | boss_training_heosuabi | (콜드 오픈) 지하 훈련장. 목제 몸통을 여섯 바퀴 감고 있던 사슬이 안쪽에서 밀려 끊어지고, 이 년 동안 묶여 있던 사람 크 | CANON | 마감본.txt L7-L26 【 서 】 |
| EP01_SC003 | TBD_CANON | STORY_CINEMATIC |  | 국방부 상황보고 제3보(2030.03.04 05:20): 경기 남부 방어선 접촉 중단, 소화기 유효성 '불명'·무력화 0건,  | CANON | 마감본.txt L27-L50 ◇ 남은 문서 |
| EP01_SC004 | loc_gangnam_rooftop | STORY_CINEMATIC |  | 나노 입자로 이 년째 파랗지 않은 서울의 하늘, 보라와 핏빛의 황혼. 강남 폐빌딩 옥상, 무릎 높이 붉은 안개 위에 여자 하나 | CANON | 마감본.txt L51-L70 ◇ 옥상 |
| EP01_SC005 | TBD_CANON | FLASHBACK |  | 셔터가 콘크리트 레일을 긁으며 내려오는 소리 — 기억 속에서 실제보다 훨씬 느려 매번 아직 시간이 있다는 착각이 든다. 맞잡았 | TBD_CANON | 마감본.txt L71-L84 ◇ 미끄러진 것 (회상) |
| EP01_SC006 | loc_gangnam_rooftop | STORY_CINEMATIC |  | 눈을 뜨자 색이 돌아온다. 낫 자루를 쥔 손에 힘줄이 도드라지고, 아인은 그 손을 한참 내려다본다. 이 년 동안 백 몇 마리를 | CANON | 마감본.txt L85-L92 ◇ 미끄러진 것 (현재 복귀) |
| EP01_SC007 | loc_gangnam_rooftop | STORY_DIALOGUE/STORY_CINEMATIC |  | 옥상 철문이 열리고 역광 속 카인(32) 등장 — 왼쪽 눈썹에서 턱까지 사람이 낸 흉터, 190cm·62kg 티타늄 대검을 한 | CANON | 마감본.txt L93-L132 ◇ 반보 뒤 |
| EP01_SC008 | loc_gangnam_bunker | STORY_WALK |  | 끝없는 나선 계단 — 한 바퀴 돌 때마다 따라 내려오던 황혼이 한 뼘씩 줄어 마지막엔 아래의 주황색만 남는다. 지하 3층 강남 | CANON | 마감본.txt L133-L158 ◇ 사람이 사는 곳 |
| EP01_SC009 | loc_han_workbench | STORY_CINEMATIC |  | 한 장인(나이를 짐작하기 어려운 과묵한 남자)이 말없이 손을 내밀자 아인이 낫을 건넨다. 넉 달 전 처음 건네던 날과 똑같은  | CANON | 마감본.txt L159-L216 ◇ 재촉 |
| EP01_SC010 | loc_gakin_pyeonggaso | STORY_DIALOGUE/STORY_CINEMATIC |  | 유진(서른 언저리, 짧게 묶은 머리, 벙커 유일의 등급 권한자)이 아인의 무등록 이 년을 확인한다. '이 년 동안 안 받고 버 | CANON | 마감본.txt L217-L300 ◇ 이 년 |
| EP01_SC011 | loc_gakin_pyeonggaso | STORY_CINEMATIC |  | 두 사람이 나간 뒤 유진은 콘솔 아래 서랍에서 「각인 평가 대장」이라 적힌 낡은 대학 노트를 꺼내 홀로그램 수치를 손으로 옮겨 | CANON | 마감본.txt L301-L306 ◇ 대장 |
| EP01_SC012 | loc_gakin_pyeonggaso | FLASHBACK/STORY_CINEMATIC |  | (과거) 마태오가 불 안 붙인 담배로 노트를 가리키며 잉크값은 누가 대냐고 묻고, 유진은 자기가 칩 두 개/월을 댄다고 답한다 | CANON | 마감본.txt L307-L328 ◇ 대장 (회상: 잉크 → 현재) |
| EP01_SC013 | loc_mateo_office | STORY_DIALOGUE |  | CRT 모니터가 한 벽을 채운 방(절반은 꺼짐; 서울 남부 구역도·신호 그래프·의뢰 목록). 오른쪽 아래 한 화면만 소리 없는 | CANON | 마감본.txt L329-L378 ◇ 인력사무소 |
| EP01_SC014 | loc_heosuabi_training_ground | STORY_CINEMATIC |  | 지하 훈련장(낡은 매트, 깨진 형광등, 낮은 천장 — 카인은 이 방에서만 검을 눕혀 든다). 카인이 대검을 양손으로 고쳐 쥐자 | CANON | 마감본.txt L379-L414 ◇ 원 |
| EP01_SC015 | loc_heosuabi_training_ground | BOSS_ENTRY | boss_training_heosuabi | 갈라진 짚단 안쪽에서 붉은 빛 — 문양이 균열을 따라 번진다. '카인! 물러나!' '…뭐?' 반 박자 늦는다(이 년을 같이 다 | CANON | 마감본.txt L415-L460 ◇ 짚단이 아니었다 |
| EP01_SC016 | loc_heosuabi_training_ground | BOSS_BATTLE | boss_training_heosuabi | 놈이 양팔을 벌리고 회전을 시작한다(어깨 감김, 허리 비틀림, 발 고정) — 숨이 들어간다. 큰 걸 쓰기 직전의 반 박자를 각 | CANON | 마감본.txt L461-L510 ◇ 거리 |
| EP01_SC017 | loc_heosuabi_training_ground | BOSS_BATTLE | boss_training_heosuabi | 카인이 아인 앞을 막고 대검을 바닥에 수직으로 꽂는다. 막는 게 아니다 — 부딪히는 찰나 코어 출력을 무기 표면에 얇게 펴 발 | CANON | 마감본.txt L511-L530 ◇ 되돌려주는 법 |
| EP01_SC018 | loc_heosuabi_training_ground | BOSS_BATTLE | boss_training_heosuabi | 아인이 일어서지만 뛰지 않는다. 놈과 자신 사이 — 딱 낫 하나 길이. 몸을 비틀며 솟구친다('이번엔—'). 코어가 척추를 타 | CANON | 마감본.txt L531-L566 ◇ 끊는 법 |
| EP01_SC019 | loc_heosuabi_training_ground | BOSS_RESULT | boss_training_heosuabi | 이음매 결정의 원리(편대가 힘을 배분하는 중계점이 굳은 것, 살아 있을 땐 몸속에 있어 안 보임). 카인이 짚단 잔해를 뒤적이 | CANON | 마감본.txt L567-L604 ◇ 끊는 법 (결과 · 결정) |
| EP01_SC020 | loc_heosuabi_training_ground | STORY_DIALOGUE |  | 관측창 문이 박차고 열린다. 마태오 '…합격이다. 신입들. 아니— 용병단.' 짚단 잔해·끊어진 철사슬·매트의 팬 자국으로 시선 | CANON | 마감본.txt L605-L630 ◇ 손실 (훈련장) |
| EP01_SC021 | loc_mateo_office | STORY_CINEMATIC |  | 사무소로 돌아온 마태오가 낡은 서류철 장부(날짜·항목·금액)에 오늘 날짜와 「훈련 기재 파손 — 300,000」을 적는다. 그 | CANON | 마감본.txt L631-L642 ◇ 손실 (사무소 장부) |
| EP01_SC022 | loc_sortie_gate | STORY_CINEMATIC/TRANSITION |  | 「강남역 지하상가 출격문」 거대한 철문이 찌그러지는 소리와 함께 올라가고 붉은 안개가 밀려든다. 아인은 낫을 어깨에 걸친다;  | CANON | 마감본.txt L643-L681 ◇ 출격 |

### EP02 어둠에 잠긴 강남역

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP02_SC001 | loc_sortie_gate | STORY_WALK |  | 출격문이 다 열리는 데 20초. 아인은 문턱을 넘자마자 멈춰 소리부터 듣는다 — 이 년째의 절차(눈은 앞만 보지만 귀는 뒤도  | CANON | L1170-L1212 §1 문턱 |
| EP02_SC002 | loc_gangnam_daero | STORY_WALK/INVESTIGATION |  | 강남대로는 부서지지 않았다 — 감염체는 건물을 부수지 않는다. 서울은 무너진 게 아니라 멈춰 있다. 차들은 차선을 지킨 채 멈 | CANON | L1213-L1248 §2 멈춘 도시 |
| EP02_SC003 | loc_gangnam_daero | STORY_WALK |  | 사거리 신호등이 초록으로 바뀌고 두 사람이 멈춘다. 배선에 붙은 것들(신호등·전광판·몇몇 간판)엔 아직 전기가 들어온다. 잔여 | CANON | L1249-L1280 §3 초록불 |
| EP02_SC004 | loc_gangnam_daero | STORY_WALK |  | 건물 외벽을 타고 주황 결정이 자라 있다 — 유리처럼 맑고 안쪽에서 빛이 천천히 돈다; 창틀을 감싸고 인도 곳곳에 무릎 높이로 | CANON | L1281-L1316 §4 예쁜 것 |
| EP02_SC005 | loc_gangnam_daero | STORY_WALK |  | 카인이 빌딩 사이로 늘어진 보라·핏빛 황혼을 한참 올려다보다 '…새가 없네.' 아인은 대답하지 않는다. 전깃줄에도 옥상 난간에 | CANON | L1317-L1340 §5 새가 없다 |
| EP02_SC006 | loc_gangnam_station_exit5 | STORY_DIALOGUE/TRANSITION |  | 강남역 5번 출구는 반쯤 무너져 있다. 카인이 어깨로 밀어 틈을 벌린다. '…들어가면 물이야?' '응.' '얼마나.' '허리. | CANON | L1341-L1356 §6 내려가는 길 (5번 출구) |
| EP02_SC007 | loc_gangnam_mall_flooded | STORY_WALK/INVESTIGATION |  | 물은 차갑다. 지하 1층 상가 통로가 허리까지 잠겼다. 천장 형광등이 3초 켜짐·1초 꺼짐으로 명멸 — 아인은 간격을 센다(놈 | CANON | L1357-L1398 §6 내려가는 길 (침수 통로) |
| EP02_SC008 | loc_gangnam_mall_flooded | STORY_CINEMATIC |  | 물이 두 사람과 다른 방향에서 한 번 출렁인다. 불이 꺼진 1초에 오른쪽 쇼윈도 안의 무언가가 자세를 바꾼다 — 쇼윈도 리퍼: | TBD_CANON | L1399-L1457 §7 유리 뒤 |
| EP02_SC009 | loc_gangnam_mall_flooded | STORY_CINEMATIC |  | 물 위로 나노 칩 하나가 떠오르고 아인이 손을 뻗자 물이 갈라지며 무언가가 튀어나온다. 반 박자 늘어진 세계에서 궤도(찌르기, | CANON | L1458-L1535 §8 철근 |
| EP02_SC010 | loc_gangnam_mall_flooded | STORY_DIALOGUE |  | 아인이 낫을 물속에 눕혀 세우고 무릎을 꿇는다 — 물이 가슴까지, 아이와 눈높이가 맞는다. 이름은 두호. 칩을 밀어주자 떨리는 | CANON | L1536-L1617 §9 무릎 |
| EP02_SC011 | loc_gangnam_central_plaza | STORY_CINEMATIC |  | 안쪽에서 총성. 통로 끝에 지하 1·2층을 튼 2층 높이 중앙 광장, 천장엔 2년 전 12월의 크리스마스 장식. 뒤집힌 진열대 | TBD_CANON | L1618-L1707 §10 삼천 발 |
| EP02_SC012 | loc_gangnam_central_plaza | STORY_DIALOGUE |  | 경비복을 입은 오십 대 남자가 K2를 쥔 채 나와 고마워한다. '총 버려요.' '쏘면 소리 듣고 더 와요.' 남자는 사흘 동안 | CANON | L1708-L1757 §11 지나간다 (생존자) |
| EP02_SC013 | loc_gangnam_central_plaza | BOSS_ENTRY/STORY_CINEMATIC | boss_clave | 끼기기기긱 — 아인의 목덜미 코어가 저 혼자 밝아지고 그녀가 손으로 덮는다. 벽의 긁힌 자국이 소리 방향으로 이어진다. 경비복 | CANON | L1758-L1831 §11 지나간다 (클레이브) |
| EP02_SC014 | loc_gangnam_central_plaza | BOSS_BATTLE | boss_clave | 총성 — 생존자 하나가 견디지 못했다. 놈이 돌아서 곧장 온다. '…아, 씨.' 카인 '밀어붙인다!' 정면 돌진, 62kg이  | CANON | L1832-L1907 §12 틱 (교전) |
| EP02_SC015 | loc_gangnam_central_plaza | BOSS_RESULT/STORY_CINEMATIC | boss_clave | 장검이 내려찍혀 광장 바닥이 갈라진다. 아인이 배수로 격자를 낫으로 뜯어내고 '전부 들어가요!' — 사람들이 뛰어들고 아인이  | CANON | L1908-L1949 §12 틱 (퇴각) |

### EP03 제3화 — 사형집행관

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP03_SC001 | loc_gangnam_bunker_outer_passage | STORY_CINEMATIC |  | 배수로를 기어 나온 생존자 열 몇 명이 벙커 외곽 통로에 젖은 채 널브러진다. 각인자인 카인이 셔터에 한 번 밀린 것만으로 사 | CANON | L1986-L2054 §1 굳은 손 |
| EP03_SC002 | TBD_CANON | STORY_DIALOGUE/INVESTIGATION |  | 아인이 젖은 바닥에 손가락으로 셔터(가로 직사각형)와 그 뒤의 원 두 개를 그린다. 낫이 걸리는 세 조건(거리·숨·반 박자)  | TBD_CANON | L2055-L2186 §2 경첩 |
| EP03_SC003 | loc_han_workshop | STORY_CINEMATIC |  | 한 장인이 말없이 손을 내밀고, 카인이 금 간 대검을 작업대에 올린다(작업대 다리가 휘청). 장인은 칼등에서 사선으로 난 금을 | CANON | L2187-L2224 §3 벼린다 |
| EP03_SC004 | loc_han_workshop | STORY_CINEMATIC/STORY_DIALOGUE |  | 다음 날 대검이 다시 나온다. 카인이 눈높이로 들어 보지만 금은 그대로이고 선만 조금 얇아졌다. 카인이 '안 없어지네요'라고  | CANON | L2225-L2250 §3 벼린다 (다음 날) |
| EP03_SC005 | loc_han_workshop | STORY_CINEMATIC |  | 아인이 어제 광장·그저께 잡일·지난주 몫까지 모은 나노 칩을 작업대에 올리지만 장인은 아인 쪽으로 밀어 놓는다. 두 사람이 몇 | CANON | L2251-L2296 §4 밀어 놓는다 |
| EP03_SC006 | loc_mateo_office | STORY_DIALOGUE |  | 사무소 문을 열자 마태오가 왼손으로 계산기를, 오른손으로 장부를 쓰며 불 안 붙인 담배를 물고 있다. 죽을 뻔했는데 또 가냐고 | TBD_CANON | L2297-L2354 §5 계산기 |
| EP03_SC007 | loc_gangnam_sortie_gate | STORY_DIALOGUE/INVESTIGATION/TRANSITION |  | 출격문 앞에 K2를 멘 경비복 남자가 서서 같이 가겠다고 한다. 카인이 총을 버리라고 하자 버릴 수 없다며, 쏜 게 자기 쪽이 | CANON | L2355-L2526 §6 따라온 사람 |
| EP03_SC008 | loc_gangnam_underground_plaza | STORY_WALK/INVESTIGATION/BOSS_ENTRY | boss_cleave | 광장은 어제 그대로다 — 부서진 진열대, 뒤집힌 매대, 패트롤어 잔해, 기운 은색 별 크리스마스 장식. 물 위에 어제 못 빠져 | CANON | L2527-L2663 §7 지운다 |
| EP03_SC009 | loc_gangnam_underground_plaza | BOSS_BATTLE | boss_cleave | 카인이 정면으로 셔터를 때리지만 셔터가 힘을 넓게 퍼뜨려 튕겨내고, 무릎 높이 물 아래 미끄러운 타일에서 발이 밀려 등이 기둥 | CANON | L2664-L2939 §8 밀린다 |
| EP03_SC010 | loc_gangnam_underground_plaza | BOSS_BATTLE/STORY_CINEMATIC | boss_cleave | 카인이 대검을 세로로 세워 셔터에 대고 밀지 않고 버틴다. 대검 날을 셔터 아래 모서리에 걸어 놔 놈이 셔터를 빼지 못하고,  | CANON | L2940-L3103 §9 손을 뗀다 |
| EP03_SC011 | loc_gangnam_underground_plaza | BOSS_BATTLE | boss_cleave | 카인이 맨손으로 셔터 아래쪽 모서리를 두 손으로 잡는다. 무기가 없으니 반사가 안 되고 그냥 받는다. 손바닥이 베인다. 몸을  | CANON | L3104-L3193 §10 양손 |
| EP03_SC012 | loc_gangnam_underground_plaza | BOSS_BATTLE | boss_cleave | 양손으로 밀려고 몸이 나오면서 셔터가 앞으로 기울고 뒤쪽 경첩 소켓 두 개(위쪽은 반쯤 접힘, 아래쪽은 갈라짐)가 드러난다.  | CANON | L3194-L3269 §11 하나만 |
| EP03_SC013 | loc_gangnam_underground_plaza | STORY_CINEMATIC | boss_cleave | 소켓이 뜯겨 3미터 철판이 놈의 손에서 떨어지고 물기둥이 천장까지 솟았다 무너진다. 셔터 뒤쪽이 드러나고, 갈고리에 사람 여섯 | CANON | L3270-L3325 §12 매달린 것 |
| EP03_SC014 | loc_gangnam_underground_plaza | STORY_CINEMATIC/TRANSITION | boss_cleave | 방패를 잃은 클레이브가 처음으로 자세를 바꿔 장검을 양손으로 들고 광장 중앙 기둥을 벤다. 천장이 무너지고 바닥이 꺼져 물이  | CANON | L3326-L3343 §13 선로 (붕괴) |
| EP03_SC015 | loc_line2_flooded_track | BOSS_BATTLE | boss_cleave | 지하 2호선 침수 선로. 카인은 착지하며 무릎이 꺾이고 물이 가슴까지 찬다. 아인은 떨어지며 낫을 레일에 걸어 낙하를 늦춘다( | CANON | L3344-L3405 §13 선로 (지하 2호선) |
| EP03_SC016 | loc_line2_flooded_track | BOSS_RESULT/STORY_CINEMATIC/INVESTIGATION | boss_cleave | 클레이브가 무너지고 2.5미터 티타늄 아머가 선로 위로 쏟아진다. 단면에서 어른 주먹만 한 주황색 결정이 굴러 나오고 아인이  | TBD_CANON | L3406-L3535 §14 B |
| EP03_SC017 | loc_gangnam_bunker | STORY_CINEMATIC |  | 원고의 '14. B' 끝에 들어 있는 단락으로, 15절 첫머리(L3740-L3758)와 문장이 동일하다. 그날 밤 벙커로 돌아 | TBD_CANON | L3536-L3557 §14 B (벙커 귀환 — 원고 중복 단락) |
| EP03_SC018 | loc_line2_flooded_track | STORY_CINEMATIC/STORY_DIALOGUE |  | 남자가 선로 한쪽에 앉아 있고, 총은 처음으로 손에서 놓여 옆에 있다. 그가 데려온 사람 중 둘이 진열대 아래에서 죽었다(카인 | TBD_CANON | L3558-L3737 §14 오정길 |
| EP03_SC019 | loc_gangnam_bunker | STORY_CINEMATIC |  | 그날 밤 벙커로 돌아온다. 아인이 억제제 병을 내밀자 두호가 두 손으로 받는다 — 병이 손보다 크다. 입만 몇 번 움직이다 인 | CANON | L3738-L3761 §15 두 개의 B (벙커 귀환) |
| EP03_SC020 | loc_engraving_evaluation_office | STORY_DIALOGUE/STORY_CINEMATIC |  | 통로 끝 '각인 평가소'. 유진이 집행관급을 잡았다는 말에 재측정 대상이라며 발판 위로 올린다. 이틀 만에 오른 발판에서 청백 | CANON | L3762-L3879 §15 두 개의 B (각인 평가소) |

### EP04 케이블카 드로퍼

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP04_SC001 | loc_bunker_sortie_gate | STORY_CINEMATIC |  | 새벽, 아직 아무도 없는 출격문 앞으로 카인이 온몸이 젖은 채 혼자 돌아온다. 어깨에 멘 대검은 금 간 자리에 물이 맺혀 있다 | CANON | L3949-L4003 §1 젖은 채로 |
| EP04_SC002 | loc_bunker_mateo_table | STORY_DIALOGUE |  | 아침, 마태오의 홀로그램 테이블에 새 좌표가 뜬다. 클레이브의 수트 코어에서 나온 것을 유진이 사흘 걸려 해독했다. 마태오가  | CANON | L4004-L4037 §2 북쪽 |
| EP04_SC003 | loc_hangang_broken_bridge | INVESTIGATION/STORY_CINEMATIC |  | 한강 다리는 전부 끊겨 있고(반포·동작·한남), 하나만 남쪽 절반이 남아 있다. 아인이 끊긴 단면을 살핀다. 철근이 바깥으로  | CANON | L4038-L4093 §3 폭약 |
| EP04_SC004 | loc_sowolro | STORY_WALK |  | 소월로. 붉은 안개는 아래쪽에만 깔리고 고도가 오를수록 하늘이 가까워지며 보라와 핏빛이 짙어진다. 가로수 자리에 사람 키만 한 | CANON | L4094-L4123 §4 오르는 길(소월로) |
| EP04_SC005 | loc_namsan_stairs | STORY_WALK |  | 순환로는 결정이 뒤덮어 지나갈 수 없어 셋은 남산 계단으로 오른다. 카인이 맨 뒤다. 늘 물이 싫다, 계단이 많다, 영감이 수 | CANON | L4124-L4155 §4 오르는 길(계단) |
| EP04_SC006 | loc_namsan_midslope | STORY_WALK/STORY_CINEMATIC |  | 중턱에서 서울이 내려다보인다. 도시 전체에 불빛이 없고, 멀리 신호등 몇 개만 건널 사람 없이 초록과 빨강을 번갈아 켠다. 오 | CANON | L4156-L4189 §5 불이 없다 |
| EP04_SC007 | loc_namsan_cablecar_station | INVESTIGATION/STORY_DIALOGUE |  | 케이블카 승강장은 유리가 다 깨져 있고, 표 판매기가 넘어져 있으며 2년 전 손글씨 「운행 중지」 안내판이 있다. 케이블카 두 | CANON | L4190-L4276 §6 모르겠습니다 |
| EP04_SC008 | loc_namsan_observatory | STORY_CINEMATIC/INVESTIGATION |  | 반파된 전망대. 남은 난간에 수백 개의 사랑의 자물쇠가 유성펜 글씨(「우리 영원히」「2029.05.18」「엄마 아빠 사랑해요」 | CANON | L4277-L4379 §7 자물쇠 |
| EP04_SC009 | loc_namsan_observatory | BOSS_ENTRY | boss_celestial | 위에서 바람 소리가 바뀌고 하늘에 그림자가 지나간다. 셀레스티얼 — 인간형이 아니고, 등에서 뻗은 나노 강선 막(펼치면 약 4 | CANON | L4380-L4447 §8 안 내려온다 |
| EP04_SC010 | loc_namsan_observatory | BOSS_BATTLE | boss_celestial | 카인이 대검을 휘두르지만 닿지 않는다. 다시 들지만 부목 감은 오른손이 떨려 손가락 세 개로 62킬로를 받친다. 오정길은 총을 | CANON | L4448-L4527 §9 안 닿는다 |
| EP04_SC011 | loc_namsan_stairs | BOSS_RESULT/STORY_CINEMATIC | boss_celestial | 셋이 계단 아래로 내려가고 놈은 쫓아오지 않는다. 아인이 돌아보니 셀레스티얼이 막을 반쯤 접으며 천천히 내려와 매달린 넷 바로 | CANON | L4528-L4579 §10 거기 산다 |
| EP04_SC012 | loc_namsan_stairs | STORY_CINEMATIC |  | 계단을 내려오며 아인의 손이 떨리기 시작한다. 추위 탓인 줄 알았지만 손가락이 자루를 쥐지 못하고 힘이 빠져나간다. 낫을 떨어 | CANON | L4580-L4617 §11 업혀서 |
| EP04_SC013 | loc_bunker_infirmary | STORY_DIALOGUE |  | 아인이 낮은 콘크리트 천장, 물 자국이 번진 익숙한 의무실에서 깬다. 오른쪽 어깨가 겨드랑이 밑으로 지나는 붕대로 고정되어 있 | CANON | L4618-L4693 §12 자라는 그래프 |
| EP04_SC014 | loc_bunker_infirmary | STORY_DIALOGUE |  | 내일 또 가야 한다는 걸 아인은 안다. 닥터 진이 회색 액체가 든 손가락 두 마디 크기의 병 세 개를 책상에 올리며 '세 번  | CANON | L4694-L4753 §13 세 번(억제제) |
| EP04_SC015 | loc_bunker_corridor | STORY_CINEMATIC |  | 통로 벽에 기대 앉은 카인이 주머니 속 억제제 병과 자물쇠를 번갈아 움켜쥐고 굴린다. 자물쇠 고리에 손가락을 걸었다가 뺀다.  | CANON | L4754-L4781 §13 세 번(통로) |

### EP05 내려간다

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP05_SC001 | loc_bunker_training_ground | STORY_WALK/INVESTIGATION |  | 아무도 없는 훈련장. 아인이 붕대 때문에 느리게 낫을 들어 한 바퀴 돌리자 오른쪽 어깨에서 궤도가 멈춘다 — 힘은 있는데 신호 | CANON | L4856-L4926 §1 한 뼘 |
| EP05_SC002 | loc_bunker_mateo_table | STORY_DIALOGUE/TRANSITION |  | 마태오가 계산기를 두드리다 멈추고 '오늘도 간다고, 어제 그 꼴 나고?'라고 묻는다. 카인이 '…그러니까 가는 거죠'라고 답한 | CANON | L4927-L4956 §2 오늘도 |
| EP05_SC003 | loc_namsan_cablecar_station | STORY_WALK/INVESTIGATION |  | 승강장은 어제 그대로 — 유리 파편, 케이블카 두 대, 와이어에 걸린 넷. 하늘은 비어 있다. 셋은 흩어져 위치를 잡고 기다리 | CANON | L4957-L4994 §3 없다 |
| EP05_SC004 | loc_namsan_tower_lower | INVESTIGATION/STORY_CINEMATIC |  | 남산타워 하부 — 전망대 아래 층들, 유리가 다 깨져 바람이 통째로 지나가고, 식당이나 기념품점이었을 자리에 테이블이 넘어져  | CANON | L4995-L5046 §4 네 줄 |
| EP05_SC005 | loc_namsan_tower_lower | STORY_CINEMATIC |  | 아인이 거리를 재며 보폭을 옮기는데 하나가 위에서 떨어진다. 숨이 없다 — 큰 기술 직전의 들숨과 반 박자를 잡는 게 아인의  | CANON | L5047-L5102 §5 숨이 없다 |
| EP05_SC006 | loc_namsan_tower_b3 | STORY_DIALOGUE/INVESTIGATION |  | 지하 3층에서 계단이 끝나고 국방부 마크가 찍힌 철문이 있다. '군 시설이 왜 여기 있어' — 오정길이 타워는 원래 방송 시설 | CANON | L5103-L5151 §6 국방부 마크 |
| EP05_SC007 | loc_namsan_mnd_commroom | INVESTIGATION |  | 통신실. 벽을 따라 늘어선 콘솔은 대부분 죽어 있고 먼지가 두 마디쯤 쌓였으며 의자 하나가 넘어져 있다. 캐비닛의 서류철 중  | CANON | L5152-L5219 §7 같은 칸 |
| EP05_SC008 | loc_namsan_mnd_commroom | INVESTIGATION |  | 대장에는 수백 명(C, B, A…) 가운데 S가 있다. 아인이 세어 보니 S는 열한 명이고, 전부 기록이 2030년 2월에서  | CANON | L5220-L5323 §8 열한 명 |
| EP05_SC009 | loc_namsan_mnd_commroom | INVESTIGATION |  | 벽의 금속 상자들은 대부분 비어 완충재만 남았고 하나가 남아 있다 — 「출력전달 보조기 K-3 / 각인자 전용」. 가죽과 금속 | CANON | L5324-L5375 §9 K-3 |
| EP05_SC010 | loc_namsan_mnd_commroom | STORY_CINEMATIC |  | 아인이 낫을 내려놓고 장구를 찬다. 왼손으로만 해야 해서 오래 걸리고, 오정길이 뒤쪽 버클을 잠가준다. 등판 뼈대가 척추를 따 | CANON | L5376-L5393 §10 한 바퀴(착용) |
| EP05_SC011 | loc_namsan_tower_lower | STORY_CINEMATIC |  | 계단을 다시 오르자 드로퍼 넷이 기다리고 있다. 하나가 떨어지고 아인이 낫을 든다 — 한 바퀴가 다 돈다. 어깨가 안 움직이는 | CANON | L5394-L5467 §10 한 바퀴(교전) |
| EP05_SC012 | loc_namsan_cablecar_station | STORY_DIALOGUE |  | 승강장으로 돌아와도 하늘은 비어 있다. 카인이 '안 잡고 가요?'라고 묻는다. 서류철을 든 아인이 '카인'이라고 부르고, 어제 | CANON | L5468-L5547 §11 C는 없었어요 |
| EP05_SC013 | loc_namsan_cablecar_station | STORY_DIALOGUE/INVESTIGATION |  | 서류철 사이에 순찰 일정표 한 장 — 「남산 → 여의도 인수인계 / 진행 중」. 아인은 놈이 여기 돌아오지 않고 넘겨주러 갔다 | CANON | L5548-L5597 §12 넘겨주러 갔어요 |
| EP05_SC014 | loc_namsan_cablecar_station | STORY_CINEMATIC/INVESTIGATION |  | 아무도 시키지 않았는데 오정길이 와이어 쪽으로 걸어가, 몸째 걸린 넷을 오래 걸려 하나씩 내린다. 주머니에서 지갑, 사원증,  | CANON | L5598-L5631 §13 이름(와이어) |
| EP05_SC015 | loc_bunker_imprint_assessment | STORY_CINEMATIC |  | 벙커로 돌아와 오정길이 각인 평가소에 들러 유진 앞에 종이를 내려놓는다. '…와이어에 있던 사람들입니다. 네 명이요.' 유진은 | CANON | L5632-L5659 §13 이름(각인 평가소) |
| EP05_SC016 | loc_bunker_infirmary | STORY_CINEMATIC |  | 어깨가 재출혈해 아인이 의무실에 들르고 닥터 진이 붕대를 갈아준다. 그런데 그가 2년 동안 서던 자리(팔이 닿는 거리에서 한  | CANON | L5660-L5727 §13 이름(의무실) |
| EP05_SC017 | loc_bunker_corridor | STORY_CINEMATIC |  | 통로에서 카인이 벽에 기대 앉아 주머니 속 억제제 병과 자물쇠를 번갈아 움켜쥐고 굴린다. 이번에는 자물쇠에 손가락을 걸지 않는 | CANON | L5728-L5759 §13 이름(통로) |

### EP06 여의도 금융가의 유령들

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP06_SC001 | TBD_CANON | STORY_CINEMATIC/STORY_DIALOGUE |  | 홀로그램 위 여의도 브리핑. 마포·서강 다리는 끊기고 원효는 중간이 내려앉아 진입로가 없다. 배는 한강 아래 무엇이 있는지 몰 | TBD_CANON | L5882-L5927 §1 섬 |
| EP06_SC002 | loc_mateo_office | STORY_CINEMATIC/STORY_DIALOGUE |  | 마태오가 처음으로 계산기에서 손을 떼고 서랍에서 낡은 「여의도 지하 공동구 계통도 / 2021」을 꺼낸다. 전기·통신·상수도  | CANON | L5928-L5973 §2 도면 |
| EP06_SC003 | loc_yeouido_utility_tunnel | STORY_WALK |  | 공동구 입구는 지름 2미터 콘크리트 원통이고 발목까지 물이 차 있다. 아인이 먼저 소리를 듣지만 물 떨어지는 소리가 벽을 타고 | CANON | L5974-L6005 §3 방향이 안 잡힌다 |
| EP06_SC004 | loc_yeouido_parking | TRANSITION/STORY_WALK |  | 관로는 여의도 지하주차장에서 끝난다. B3·B2·B1이 찍힌 경사로를 따라 올라간다. | CANON | L6006-L6013 §4 안개 (지하주차장) |
| EP06_SC005 | loc_yeouido_fog_canyon | STORY_WALK |  | 지상은 빌딩 사이가 통째로 하얀 안개다. 스무 걸음 앞에서 세상이 끝난다. 아인이 멈춰 듣지만 빌딩 협곡의 유리벽 반향 때문에 | CANON | L6014-L6061 §4 안개 |
| EP06_SC006 | loc_yeouido_fog_canyon | STORY_WALK/INVESTIGATION |  | 안개 속에 빛이 번진 거대한 사람 형상이 보인다. 오정길이 총을 들지만 아인이 막는다. 가까이 가 보니 아직 돌아가는 3층 높 | CANON | L6062-L6123 §5 유령 |
| EP06_SC007 | loc_yeouido_fog_canyon | INVESTIGATION/STORY_DIALOGUE |  | 젖은 바닥에 두 시간 안쪽의 신발 발자국 — 보폭 좁고 발이 작고 뒤꿈치가 얕아 소리 없이 가볍게 뛴 자국이다. 따라가니 목  | CANON | L6124-L6214 §6 두 시간 안쪽 |
| EP06_SC008 | loc_yeouido_fog_canyon | BOSS_ENTRY/BOSS_BATTLE | boss_aegis_07 | 안개 속 낮은 구동음, 방향을 못 잡은 채 옆에서 '쿵' — 수도방위사령부 마크가 찍힌 4미터 다각 보행 병기가 나타나 정지한 | CANON | L6215-L6304 §7 안 보인다 |
| EP06_SC009 | loc_yeouido_fog_canyon | BOSS_BATTLE | boss_aegis_07 | 카인이 앞으로 나서고 놈이 상체 포문을 연다. 대검을 세로로 세우고 충돌 0.2초 전 출력을 전개하지만 반사가 되지 않는다.  | CANON | L6305-L6334 §8 스펀지 |
| EP06_SC010 | loc_yeouido_fog_canyon | BOSS_BATTLE | boss_aegis_07 | 셋이 흩어지고 안개 때문에 서로가 안 보인다. 카인의 목소리는 방향이 틀리게 들린다. 아인은 무엇을 재야 할지 모른다 — 거리 | CANON | L6335-L6374 §9 어디를 재나 |
| EP06_SC011 | loc_yeouido_fog_canyon | BOSS_BATTLE/BOSS_RESULT | boss_aegis_07 | 벽에 붙어 있던 오정길이 안개 저편, 놈의 뒤쪽에서 무언가 지나가는 것을 본다. 놈의 등에서 불꽃이 튀고 공기의 일렁임이 끊긴 | CANON | L6375-L6444 §10 불꽃 |
| EP06_SC012 | loc_bunker_corridor | STORY_CINEMATIC/STORY_DIALOGUE |  | 벙커로 돌아와 셋이 젖은 채 통로에 앉아 있다. 뒤에 있던 것이 뭐였냐는 물음에 아인은 대답하지 않고, 오정길은 사람 같기도  | CANON | L6445-L6496 §11 이회분 |
| EP06_SC013 | loc_mateo_office | STORY_DIALOGUE/STORY_CINEMATIC |  | 마태오가 도면을 접어 서랍에 넣으려는 참에 아인이 문 앞에 선다. 내일도 들어가야 하니 도면을 한 번 더 달라고 하고, 마태오 | CANON | L6497-L6546 §12 한 번 더 |

### EP07 소켓

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP07_SC001 | loc_bunker_corridor | STORY_DIALOGUE/STORY_CINEMATIC |  | 벙커 통로 벽에 공동구 도면과 4미터 다각 보행체의 뒷모습 손그림이 붙어 있다. 등 상부 동그라미 — 불꽃이 튄 자리이고 직후 | CANON | L6616-L6683 §1 켜져 있어야 보인다 |
| EP07_SC002 | loc_bunker_corridor | STORY_DIALOGUE/STORY_CINEMATIC |  | 아인이 도면 위에 앞·옆·뒤 셋을 그린다. 배리어는 전방향이 아니라 가장 큰 위협 쪽으로 쏠리고, 앞이 두꺼워지면 뒤가 얇아진 | CANON | L6684-L6729 §2 셋 |
| EP07_SC003 | loc_yeouido_fog_canyon | TRANSITION/STORY_WALK |  | 공동구를 나오니 안개가 어제보다 얕아 무릎 위가 트이고 쉰 걸음쯤 보인다. 아인이 멈춰 듣지만 소리는 여전히 안 잡힌다 — 보 | CANON | L6730-L6775 §3 절반 |
| EP07_SC004 | loc_yeouido_fog_canyon | INVESTIGATION |  | 젖은 바닥에 어제 것 위로 새 발자국이 겹쳐 있다. 보폭이 같다 — 같은 사람이 또 왔다. 발자국은 놈이 있는 쪽을 향한다. | CANON | L6776-L6801 §4 또 왔다 |
| EP07_SC005 | loc_yeouido_fog_canyon | BOSS_ENTRY/BOSS_BATTLE | boss_aegis_07 | 구동음과 함께 에이지스-07이 어제 끊긴 다리를 보정하며 절뚝이며 나온다. 공기가 일렁인다. 아인이 카인에게 정면을, 이번엔  | CANON | L6802-L6863 §5 이번엔 치세요 |
| EP07_SC006 | loc_yeouido_fog_canyon | BOSS_BATTLE | boss_aegis_07 | 아인이 측면에서 들어가자 놈의 상체가 돌아가며 등이 열린다. 그러나 뒤에는 아무도 없다. 셋이 필요했는데 둘밖에 없었다. 놈이 | CANON | L6864-L6896 §6 아무도 없다 |
| EP07_SC007 | loc_yeouido_fog_canyon | STORY_DIALOGUE/STORY_CINEMATIC |  | 빌딩 그림자 쪽에서 '셋이면 되겠네' 하는 목소리. 방향은 안 잡히고, 스물 안팎의 후드 쓴 마른 청년이 양손에 얇은 날을 하 | CANON | L6897-L6990 §7 셋이면 되겠네 |
| EP07_SC008 | loc_yeouido_fog_canyon | BOSS_BATTLE | boss_aegis_07 | 셋이 흩어진다. 카인이 정면, 아인이 측면, 류는 보이지 않고 목소리만 온다. 카인이 세게 정면을 치자 정면이 두꺼워지고, 아 | CANON | L6991-L7052 §8 열린다 |
| EP07_SC009 | loc_yeouido_fog_canyon | BOSS_BATTLE | boss_aegis_07 | 아인의 발이 한 뼘 안쪽에서 멈춘다. 놈이 팔을 든다. 숨, 세상이 늘어지고, 반 박자. 배리어가 없다 — 네 번째. 넷이 맞 | CANON | L7053-L7100 §9 넷 |
| EP07_SC010 | loc_yeouido_fog_canyon | BOSS_RESULT/STORY_CINEMATIC |  | 류가 어디를 뒤져야 하는지 아는 익숙한 걸음으로 잔해에 가 소켓 단면에서 큰 파편만 셋 골라낸다. 하나를 아인 쪽으로 던지며  | CANON | L7101-L7126 §10 삼분의 일 |
| EP07_SC011 | loc_yeouido_fog_canyon | STORY_DIALOGUE |  | 아인이 벙커로 오라고, 등록하면 의뢰를 받을 수 있다고 한다. 류는 목을 아까보다 길게 만지며 등급을 받으면 표시가 나지 않느 | CANON | L7127-L7192 §11 표시가 나잖아요 |
| EP07_SC012 | loc_yeouido_fog_canyon | STORY_DIALOGUE/STORY_CINEMATIC |  | 류가 돌아서며 넷은 밥이 두 배라고 말하고 안개 쪽으로 걸어간다. 아인이 이름을 묻자 돌아보지 않고 '류요'라고 답한다. | CANON | L7193-L7220 §12 류 |
| EP07_SC013 | loc_bunker_infirmary | STORY_CINEMATIC |  | 벙커 의무실에서 닥터 진이 오늘도 등부터 아인의 어깨를 본다. 건넨 처방 종이의 글씨는 획 끝이 아래로 꺾여 있다. 아인은 종 | CANON | L7221-L7240 §13 승급은 없다 (의무실) |
| EP07_SC014 | loc_bunker_corridor | STORY_CINEMATIC/ANIMATION_ONLY |  | 통로에 카인이 벽에 기대 앉아 있고, 아인이 처음으로 그 옆에 앉는다. 아무 말도 하지 않는다. 통로 저편에서 오정길은 쏘지도 | CANON | L7241-L7282 §13 승급은 없다 (통로) |

### EP08 한 번

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP08_SC001 | loc_bunker_control_room | STORY_CINEMATIC/STORY_DIALOGUE |  | 관제실의 가장 오래된 계측기가 사흘째 완만하게, 단 한 번도 꺾이지 않고 오르기만 하는 선을 긋는다. 지역명은 한강 침수 터널 | CANON | L7351-L7385 §1 꺾이지 않는 선 |
| EP08_SC002 | TBD_CANON | STORY_DIALOGUE/STORY_CINEMATIC |  | 편성에 강 씨(52세, 재난 전 하수도 정비 20년, 벙커 8개월째)가 붙는다. 그는 물이 차면 터널이 딴 데가 되어 위아래가 | TBD_CANON | L7386-L7407 §2 물을 아는 사람 |
| EP08_SC003 | loc_hangang_tunnel_entrance | STORY_CINEMATIC/STORY_DIALOGUE |  | 터널 입구에서 오정길이 망설임 없이 기둥에 윈치를 고정한다. 케이블 길이는 팔십, 그 이상은 못 당긴다. 그는 허리춤의 총을  | CANON | L7408-L7425 §3 윈치와 총 |
| EP08_SC004 | loc_hangang_flooded_tunnel | STORY_WALK |  | 300m 지점부터 물이 허리·가슴·어깨로 차오른다. 넷은 헤드램프를 방수포로 싸고 케이블을 허리에 묶는다. 강 씨가 앞에서 발 | CANON | L7426-L7445 §4 물의 안쪽 |
| EP08_SC005 | loc_hangang_flooded_tunnel | BOSS_ENTRY/BOSS_BATTLE | boss_hangang_tunnel_creature | 500m 지점에서 물결이 크게 흔들린다. 아인이 파동 방향을 오른쪽으로 짚고 정확한 각도로 낫을 돌리지만 놈은 왼쪽에서 온다. | CANON | L7446-L7479 §5 소리가 거짓말을 한다 |
| EP08_SC006 | loc_hangang_flooded_tunnel | BOSS_BATTLE/STORY_CINEMATIC | boss_hangang_tunnel_creature | 두 번째 접촉에서 머리 앞 격자가 열리며 물을 빨아들이고, 류가 끌려가다 벽에 단검을 박아 버티지만 왼쪽 다리가 격자 가장자리 | CANON | L7480-L7536 §6 물결이 멎는다 |
| EP08_SC007 | loc_hangang_tunnel_entrance | STORY_CINEMATIC |  | 셋이 입구 밖으로 끌려 나오고 오정길이 윈치를 잠그고 달려와 두 번 센다. 물가에서 물에 절어 색 빠진 전투복·군화·명찰의 무 | CANON | L7537-L7564 §7 군복 |
| EP08_SC008 | loc_hangang_tunnel_entrance | STORY_CINEMATIC/STORY_DIALOGUE |  | 그날 밤 넷은 입구 바깥에서 불을 피우지 않는다. 카인은 담배를 꺼냈다 도로 넣고, 류는 다리 상처를 천으로 감고, 오정길은  | CANON | L7565-L7594 §8 셀 수 없는 것 |
| EP08_SC009 | TBD_CANON | STORY_DIALOGUE/INVESTIGATION |  | 이튿날 아침 오정길이 강 씨 배낭에서 나온 하수 계통도를 가져온다. 여백에 연필로 '차수문 3-B. 작동 여부 미상.' 오정길 | TBD_CANON | L7595-L7634 §9 경첩이 아니라 밸브 |
| EP08_SC010 | loc_hangang_flooded_tunnel | BOSS_BATTLE | boss_hangang_tunnel_creature | 차수문 3-B는 도면상 600m, 놈의 영역 한가운데라 목표는 이기는 것이 아니라 지나가는 것이다. 그날 오후 넷이 다시 들어 | CANON | L7635-L7660 §10 한 번 더 |
| EP08_SC011 | loc_hangang_flooded_tunnel | BOSS_BATTLE | boss_hangang_tunnel_creature | 놈이 궤도를 트는 순간 옆구리에서 부채 같은 것이 좌우 한 쌍 펼쳐져 물을 밀어 방향을 바꾼다. 류가 수면 위로 올라와 외치고 | CANON | L7661-L7694 §11 아가미 |
| EP08_SC012 | loc_hangang_tunnel_entrance | BOSS_RESULT/STORY_DIALOGUE | boss_hangang_tunnel_creature | 물은 붉어지지 않는다. 놈은 방향을 틀 때마다 한 박자가 더 걸리고 벽에 두 번 부딪히다 터널 안쪽으로 물러난다. 쫓지 않고  | CANON | L7695-L7734 §12 물러난다 |
| EP08_SC013 | loc_yujin_evaluation_office | STORY_CINEMATIC/ANIMATION_ONLY |  | 그날 밤 유진의 평가소. 원정 보고서 — 참가 다섯, 귀환 넷. 유진은 이름 넷을 적고 다섯 번째 줄에서 펜을 멈춘다. 8개월 | CANON | L7735-L7776 §13 내려앉지 못하는 펜 |

### EP09 제9화 — 격벽

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP09_SC001 | loc_bunker_ration_line | STORY_CINEMATIC/STORY_WALK |  | 배급 줄 끝의 후드 쓴 류가 '미등록은 한 그릇' 규칙을 듣고, 계산 끝에 평가소로 걸어간다. | CANON | L7778-L7808 §1 두 그릇 (배급 줄) |
| EP09_SC002 | loc_bunker_assessment_office | STORY_CINEMATIC |  | 유진이 류를 계측하고 성 없는 이름 '류'로 C랭크 등록한다. 류는 인식표를 목에 걸지 않고 주머니에 넣고, 유진은 묻지 않는 | CANON | L7809-L7838 §1 두 그릇 (평가소 등록) |
| EP09_SC003 | loc_bunker_cafeteria | STORY_CINEMATIC |  | 류가 식당에서 두 그릇을 조용히 빠르게 비우고, 건너편 카인이 한마디 던지지만 아무도 대꾸하지 않는다. | CANON | L7839-L7853 §1 두 그릇 (식당) |
| EP09_SC004 | loc_bunker_tactical_table | INVESTIGATION/STORY_CINEMATIC |  | 아인은 어제의 터널 도면 위에서 몸이 없는 놈을 잴 곳을 찾지 못하다가, 터널의 양 끝을 재기로 하고 차수문 위치에 동그라미  | TBD_CANON | L7854-L7879 §2 출구에 그리는 동그라미 |
| EP09_SC005 | loc_bunker_tactical_table | STORY_DIALOGUE |  | 오정길이 차수문은 고정핀을 뽑으면 평형추가 끌어내린다고 설명하고, 아인은 두 문이 거의 동시에 떨어져야 한다며 무전 대신 배관 | CANON | L7880-L7919 §3 문지기 |
| EP09_SC006 | loc_bunker_control_room | STORY_DIALOGUE |  | 관제실 그래프가 계속 오른다. 터널이 좁아지면 놈이 한강으로 나갈 것이라는 판단 앞에서 마태오가 고개를 끄덕여 승인한다. | TBD_CANON | L7920-L7939 §4 창 |
| EP09_SC007 | loc_hangang_tunnel_entrance | STORY_CINEMATIC/TRANSITION |  | 수위가 가슴께까지 온 터널 입구에서 넷이 갈라진다(내측 류, 외측 아인, 물 한가운데 카인, 입구 윈치 오정길). 카인이 미끼 | CANON | L7940-L7959 §5 미끼 (입구) |
| EP09_SC008 | loc_hangang_flooded_tunnel | BOSS_ENTRY | boss_hangang_tunnel_nom | 물 한가운데서 카인이 대검으로 수면을 거듭 내리쳐 진동을 퍼뜨리고, 터널 안쪽에서 낮은 울음이 대답한다. | CANON | L7960-L7973 §5 미끼 (수면 타격) |
| EP09_SC009 | loc_hangang_tunnel_outer_machine_room | BOSS_ENTRY | boss_hangang_tunnel_nom | 외측 기계실에서 아인이 눈을 감고 고정핀 위에 낫날을 댄 채 소리의 지도를 듣는다. 물살이 안에서 밖으로 방향을 바꾸고, 카인 | CANON | L7974-L7998 §6 귀 |
| EP09_SC010 | loc_hangang_tunnel_outer_machine_room | BOSS_BATTLE | boss_hangang_tunnel_nom | 질량이 카인의 지점을 지나 내측 차수문 라인을 넘자, 아인이 눈을 뜨고 낫자루로 배관을 두 번 때린다. | CANON | L7999-L8013 §7 두 번 두드리면 (신호) |
| EP09_SC011 | loc_hangang_tunnel_inner_machine_room | BOSS_BATTLE | boss_hangang_tunnel_nom | 내측 기계실의 류가 배관으로 두 번의 진동을 받고, 쌍단검을 교차해 고정핀 두 개를 동시에 자른다. 평형추가 떨어지고 내측 차 | CANON | L8014-L8034 §7 두 번 두드리면 (내측 차수문) |
| EP09_SC012 | loc_hangang_flooded_tunnel | BOSS_BATTLE | boss_hangang_tunnel_nom | 반 박자의 정적 뒤, 문이 닫힌 것을 안 덩어리가 돌아서고 터널의 물 전체가 해일이 되어 외측으로 밀려온다. 출구는 하나, 카 | CANON | L8035-L8052 §8 돌아서는 물 (해일) |
| EP09_SC013 | loc_hangang_tunnel_outer_machine_room | BOSS_BATTLE | boss_hangang_tunnel_nom | 외측 기계실의 아인은 핀 위에 낫날을 댄 채 카인의 위치와 놈의 위치, 두 거리를 동시에 잰다. 지금 베면 카인이 못 나오고, | CANON | L8053-L8066 §8 돌아서는 물 (두 거리) |
| EP09_SC014 | loc_hangang_tunnel_outer_machine_room | BOSS_BATTLE | boss_hangang_tunnel_nom | 카인이 문턱 아래로 미끄러져 통과한다. 베려는 순간, 갈라진 물 사이로 비상등 빛이 놈의 내부를 관통하고 눈 감은 여러 얼굴이 | CANON | L8067-L8098 §9 얼굴과 손 |
| EP09_SC015 | loc_hangang_tunnel_outer_machine_room | BOSS_RESULT | boss_hangang_tunnel_nom | 외측 차수문이 낙하해 문턱을 넘어 뻗은 놈의 앞부분을 끊는다. 끊긴 것은 코어도 파편도 남기지 않고 형태를 잃는다. 문 너머에 | CANON | L8099-L8128 §10 한 번 |
| EP09_SC016 | loc_surface_return_route | TRANSITION/STORY_CINEMATIC |  | 귀환은 지상으로 한다. 오정길이 지도의 터널 경로에 X를 긋고, ⑤구역은 이제 지상으로 돌아가야 해 사흘 길이 열흘이 됐다고  | CANON | L8129-L8140 §11 수평선 (귀환길) |
| EP09_SC017 | loc_bunker_control_room | STORY_DIALOGUE |  | 관제실 계측기 앞에서 그래프가 오르지도 내려오지도 않고 수평이다. 끝난 거냐는 물음에 아인은 멈춘 것이라고 답한다. | TBD_CANON | L8141-L8160 §11 수평선 (관제실) |
| EP09_SC018 | TBD_CANON | STORY_CINEMATIC |  | 류는 의뢰비 지분을 세지 않고 인식표가 든 주머니에 넣고, 목을 한 번 만진 뒤 배급 줄이 아니라 어둠 쪽으로 걸어간다. | TBD_CANON | L8161-L8170 §12 서로 아는 것 (류) |
| EP09_SC019 | loc_bunker_corridor | STORY_CINEMATIC |  | 통로에서 벽에 기댄 카인과 지나가던 아인이 서로를 본다. 둘 다 물속의 얼굴을 봤다는 것을 서로 알고, 말없이 아인이 다시 걷 | CANON | L8171-L8188 §12 서로 아는 것 (통로) |
| EP09_SC020 | TBD_CANON | STORY_CINEMATIC |  | 카인이 담배에 불을 붙여 반만 태우고 비벼 끄고 주머니에 넣는다. 문 너머에 남긴 것들을 생각하지 않으려 한다. | TBD_CANON | L8189-L8204 §13 접는 도면 (카인) |
| EP09_SC021 | loc_bunker_tactical_table | STORY_CINEMATIC |  | 전술 테이블에 혼자 남은 아인이 동그라미 두 개가 그려진 도면을 버리지 않고 두 번 접어 서랍에 넣는다. 다음 화 예고: 사흘 | CANON | L8205-L8236 §13 접는 도면 (전술 테이블) |

### EP10 제10화 — 지상의 것들

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP10_SC001 | loc_bunker_infirmary | STORY_CINEMATIC/STORY_DIALOGUE |  | 닥터 진이 억제제 두 병의 빈 라벨에 획 끝이 아래로 꺾이는 글씨로 용량을 적어 열흘 치를 건넨다. 다음 것은 없을 수도 있다 | CANON | L8237-L8270 §1 획 (의무실) |
| EP10_SC002 | loc_bunker_control_room | STORY_DIALOGUE |  | 관제실 벽 지도에 터널을 크게 돌아가는 남태령 방면 경로선이 그려져 있다. 마태오가 열흘 전부터 교신이 끊긴 남태령 중계소 확 | CANON | L8271-L8288 §1 획 (관제실 브리핑) |
| EP10_SC003 | loc_namtaeryeong_national_road | STORY_WALK |  | 넷이 멈춘 차들이 줄지어 선 왕복 8차선 국도와 반쯤 내려간 요금소를 걸어서 지난다. 카인은 「예약 만석」 버스를 보고 중얼거 | CANON | L8289-L8322 §2 열흘 |
| EP10_SC004 | loc_namtaeryeong_national_road | INVESTIGATION/STORY_CINEMATIC |  | 오정길이 가드레일 사이 무릎 높이의 낚싯줄 깡통 경보기를 발견하고, 사람이 묶은 것이라 판단한다. 류가 줄을 넘다 배낭 끈이  | CANON | L8323-L8356 §3 깡통 |
| EP10_SC005 | loc_namtaeryeong_national_road | STORY_CINEMATIC |  | 클레이브 두 기가 순찰 보폭으로 들어온다. 아인은 두 기체가 여섯 걸음마다 신호를 주고받는 것을 듣고, 신호 사이에 끊어야 한 | TBD_CANON | L8357-L8396 §4 간격 |
| EP10_SC006 | loc_namtaeryeong_national_road | STORY_CINEMATIC |  | 정적이 돌아온다. 카인의 대검 날 위의 금이 가드 반동으로 한 마디 길어졌지만 카인은 모른다. 아인이 무너진 기체에서 아직 따 | CANON | L8397-L8414 §5 금 |
| EP10_SC007 | loc_namtaeryeong_national_road | STORY_CINEMATIC |  | 군복과 사복이 섞인 마른 사람들이 쇠파이프·정글도·낡은 대검을 들고 나오고, 맨 앞 남자가 소총을 겨눈다. 카인이 그 총은 안 | CANON | L8415-L8441 §6 총 |
| EP10_SC008 | loc_namtaeryeong_national_road | STORY_DIALOGUE |  | 맨 앞의 사십 대 부사관 출신 남자가 소속과 인식표를 묻는다. 카인과 아인은 C를 보이지만 류의 목이 비어 있어 공기가 좁아진 | TBD_CANON | L8442-L8473 §7 안 나가는 총 |
| EP10_SC009 | loc_namtaeryeong_national_road | STORY_DIALOGUE |  | 남자가 터널 쪽에서 온 그들에게 현 중위를 못 봤냐고 묻는다. 아인은 터널 안의 군복을 물 밖에 눕혀 놨는데 돌아올 때는 없었 | TBD_CANON | L8474-L8529 §8 중위님 |
| EP10_SC010 | loc_namtaeryeong_relay_station | INVESTIGATION |  | 남태령 고개 능선의 철탑 아래 중계소 문이 열려 있다. 내부는 의자·컵·담요까지 가지런하고, 싸운 흔적도 도망친 흔적도 없다. | TBD_CANON | L8530-L8551 §9 중계소 |
| EP10_SC011 | loc_namtaeryeong_relay_station | INVESTIGATION/FLASHBACK |  | 통신 책상의 교신 기록부는 마지막 기재가 문장 중간에서 끊겨 있고, 그 위 칸에 '등급 명단 재송부 바람. B 이상 우선.'이 | CANON | L8552-L8577 §10 명단 |
| EP10_SC012 | loc_namtaeryeong_relay_station | STORY_DIALOGUE |  | 나서는 길 문가에서 서 하사가 밤에 불을 피우지 말라고, 놈들이 아니라 사람이 본다고 말한다. '지상의 것들'의 뜻이 괴물에서 | CANON | L8578-L8593 §11 불 피우지 마시오 |
| EP10_SC013 | loc_abandoned_gas_station | STORY_CINEMATIC |  | 고개 아래 폐주유소에서 넷은 불 없이 야영한다. 카인은 불빛 때문에 담배를 도로 넣고, 오정길은 어둠 속에서 쏘지 못하는 총을 | CANON | L8594-L8605 §12 스물 (야영) |
| EP10_SC014 | loc_abandoned_gas_station | STORY_CINEMATIC |  | 아인이 도로 쪽 발소리에 깬다. 스무 개의 발소리가 전부 같은 보폭으로, 랜턴도 말소리도 없이 무언가를 나르며 능선 아래 도로 | TBD_CANON | L8606-L8627 §12 스물 (행렬) |
| EP10_SC015 | loc_abandoned_gas_station | STORY_CINEMATIC |  | 행렬이 사라진 뒤에도 아인은 남쪽을 오래 본다. 품의 교신 기록부, 등급 명단, 훈련된 보폭 — 조각들이 모두 남쪽을 가리킨다 | CANON | L8628-L8660 §13 남쪽 |

### EP11 제11화 — 표식

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP11_SC001 | loc_deserter_hideout | STORY_DIALOGUE |  | 과천 방면 고가 아래 탈영병 은신처. 아인이 교신 기록부를 바닥에 놓자 서 하사가 자신들의 임무가 남쪽으로의 민간인 도보 이송 | CANON | L8661-L8708 §1 절반의 증언 |
| EP11_SC002 | loc_south_national_road | STORY_WALK/INVESTIGATION |  | 용병 넷과 탈영병 넷이 낮의 국도를 한 줄로 걷는다. 아인이 갓길 발자국의 보폭을 손뼘으로 재어 자로 잰 듯 같음을 확인하고, | CANON | L8709-L8724 §2 보폭을 따라 |
| EP11_SC003 | loc_roadside_village | INVESTIGATION |  | 국도변 빈 마을의 대문마다 분필 등급 표기(「B1 · C3」, 「C2」)가 있고, 어떤 표기에는 완료를 뜻하는 반듯한 가로줄이 | CANON | L8725-L8748 §3 분필 |
| EP11_SC004 | loc_scrapyard_ridge | STORY_CINEMATIC/INVESTIGATION |  | 해질녘, 여덟이 능선의 폐버스 뒤에 엎드려 폐차장 공터를 내려다본다. 방호복 십수 명과 줄 선 사람 서른쯤 — 아무도 묶이지  | CANON | L8749-L8768 §4 집결지 |
| EP11_SC005 | loc_scrapyard_ridge | STORY_CINEMATIC |  | 방호복 하나가 벙커 것보다 새것인 휴대 계측기를 사람들 목덜미에 댄다. 표시가 뜨면 오른쪽 줄, 안 뜨면 왼쪽 줄. 짧은 오른 | TBD_CANON | L8769-L8782 §5 계측 |
| EP11_SC006 | loc_scrapyard_ridge | STORY_CINEMATIC |  | 공터 안쪽 어둠에서 금속 관절음이 나고 여덟은 습격이라 여겨 무기에 손을 댄다. 그러나 방호복들은 비키지 않고, 클레이브 두  | CANON | L8783-L8809 §6 표식 |
| EP11_SC007 | loc_scrapyard_ridge | STORY_CINEMATIC |  | 전투복에 마스크를 쓴 장교가 클레이브 옆구리를 가축 다루듯 두 번 치자, 클레이브가 오른쪽 줄 선두로 가 앞장선다. '회수 계 | CANON | L8810-L8827 §7 복종 |
| EP11_SC008 | loc_scrapyard_lot | STORY_CINEMATIC |  | 정 일병이 오른쪽 줄에서 누나를 보고 능선을 뛰어 내려간다. 공터가 뒤집히고 나머지 일곱도 뛰어든다. 아인은 방호복들을 날이  | TBD_CANON | L8828-L8853 §8 먼저 뛴 사람 |
| EP11_SC009 | loc_scrapyard_lot | STORY_CINEMATIC |  | 구출된 노인·여자·아이 셋의 퇴로를 클레이브가 막고 아이가 넘어진다. 카인이 금 간 대검으로 완벽한 가드를 세워 일격을 버티지 | TBD_CANON | L8854-L8881 §9 무릎 |
| EP11_SC010 | loc_deserter_hideout | STORY_CINEMATIC |  | 불 없는 밤의 은신처. 구출된 셋은 담요를 받고 말이 없다. 서 하사는 데려온 수와 두고 온 수를 꼽다 주먹을 쥐고, 오정길은 | TBD_CANON | L8882-L8899 §10 값 |
| EP11_SC011 | loc_deserter_hideout | STORY_CINEMATIC |  | 카인이 부축을 뿌리치고 일어서려다 기울자 대검 날을 땅에 꽂고 자루를 짚고 선다. 대검은 지팡이가 되었고, 날의 금은 뿌리까지 | CANON | L8900-L8921 §11 지팡이 |
| EP11_SC012 | loc_deserter_hideout | STORY_DIALOGUE/FLASHBACK |  | 아무도 묻지 않았을 때 서 하사가 나머지를 말한다. 작년 겨울 인계 지점이 얼어 예정보다 남쪽까지 갔다가 철책을 봤고, 안으로 | TBD_CANON | L8922-L8941 §12 증언의 나머지 |
| EP11_SC013 | loc_deserter_hideout | STORY_CINEMATIC/STORY_DIALOGUE |  | 아인이 교신 기록부와 류가 주워 온 군 마크 휴대 계측기를 바닥에 놓는다. 조각들이 하나의 그림이 된다. 대검을 짚고 온 카인 | CANON | L8942-L8978 §13 명명 |

### EP12 제12화 — 우선

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP12_SC001 | loc_return_road_to_bunker | STORY_WALK |  | 돌아가는 길은 사흘. 카인이 대검을 짚고 걷는 박자에 열 명의 걸음이 맞춰지고, 구출된 아이가 사흘 내내 카인 곁에서 걷는다. | CANON | L8979-L9002 §1 박자 |
| EP12_SC002 | loc_bunker_sortie_gate | STORY_DIALOGUE/STORY_CINEMATIC |  | 벙커 출격문이 보이는 곳에서 서 하사 일행 셋이 멈춘다. 벙커는 명단이 있는 곳이라 들어가지 않겠다는 서 하사는 보급 꾸러미를 | CANON | L9003-L9024 §2 명단이 있는 곳 |
| EP12_SC003 | loc_bunker_infirmary | STORY_DIALOGUE |  | 닥터 진이 카인의 무릎을 두 번 굽혀 보고, 인대가 아니라 관절이며 앞으로는 이 다리로 사는 법을 배워야 한다고 말한다. 카인 | CANON | L9025-L9042 §3 선고 (의무실) |
| EP12_SC004 | loc_bunker_corridor | STORY_CINEMATIC |  | 복도 게시판 공고문에 '사신 용병단, 금일 부로 B등급 승격. 금일 저녁 각인 평가소.'가 적혀 있다. 카인의 얼굴이 무릎도  | CANON | L9043-L9050 §3 선고 (게시판) |
| EP12_SC005 | loc_bunker_assessment_office | STORY_CINEMATIC |  | 저녁 각인 평가소 앞에 사람들이 모인다. 유진이 두 사람을 계측해 안정 범위, B등급을 선언하고 각인기가 새 인식표에 B를 박 | TBD_CANON | L9051-L9078 §4 경사 |
| EP12_SC006 | loc_bunker_cafeteria | STORY_CINEMATIC/STORY_DIALOGUE |  | 식당의 조촐한 잔치. 구출된 셋도 끼어 앉고, 카인은 실내라 담배를 못 피운다고 투덜대며, 두호는 구출된 아이에게 반찬을 옮겨 | CANON | L9079-L9134 §5 웃는 날 |
| EP12_SC007 | loc_bunker_control_room | STORY_DIALOGUE |  | 밤, 문이 닫힌 관제실에 마태오·아인·카인과 배석한 유진이 있다. 아인이 교신 기록부와 군 마크 휴대 계측기를 놓고 본 것만  | CANON | L9135-L9159 §6 닫힌 문 |
| EP12_SC008 | loc_bunker_control_room | STORY_CINEMATIC |  | 마태오는 놀라지 않는다. 이 년 동안 어긋나 있던 숫자들 — 돌아오지 않은 용병들, B와 A만 비던 자리들 — 이 맞아 들어가 | TBD_CANON | L9160-L9179 §7 아귀 |
| EP12_SC009 | loc_bunker_control_room | STORY_CINEMATIC |  | 마태오가 무전실 쪽 창을 열고 박 씨에게 격주 정기 현황 보고를 오늘부로 중지하고 수신만 하라고 한다. 무전수의 손이 송신 스 | CANON | L9180-L9197 §8 믿는 방식 |
| EP12_SC010 | loc_bunker_control_room | STORY_DIALOGUE |  | 마태오는 이 이야기를 당분간 방 밖으로 내지 않겠다고 한다. 카인이 반발하지만, 등급은 배급표이자 질서이며 무너뜨린 다음 날  | CANON | L9198-L9225 §9 함구 |
| EP12_SC011 | loc_bunker_control_room | STORY_DIALOGUE |  | 배석한 유진이 일어나 문가에서 돌아보며, 기록은 계속하되 전파를 타지 않는 종이로만 하겠다고 말하고 문을 닫는다. | CANON | L9226-L9243 §10 종이 |
| EP12_SC012 | loc_bunker_corridor | STORY_CINEMATIC |  | 취침 시간 복도에서 두호가 구출된 아이에게 담요 접는 법을 가르치고 함께 접은 뒤, 제 자리 옆 바닥을 두 번 두드려 여기서  | CANON | L9244-L9257 §11 두 아이 |
| EP12_SC013 | loc_bunker_rooftop_vent | STORY_CINEMATIC |  | 옥상 환기구 옆에서 카인이 담배를 반만 태우고 끈다. 벽에 기댄 대검 지팡이의 자루에 새 B 인식표가 걸려 있다. 저녁부터 목 | CANON | L9258-L9271 §12 자루에 건 것 |
| EP12_SC014 | loc_ain_seat | STORY_CINEMATIC |  | 어두운 자리에서 아인은 손바닥의 새 B 인식표와 교신 기록부의 'B 이상 우선'을 나란히 놓는다. 같은 글자가 한쪽에선 축하, | TBD_CANON | L9272-L9310 §13 우선 |

### EP13 제13화 — 두드림

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP13_SC001 | loc_bunker_children_area | STORY_DIALOGUE |  | 낮의 아이들 구역에서 구출된 아이가 두호에게 폐차장의 일 — 삑 소리, 줄 서기, 좌우 분류 — 을 이야기한다. 기계를 목에  | CANON | L9311-L9338 §1 아이들의 말 (낮) |
| EP13_SC002 | loc_bunker_children_area | STORY_CINEMATIC |  | 저녁, 두호는 건강해진 동생 두나 곁에 앉아 이마를 한 번 보고, 결심한 걸음으로 일어선다. | TBD_CANON | L9339-L9346 §1 아이들의 말 (저녁) |
| EP13_SC003 | loc_bunker_equipment_maintenance | STORY_DIALOGUE |  | 장비 정비 구역에서 낫날을 손질하던 아인 앞에 두호가 한참 서 있다가, 아무도 안 믿었던 얘기를 해도 되냐고 묻는다. 아인은  | CANON | L9347-L9358 §2 아무도 안 믿었던 얘기 (정비 구역) |
| EP13_SC004 | loc_bunker_children_area | TRANSITION |  | 이야기는 두나의 침상 옆에서 이뤄진다. 두호는 동생이 자는 옆에서만 말하겠다고 하고, 아인은 이유를 묻지 않고 아이의 눈높이로 | CANON | L9359-L9362 §2 아무도 안 믿었던 얘기 (두나의 침상 옆) |
| EP13_SC005 | loc_flashback_2030_street | FLASHBACK |  | 두호의 회상. 군인이 와서 다들 살았다고 했다. 젖은 아스팔트 위 군화들 앞에 어른들이 줄을 섰고, 장갑 낀 손이 목덜미에 기 | TBD_CANON | L9363-L9384 §3 2030년 |
| EP13_SC006 | loc_bunker_children_area | STORY_DIALOGUE |  | 두호는 이 년 전 강남역 지하상가에서 철근을 들고 튀어나온 것이 아인 일행을 군인으로 알았기 때문이라고 고백한다. 괴물과 군인 | CANON | L9385-L9412 §4 철근 |
| EP13_SC007 | loc_bunker_children_area | STORY_DIALOGUE |  | 아인이 침상 철제 프레임을 손가락 등으로 한 번 치고, 한 번이면 기다리고 두 번이면 어디 있어도 자기가 간다고 신호를 건넨다 | CANON | L9413-L9434 §5 두드림 |
| EP13_SC008 | loc_bunker_control_room | STORY_DIALOGUE |  | 남쪽 의뢰의 공식 명분은 남부 교역로 개척으로 공지되지만, 관제실 지도에는 서 하사 증언에 따른 인계 지점 추정 위치 세 곳이 | CANON | L9435-L9448 §6 목숨값 (관제실) |
| EP13_SC009 | loc_bunker_sortie_gate | STORY_CINEMATIC/TRANSITION |  | 출격문 앞 배웅 인파 맨 앞에서 두호가 두나의 손을 잡고, 주먹으로 허공에 두 번 두드리는 시늉을 한다. 아인은 한 번 끄덕인 | CANON | L9449-L9467 §6 목숨값 (출격문) |
| EP13_SC010 | loc_south_road_junctions | STORY_WALK/INVESTIGATION |  | 남행 이틀째부터 폐허가 더 오래돼 보이고 안개가 붉어진다. 전신주 아래 서 하사의 표식이 바로 서 있고 오정길은 사흘 안쪽에  | TBD_CANON | L9468-L9497 §7 표식을 따라 |
| EP13_SC011 | TBD_CANON | STORY_DIALOGUE |  | 과천을 지나 이틀째 저녁, 아인이 닥터 진이 준 열두 줄 약품 목록을 꺼낸다. 약 만드는 재료이며 가져오면 만들 사람이 있고, | TBD_CANON | L9498-L9531 §8 목록 |
| EP13_SC012 | loc_soundwall_camp | STORY_CINEMATIC |  | 방음벽 아래 야영지에서 아인의 목덜미 코어가 평소보다 밝고 빠르게 뛰고, 낫을 쥔 손끝이 처음으로 떨린다. 아인은 등을 돌려  | TBD_CANON | L9532-L9547 §9 반응 |
| EP13_SC013 | loc_pangyo_streets | STORY_WALK/INVESTIGATION |  | 나흘째 아침 판교에 들어선다. 건물이 온전하고 나무가 인도를 덮은, 정리하고 떠난 자리 같은 폐허다. 류가 너무 멀쩡하다고 하 | CANON | L9548-L9569 §10 정리하고 떠난 자리 |
| EP13_SC014 | loc_pangyo_sealed_building | INVESTIGATION |  | 세 번째 건물 유리문의 반쯤 삭은 A4 공지에 '내부 인원 전원 대피 완료. 지하 3층 봉인.'이 남아 있다. 카인이 봉인은  | TBD_CANON | L9570-L9597 §11 봉인 |
| EP13_SC015 | loc_pangyo_sealed_building | INVESTIGATION |  | 아인이 콘크리트 틈에 손을 넣자 이 년간 닫힌 지하에서 차가워야 할 공기가 미지근하게 나온다. 류는 시약 창고일 거라 하지만, | CANON | L9598-L9623 §12 미지근한 공기 |
| EP13_SC016 | loc_pangyo_sealed_building | STORY_CINEMATIC/INVESTIGATION |  | 넷은 들어가는 것을 아침으로 미루고 건물 밖에서 야영한다. 경계를 서던 아인이 건물 벽을 한 번 치자 되돌아온 소리가 벽 안쪽 | TBD_CANON | L9624-L9678 §13 두 개의 두드림 |

### EP14 봉합

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP14_SC001 | loc_gangnam_bunker | STORY_DIALOGUE |  | 닥터 진이 만년필로 쓴 약품 목록 열두 줄을 아인에게 내민다. 지금 약은 넉 달 치이며 셋을 구하면 여섯 달, 여섯을 구하면  | TBD_CANON | L9694-L9725 §1 목록 |
| EP14_SC002 | loc_route_pangyo | STORY_WALK/STORY_DIALOGUE |  | 동행자는 스물아홉 살 민경. 재난 전 판교 연구소에서 시약 정리와 세척, 폐기물 분류를 하던 계약직이었다. 라벨은 읽지만 무슨 | TBD_CANON | L9726-L9749 §2 계약직 |
| EP14_SC003 | loc_pangyo_research_complex | INVESTIGATION |  | 판교는 조용하고 건물이 온전하다. 민경이 세 번째 건물 앞에서 멈춘다. 유리문의 삭은 공지에는 '내부 인원 전원 대피 완료.  | TBD_CANON | L9750-L9789 §3 봉인 |
| EP14_SC004 | loc_pangyo_lab_b2 | INVESTIGATION/BOSS_ENTRY | boss_silheomche_09 | 지하 2층 시약 창고에서 민경이 목록의 약품 두 개를 찾아 배낭에 넣는다(여섯 달). 나머지 냉장 약품은 지하 3층에 있다.  | TBD_CANON | L9790-L9841 §4 형태가 없다 |
| EP14_SC005 | loc_pangyo_lab_b3 | BOSS_BATTLE | boss_silheomche_09 | 첫 번째는 쉬웠다. 느린 개체를 카인이 받고 류가 뒷목에 단검을 박아 코어를 드러내자 아인의 낫이 한 번에 가른다. 무너진 덩 | TBD_CANON | L9842-L9897 §5 세 번 |
| EP14_SC006 | loc_pangyo_lab_b3 | STORY_CINEMATIC | boss_silheomche_09 | 아인은 낫을 든 채 서 있다. 세 번 다 정확했지만 세 번 다 다시 일어났다. 스승의 '두 번 치지 않는다'를 지켜 왔는데 지 | TBD_CANON | L9898-L9932 §6 원칙 |
| EP14_SC007 | loc_pangyo_lab_b3 | BOSS_BATTLE | boss_silheomche_09 | 네 번째 시도에서 아인은 코어를 끊지 않고 몸을 잘게 나누기로 한다. 낫이 원을 다섯 번 그리고 조각이 바닥·벽·천장에 붙는다 | TBD_CANON | L9933-L9956 §7 나뉜다 |
| EP14_SC008 | loc_pangyo_lab_b3 | BOSS_BATTLE | boss_silheomche_09 | 셋이 되자 지하실이 좁아지고 넷은 폭 두 사람 너비의 계단으로 물러난다. 계단 중턱에서 카인이 첫 번째를 받자 그 팔이 떨어져 | TBD_CANON | L9957-L9982 §8 좁은 계단 |
| EP14_SC009 | loc_pangyo_lab_b3 | BOSS_BATTLE/STORY_CINEMATIC | boss_silheomche_09 | 세 번째 개체가 가슴부터 몸을 양옆으로 벌린다. 아인은 그것이 감싸 안으로 넣으려는 것이며 몸의 봉합선 수만큼 그런 일이 있었 | TBD_CANON | L9983-L10014 §9 벌어진다 |
| EP14_SC010 | loc_pangyo_lab_b3 | BOSS_BATTLE/STORY_CINEMATIC | boss_silheomche_09 | 민경이 병을 던지자 세 번째 개체의 팔이 굳고, 개체가 그 팔을 떼어낸다. 굳은 데는 안 붙는다며 민경이 계단을 뛰어 내려온다 | TBD_CANON | L10015-L10050 §10 계약직이 아는 것 |
| EP14_SC011 | loc_pangyo_research_complex | BOSS_RESULT/TRANSITION | boss_silheomche_09 | 이십 분 뒤 넷은 지하실을 나온다. 세 개체를 다 죽이지 못해, 민경이 남긴 마지막 병을 계단 중턱 이음매에 쏟아 굳혀 막았다 | TBD_CANON | L10051-L10072 §11 붙지 않는 것 |
| EP14_SC012 | TBD_CANON | STORY_DIALOGUE |  | 밤에 카인이 내일 다시 들어갈 거냐 묻는다. 아인은 오정길이 조명을 잡아 주는 옆에서 재생 시간(30·35·40초), 분열,  | TBD_CANON | L10073-L10128 §12 데이터 |
| EP14_SC013 | loc_pangyo_lab_rooftop | STORY_CINEMATIC |  | 넷은 몰랐지만 건물 옥상에 한 사람이 여섯 시간 동안 지하실을 내려다보고 있었다. 계단이 굳는 것도, 셋이 서는 것도, 민경이 | TBD_CANON | L10129-L10153 §13 위에서 |

### EP15 두 번

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP15_SC001 | TBD_CANON | STORY_CINEMATIC |  | 새벽에 아인은 '굳히는 것 말고, 못 붙게 하는 방법' 아래에 태운다·떼어 놓는다·얼린다를 적고 하나씩 지운다. 불은 넷도 태 | TBD_CANON | L10183-L10206 §1 못 붙게 하는 법 |
| EP15_SC002 | TBD_CANON | STORY_DIALOGUE |  | 카인이 민경이 찾은 시약 두 병을 꺼내 던져서 굳히자고 한다. 아인은 억제제 재료라고 맞서고, 카인은 여섯 달 더 살자고 셋을 | TBD_CANON | L10207-L10252 §2 재고 |
| EP15_SC003 | loc_pangyo_lab_b3 | INVESTIGATION/BOSS_ENTRY | boss_silheomche_09 | 넷은 아침에 보기 위해 다시 들어간다. 어제 굳힌 계단 중턱 이음매는 버티고 있고 아래에서 조각들이 벽을 타는 소리가 난다.  | CANON | L10253-L10284 §3 두 번째 계단 |
| EP15_SC004 | loc_pangyo_lab_lobby | BOSS_BATTLE | boss_silheomche_09 | 지하실에서 셋이 올라오는데 밤사이 서로를 먹어 하나가 커졌다. 카인이 계단 위에서 큰 것을 받자 대검이 몸통에 감싸여 뽑히지  | CANON | L10285-L10310 §4 셋 |
| EP15_SC005 | loc_pangyo_lab_lobby | BOSS_BATTLE | boss_silheomche_09 | 넷은 오전 내내 자르지 않고 버틴다. 카인이 밀고, 류가 발을 걸고, 오정길이 파티션을 쓰러뜨려 길을 막고, 아인은 낫자루로만 | CANON | L10311-L10332 §5 자르지 않는 싸움 |
| EP15_SC006 | loc_pangyo_lab_lobby | BOSS_BATTLE/STORY_CINEMATIC | boss_silheomche_09 | 큰 것이 어제 민경 앞에서처럼, 그러나 더 크게 몸을 벌린다. 앞에는 뒤가 파티션에 막힌 카인이 있다. 아인은 뛰지만 어제와  | TBD_CANON | L10333-L10379 §6 벌어진다 |
| EP15_SC007 | loc_pangyo_lab_lobby | STORY_CINEMATIC/BOSS_BATTLE | boss_silheomche_09 | 롱코트에 흑발 단발, 안경을 쓴 여자가 깨진 창틀을 넘어 들어온다. 금속 봉을 쥔 손목 소매 밖으로 청색 회로 문신이 올라간다 | CANON | L10380-L10413 §7 봉쇄 |
| EP15_SC008 | loc_pangyo_lab_lobby | BOSS_BATTLE | boss_silheomche_09 | 아인이 그물 눈 사이의 발광점에 낫을 넣는다. 한 번, 갈라지고 붙지 않는다. 삼 초 안에 아인은 같은 자리를 두 번째로 친다 | CANON | L10414-L10445 §8 두 번 |
| EP15_SC009 | loc_pangyo_lab_lobby | BOSS_BATTLE/BOSS_RESULT | boss_silheomche_09 | 그다음은 순서였다. 여자가 봉쇄하고, 카인이 자리를 잡고, 류가 조각을 흩고, 아인이 두 번씩 친다. 큰 것에는 봉쇄가 두 번 | TBD_CANON | L10446-L10469 §9 넷과 하나 |
| EP15_SC010 | loc_pangyo_lab_lobby | STORY_DIALOGUE |  | 여자가 봉을 짚고 넷을 채점하듯 훑는다. 어제부터 세 번 자르는 걸 봤다는 말에 카인이 오른팔을 떨며 왜 안 도와줬냐 묻고,  | TBD_CANON | L10470-L10509 §10 잘라도 안 죽는 걸 |
| EP15_SC011 | loc_pangyo_lab_lobby | STORY_DIALOGUE |  | 아인이 어제 옥상에 여섯 시간 있었냐고 묻고, 빛이 새벽과 아침에 두 번 움직였다고 말한다. 여자는 처음으로 아인을 제대로 보 | TBD_CANON | L10510-L10551 §11 스물아홉 |
| EP15_SC012 | loc_pangyo_lab_lobby | STORY_DIALOGUE/STORY_CINEMATIC |  | 여자가 코트 안쪽에서 라벨 없는, 닥터 진의 것보다 맑은 병 세 개를 꺼내 아인 앞에 놓는다. 목에 있는 것을 늦추는 약이며, | TBD_CANON | L10552-L10597 §12 계약 |
| EP15_SC013 | loc_pangyo_lab_lobby | STORY_CINEMATIC/TRANSITION |  | 떠나기 전 아인은 여덟 번의 두 번이 남긴 덩어리들을 본다. 스승의 '두 번 치지 않는다'를 처음으로 '두 번 칠 필요가 없게 | TBD_CANON | L10598-L10630 §13 원칙이 자란다 |

### EP16 밝은 쪽

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP16_SC001 | loc_south_road | STORY_WALK/INVESTIGATION |  | 남행 길가에 목덜미 코어가 같은 단면으로 도려내진 집행관 사체가 셋 있다. 오정길이 깡통을 세우고 스무 걸음 밖에서 돌을 던져 | TBD_CANON | L10659-L10678 §1 소리의 등고선 |
| EP16_SC002 | loc_logistics_warehouse_yard | INVESTIGATION |  | 인계 지점 추정 1호인 낡은 물류창고 앞마당은 전장이었다. 뒤집힌 수레, 속이 빈 방호복, 코어가 도려내진 호위 집행관 두 기 | TBD_CANON | L10679-L10696 §2 괴물을 먹는 괴물 |
| EP16_SC003 | loc_logistics_warehouse_yard | BOSS_ENTRY/BOSS_BATTLE | boss_shadow_fang | 류의 눈이 수풀 그늘의 움직임을 잡지만 외침은 닿지 않고, 류가 몸을 날려 아인을 민다. 아인이 있던 자리를 검은 것이 관통해 | TBD_CANON | L10697-L10716 §3 개전 |
| EP16_SC004 | loc_logistics_warehouse_yard | BOSS_BATTLE | boss_shadow_fang | 두 번째, 세 번째 반격도, 류의 쌍단검도 허공이다. 놈은 칼이 출발하기 전에 이미 다른 곳에 있다. 아인이 멈추고 관찰해,  | TBD_CANON | L10717-L10734 §4 읽는 것 |
| EP16_SC005 | loc_logistics_warehouse_yard | BOSS_BATTLE/STORY_CINEMATIC | boss_shadow_fang | 공세가 가장 밝은 아인에게 집중되고, 세 번째 받아넘김에 낫자루가 밀린다. 아인은 카인의 가드 뒤로 반 박자를 벌어 마지막 억 | TBD_CANON | L10735-L10754 §5 소등 |
| EP16_SC006 | loc_logistics_warehouse_yard | BOSS_BATTLE | boss_shadow_fang | 놈이 카인을 치고 금 간 날이 진동으로 운다. 오정길은 감각기가 한 번도 자신을 향한 적이 없음을 깨닫는다. 각인 없는 목이  | TBD_CANON | L10755-L10779 §6 투명한 자 |
| EP16_SC007 | loc_logistics_warehouse_yard | BOSS_BATTLE | boss_shadow_fang | 갈라진 조준의 틈에 아인이 수신호를 올리고, 류가 반대편 그늘로 미끄러져 카인 정면·류 배후·아인 측면의 진형이 다시 선다.  | TBD_CANON | L10780-L10795 §7 다시 짜인 판 |
| EP16_SC008 | loc_logistics_warehouse_yard | BOSS_BATTLE | boss_shadow_fang | 아인의 낫이 원을 그리고 끝자락 4분의 1이 놈의 옆구리에 닿는다. 검은 표피가 소리 없이 갈라지고 흐린 빛의 속살이 드러나며 | TBD_CANON | L10796-L10815 §8 닿는다 |
| EP16_SC009 | loc_logistics_warehouse_yard | STORY_CINEMATIC | boss_shadow_fang | 상처는 얕아 속살 앞에서 멈춰 있다. 아인은 어두운 채로는 출력이 껍질까지라고 말한다. 밝으면 읽히고 어두우면 얕다 — 베려면 | TBD_CANON | L10816-L10833 §9 방정식 |
| EP16_SC010 | loc_logistics_warehouse_yard | BOSS_BATTLE | boss_shadow_fang | 상처 입은 놈이 광폭해져 공세가 배로 빨라진다. 카인의 가드가 연속으로 울고, 뿌리까지 닿아 있던 금이 진동 속에서 하얗게 곤 | TBD_CANON | L10834-L10843 §10 한계 |
| EP16_SC011 | loc_logistics_warehouse_yard | STORY_CINEMATIC | boss_shadow_fang | 전장 밖 폐허 능선에서 넷의 것을 합친 것보다 밝은 정제된 빛기둥이 폭발하듯 켜진다. 놈의 감각기가 통째로 그쪽으로 젖혀지며  | TBD_CANON | L10844-L10857 §11 빛 도둑 |
| EP16_SC012 | loc_logistics_warehouse_yard | STORY_DIALOGUE | boss_shadow_fang | 세라가 능선을 내려오며 판교에서처럼 전장을 채점하는 눈으로 훑는다. 어두워져서 닿는 데까지는 갔다고 평하고, 왜 어두워졌냐고  | TBD_CANON | L10858-L10887 §12 빈칸 |
| EP16_SC013 | loc_logistics_warehouse_yard | STORY_DIALOGUE/BOSS_BATTLE | boss_shadow_fang | 놈이 상처 입고 학습해 더 낮게 웅크린 채 돌아온다. 세라는 표피 경화 3할, 감각기 대역폭 절반 소모, 반나절 안에 아물 상 | TBD_CANON | L10888-L10930 §13 변수 |

### EP17 빈칸

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP17_SC001 | loc_logistics_warehouse_yard | BOSS_BATTLE | boss_shadow_fang | 세라를 덮치는 검은 것의 궤적은 완벽했지만, 세라는 피하지 않고 봉으로 지면을 짚어 반구형 결계를 펼치고 일격이 막 표면에서  | TBD_CANON | L10959-L10978 §1 순서대로 |
| EP17_SC002 | loc_logistics_warehouse_yard | BOSS_BATTLE | boss_shadow_fang | 놈이 가장 밝은 아인에게 쇄도하자 카인이 가드로 일격을 물어 반 박자를 만든다. 그 사이 류가 배후에서 뒷다리 두 관절에 쌍단 | TBD_CANON | L10979-L11000 §2 공식 |
| EP17_SC003 | loc_logistics_warehouse_yard | STORY_CINEMATIC/BOSS_ENTRY | boss_shadow_fang | 아인이 처음으로 엄지로 하늘을 잰다. 구름 아래로 지난밤 지평선을 걷던 광점이 강하하며, 접힌 금속 날개와 몸통 아래 수납부  | TBD_CANON | L11001-L11024 §3 지나가는 길 |
| EP17_SC004 | loc_logistics_warehouse_yard | BOSS_BATTLE/BOSS_RESULT | boss_shadow_fang | 아인이 찢고 찢기는 두 괴물 사이로 달려 들어가, 어제와 오늘 두 번 가른 자리에 세 번째를 넣는다. 심부의 흐린 빛이 꺼지고 | TBD_CANON | L11025-L11042 §4 소리의 귀환 |
| EP17_SC005 | loc_logistics_warehouse_yard | BOSS_BATTLE | boss_celestial | 셀레스티얼이 찢긴 날개 한쪽으로 분노하며 저공으로 뜬다. 세라는 양력 6할, 고도 상한 15미터라 읊고, 오늘이 아니면 못 잡 | TBD_CANON | L11043-L11072 §5 하늘이잖아 |
| EP17_SC006 | loc_logistics_warehouse_yard | STORY_CINEMATIC | boss_celestial | 물러난 놈의 수납부 격자가 스스로 열리고, 순찰이 거둬 온 코어들이 거꾸로 몸통 안으로 빨려 들어간다. 하나, 둘, 열, 수십 | TBD_CANON | L11073-L11101 §6 제 수거물을 삼키는 것 |
| EP17_SC007 | loc_logistics_warehouse_yard | BOSS_BATTLE | boss_celestial | 접힘이 다중화되어 놈이 세 방향에서 동시에 온다. 결계가 하나를 받고, 둘째를 카인이 몸으로 막다 튕겨 나가고, 셋째가 류를  | TBD_CANON | L11102-L11115 §7 세 곳에서 동시에 |
| EP17_SC008 | loc_logistics_warehouse_yard | STORY_CINEMATIC | boss_celestial | 몰린 등에서 아인의 목덜미가 한 단계 뛰며 문턱을 넘고, 접히는 공간의 가장자리에 종이 모서리 같은 가늘고 하얀 선이 보인다. | TBD_CANON | L11116-L11145 §8 문턱 |
| EP17_SC009 | loc_logistics_warehouse_yard | STORY_CINEMATIC/BOSS_BATTLE | boss_celestial | 세라가 떨어진 날개 관절에서 관절 제어 코어를 뽑아 마지막 촉매 위에 겹쳐 쥔다. 놈의 접힘은 제일 밝은 코어 서명을 좌표로  | TBD_CANON | L11146-L11165 §9 베끼는 손 |
| EP17_SC010 | loc_logistics_warehouse_yard | BOSS_BATTLE/BOSS_RESULT | boss_celestial | 세라가 촉매를 던지고 공간이 가짜 아인에게로 접혀, 놈의 도약이 처음으로 아군이 지정한 좌표에 펴진다. 강하의 전부가 카인의  | TBD_CANON | L11166-L11193 §10 파단 |
| EP17_SC011 | loc_logistics_warehouse_yard | BOSS_RESULT/INVESTIGATION | boss_celestial | 다섯이 거대한 사체 앞에 선다. 흡수되지 않은 규격 용기, 경질 소재 판, 장비 잔해, 식어 가는 융합 코어 결정 하나, 그리 | TBD_CANON | L11194-L11219 §11 쇠는 못 삼킨다 |
| EP17_SC012 | loc_valley_outskirts | STORY_DIALOGUE |  | 골짜기 밖 소리 있는 저녁. 세라가 촉매 가방을 털어 아무것도 없음을 확인한다. 뭐로 싸우냐는 류에게 만들어야 하고 재료는 남 | TBD_CANON | L11220-L11259 §12 빈 병 |
| EP17_SC013 | loc_valley_outskirts | STORY_CINEMATIC |  | 오정길이 교신 기록부 사본, 판교 실험체 보고, 셀레스티얼 격파 보고를 싼 방수포 뭉치를 메고, 무전이 없으니 안 보이는 사람 | TBD_CANON | L11260-L11284 §13 경례 |

### EP18 발현

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP18_SC001 | loc_north_road | STORY_WALK/TRANSITION |  | 북으로 가는 길이 두 속도로 갈린다. 오정길은 감각기에 잡히지 않는 몸으로 순찰을 피해 밤에 걷고 낮에 자며, 열흘 걸렸던 길 | TBD_CANON | L11313-L11324 §1 두 개의 속도 |
| EP18_SC002 | loc_gangnam_bunker_control_room | STORY_DIALOGUE/INVESTIGATION |  | 오정길이 이레째 아침 강남 벙커 철문을 두드린다. 관제실에서 마태오가 교신 기록부 사본, 세라라는 이름, 하늘의 것을 잡았다는 | TBD_CANON | L11325-L11352 §2 전령 |
| EP18_SC003 | loc_gangnam_bunker | STORY_CINEMATIC |  | 사흘 뒤 새벽, 동쪽 환기구와 북쪽 통로의 깡통이 운다. 오정길이 종을 치고 벙커가 깨어난다. 마태오는 관제실 창으로 랜턴도  | TBD_CANON | L11353-L11366 §3 손님 (벙커) |
| EP18_SC004 | loc_north_road | STORY_CINEMATIC/TRANSITION |  | 다섯은 그때 벙커에서 반나절 거리에 있었다. 아인이 먼저 멈추고, 새벽 공기 속 아주 멀리서 쇠가 쇠를 두드리는 소리의 파편을 | CANON | L11367-L11372 §3 손님 (반나절 거리) |
| EP18_SC005 | loc_gangnam_bunker_corridors | STORY_CINEMATIC |  | 기습은 조용하고 체계적이었다. 방호복 인원들이 환기구를 따고 들어오고 군 표식 집행관 한 기가 통로 셔터를 뜯는다. 오정길이  | TBD_CANON | L11373-L11386 §4 문과 문 사이 |
| EP18_SC006 | loc_gangnam_bunker_children_ward | STORY_CINEMATIC |  | 아이들 구역 셔터가 팔 분 만에 뜯기고, 휴대 계측기를 든 방호복 둘이 들어온다. 두호는 두나를 데리고 침상 뒤 배관 틈에 숨 | CANON | L11387-L11406 §5 깡, 깡 |
| EP18_SC007 | loc_gangnam_bunker_outer_approach | STORY_WALK |  | 외곽의 무너진 진입로를 달려 올라오던 아인이 우뚝 멈춘다. 배관과 콘크리트와 지하수를 건너 깡, 깡, 두 번이 들린다. '어디 | TBD_CANON | L11407-L11422 §6 어디 있어도 (외곽) |
| EP18_SC008 | loc_gangnam_bunker_vent_duct | STORY_WALK |  | 통로는 꺾이고 문마다 멈추지만 환기구는 직선이다. 다만 어깨가 걸리고 팔꿈치를 펼 수 없어 기어서는 느리다. 아인은 기지 않고 | CANON | L11423-L11437 §6 어디 있어도 (환기구) |
| EP18_SC009 | loc_gangnam_bunker_children_ward | STORY_CINEMATIC |  | 배관 틈에서 두나가 끌려 나오고 계측기가 목덜미로 다가가며 두호가 매달렸다 떨어진다. 그때 천장이 찢어지며 낫을 쥔 그림자가  | TBD_CANON | L11438-L11469 §7 표시 |
| EP18_SC010 | loc_gangnam_bunker_children_ward | STORY_CINEMATIC |  | 여덟 살에 감염되어 2년간 약으로 누르던 두나의 초기 감염이 죽음 반 박자 앞에서 문턱을 넘어, 목덜미 결정이 서툴고 눈부시게 | TBD_CANON | L11470-L11489 §8 발현 |
| EP18_SC011 | loc_gangnam_bunker_children_ward | STORY_CINEMATIC |  | 아이들 구역에 등이 켜지고, 두나는 아프기는커녕 2년 만에 개운해한다. 사람들이 기적이라며 둘러싼다. 아인이 무릎 꿇고 괜찮냐 | TBD_CANON | L11490-L11517 §9 두 개의 눈물 |
| EP18_SC012 | loc_han_workshop | STORY_DIALOGUE |  | 한 장인의 작업장은 밤새 밝았다. 카인이 부러진 대검과 소재 판을 제단에 올리자, 장인은 2년 전 제 손으로 벼리고도 지우지  | CANON | L11518-L11559 §10 만져 본 쇠 |
| EP18_SC013 | loc_gangnam_bunker_evaluation_office | STORY_CINEMATIC |  | 이튿날 각인 평가소 앞에 벙커의 절반이 모인다. 유진이 두나의 목덜미에 계측기를 대고 안정 범위라며 C랭크로 등록하고, 드물게 | TBD_CANON | L11560-L11577 §11 기적처럼 |
| EP18_SC014 | loc_gangnam_bunker_children_ward | STORY_DIALOGUE |  | 밤에 아인이 아이들 구역을 찾는다. 두나는 새 인식표를 쥔 채 잠들었고, 아인은 두호 곁 바닥에 아이 눈높이로 앉아 벽 밖에서 | CANON | L11578-L11603 §12 두 번의 값 |
| EP18_SC015 | loc_han_workshop | STORY_CINEMATIC/INVESTIGATION |  | 망치 소리는 새벽 네 시에 멎는다. 아침에 카인이 작업장에 가니 제단 위에 대검의 폭을 버리고 길이를 취한 아주 긴 장검이 있 | TBD_CANON | L11604-L11673 §13 긴 날 (작업장) |
| EP18_SC016 | TBD_CANON | STORY_CINEMATIC |  | 유진이 대장의 새 줄에 한 장인의 이름을 적는다. 각인자가 아니어서 등급 칸은 비운다. 처리 칸 앞에서 오래 펜을 들고 있자  | TBD_CANON | L11674-L11691 §13 긴 날 (대장) |
| EP18_SC017 | loc_gangnam_bunker_control_room | STORY_DIALOGUE/TRANSITION |  | 관제실에서 마태오가 지도를 접으며, 벙커는 이제 표적이고 한 번 왔으면 또 오니 너희가 남쪽에서 끝을 내는 것 말고는 여기를  | TBD_CANON | L11692-L11710 §13 긴 날 (관제실·출발) |

### EP19 제19화 — 손실

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP19_SC001 | loc_bunker_training | STORY_CINEMATIC/STORY_WALK |  | 남행 준비 닷새. 카인은 훈련장에서 새 장검에 몸을 맞추며 허수아비 둘을 부수고, 아인은 임계 이후 어긋난 원의 감각을 분필  | CANON | L11725-L11752 §1 정비의 날들 |
| EP19_SC002 | loc_bunker | STORY_DIALOGUE |  | 송신을 끊은 무전실에 사흘 전부터 매일 같은 시각 늙은 목소리의 난수 방송이 들어온다. 무전수 박 씨의 수첩을 본 세라가 구형 | CANON | L11753-L11784 §2 수신 |
| EP19_SC003 | loc_bunker | STORY_DIALOGUE |  | 류가 2년간 몸에 지녀 온 USB를 테이블에 올리고 처음으로 제 이야기를 한다. 군 시설에서 물건 하나를 빼 오는 의뢰에 여섯 | CANON | L11785-L11810 §3 류의 것 |
| EP19_SC004 | loc_bunker | STORY_DIALOGUE/ANIMATION_ONLY |  | 세라가 이틀 밤을 방에서 나오지 않고 암호를 뜯다가, USB 잠금과 난수 방송이 같은 세대 같은 규격임을 발견한다. 방송은 매 | CANON | L11811-L11834 §4 열쇠 |
| EP19_SC005 | loc_bunker | STORY_CINEMATIC |  | 화면에 수백 장의 문서철이 열리고 첫 장 제목 「각인 유도 프로그램 — 설계 기준서」를 모두가 읽는다. 벼락 같은 기적이라던  | CANON | L11835-L11852 §5 제목 |
| EP19_SC006 | loc_bunker | STORY_DIALOGUE |  | 노출 농도 조절, 숙주 선별, 발현률 제고 — 문서는 사람을 숙주로, 죽음을 탈락으로 적은 공학 문서였다. 카인이 뜻을 묻자  | CANON | L11853-L11877 §6 넘겨지는 장 |
| EP19_SC007 | loc_bunker | STORY_DIALOGUE |  | 승인 서식의 기안 부서는 세라의 옛 소속 연구 기관이었다. 류가 세라와 기관명 사이의 거리를 읽고, 최종 승인자 '백 실장'의 | CANON | L11878-L11909 §7 승인란 |
| EP19_SC008 | loc_bunker_control_room | STORY_DIALOGUE |  | 그 밤 카인이 혼자 관제실로 가 셀레스티얼전 의뢰비 중 삼십만 원을 '허수아비 값'으로 마태오 책상에 올린다. 마태오는 2년  | CANON | L11910-L11951 §8 삼십만 원 |
| EP19_SC009 | loc_bunker_control_room | STORY_DIALOGUE/INVESTIGATION |  | 아인이 장부 뒷장에서 비품이 아닌 이름들 — 미귀환·손실로 처리된 사람들 — 을 넘겨 본다. 미귀환이 거의 B와 A라는 것을  | CANON | L11952-L11985 §9 손실의 목록 |
| EP19_SC010 | loc_bunker_radio_room | STORY_DIALOGUE/STORY_CINEMATIC |  | 이튿날 새벽 난수 방송의 마지막 조각이 들어와 본문이 열린다. '문서는 진본이다 / 증거의 원본은 계룡에 있다 / 들리는 자가 | CANON | L11986-L12011 §10 마지막 조각 |
| EP19_SC011 | loc_bunker_sera_room | STORY_WALK/STORY_CINEMATIC |  | 짐을 싸는 저녁, 아인이 세라의 방 앞에서 노크하려다 멈춘다. 문틈으로 세라가 승인란의 '백 실장'을 계산이 끝나지 않는 얼굴 | CANON | L12012-L12023 §11 대답하지 않은 사람 |
| EP19_SC012 | loc_bunker_control_room | STORY_DIALOGUE |  | 마태오가 지도 위에 마지막 브리핑을 편다. 계룡까지 직선 140km, 보름 걸음, 인계 지점 추정치 둘을 피해 갈 것. 벙커는 | CANON | L12024-L12043 §12 출발 전야 |
| EP19_SC013 | loc_bunker_gate | STORY_CINEMATIC/TRANSITION |  | 떠나는 아침, 카인은 장검을, 류는 열린 USB를, 아인은 이름 잃은 인식표 두 개와 손실 장부를 교신 기록부와 같은 방수포에 | CANON | L12044-L12074 §13 손에 든 것들 |

### EP20 제20화 — 내일

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP20_SC001 | loc_south_road | STORY_WALK |  | 인계 지점 추정치 두 곳을 크게 돌아가는 남행 첫 사흘은 이상할 만큼 조용하다. 세라는 후미에서 걷고, 류는 채권자의 시선으로 | CANON | L12075-L12106 §1 남행 사흘 |
| EP20_SC002 | loc_local_assessment_post | STORY_DIALOGUE/ANIMATION_ONLY |  | 닷새째, 폐쇄된 읍 단위 지방 평가소를 지나며 세라가 죽은 계측기를 반나절 만에 촉매와 부품으로 되살린다. 카인·류·아인의 바 | CANON | L12107-L12134 §2 재계측 |
| EP20_SC003 | loc_local_assessment_post | STORY_DIALOGUE/STORY_CINEMATIC |  | 아인의 물음에 세라도 손목을 올리고 바늘은 A에서 멈춘다. 그러나 코어의 빛을 다루는 그녀의 손이 바늘을 속였고, 골짜기의 밤 | CANON | L12135-L12166 §3 네 번째 손목 |
| EP20_SC004 | loc_south_camp | STORY_CINEMATIC |  | 그날 저녁 야영에서 류가 늘 주머니에 넣어 두던 C 인식표를 꺼내 한참 들여다본 뒤 처음으로 목에 건다. 카인과 아인은 못 본 | CANON | L12167-L12182 §4 거는 목 |
| EP20_SC005 | loc_south_camp | STORY_DIALOGUE |  | 엿새째 밤, 류가 말없이 승인란 화면을 세라 쪽으로 돌려 '내일이 꽤 기네요'라고 만기를 고지한다. 세라는 오래 화면을 보다가 | CANON | L12183-L12210 §5 문서를 든 손 |
| EP20_SC006 | loc_south_camp | STORY_DIALOGUE/STORY_CINEMATIC |  | 세라가 각인 유도 프로그램의 원본 이론 — 나노 물질과 인간 신경계의 공생 유도 모델 — 논문의 저자가 자신이라고 자백한다.  | CANON | L12211-L12233 §6 논문 |
| EP20_SC007 | loc_south_camp | STORY_DIALOGUE |  | 재난 전, 세라는 척수 손상 환자의 신경 재생을 연구하다 자가 조직화 나노 모델에 닿았다. 지구에 없는 물질에 대한 '설명서' | CANON | L12234-L12259 §7 살리려던 이론 |
| EP20_SC008 | loc_south_camp | STORY_DIALOGUE/FLASHBACK |  | 연구소는 이십 년 전쯤 어디선가 떨어진 것을 주웠다는, 죽어 있는 손바닥만 한 파편을 금고에 두고 깨우지 못해 왔다. 세라의  | CANON | L12260-L12299 §8 금고 안의 죽은 것 |
| EP20_SC009 | loc_south_camp | STORY_DIALOGUE |  | 재난 넉 달 뒤 세라의 논문은 유일한 대응 문서로 서고에서 꺼내졌고, 백 실장은 막는 법 다음 장의 '기르는 법'에서 멈추지  | CANON | L12300-L12339 §8-2 꺼내진 논문 |
| EP20_SC010 | loc_south_camp | STORY_DIALOGUE |  | 카인이 장검을 짚고 절뚝이며 세라 앞에 서서 '한 대 치고 싶다'면서도 논문을 쓴 사람과 뒤집어 읽은 사람은 다르다고 판결하고 | CANON | L12340-L12379 §9 갈라지는 반응 |
| EP20_SC011 | loc_south_camp | STORY_DIALOGUE/STORY_CINEMATIC |  | 카인이 서로를 다 믿는 놈은 없지만 계룡에 가야 할 이유는 넷 다 진짜라며 장검 끝으로 불가에 선을 긋는다. '믿어서 가는 게 | CANON | L12380-L12413 §10 불신 위의 동맹 |
| EP20_SC012 | loc_gyeryong_ridge | STORY_CINEMATIC/STORY_WALK |  | 열이틀째 저녁 계룡 외곽 능선에 닿는다. 분지에는 질서 있는 불빛, 초소와 철책, 사람의 보폭과 집행관의 관절음이 섞인 대열이 | CANON | L12414-L12437 §11 출정 |
| EP20_SC013 | loc_gyeryong_ridge_shelter | STORY_CINEMATIC |  | 돌입 전야, 불 없이 바위 그늘에 앉는다. 카인은 이름 없는 장검을 닦으며 자루의 B 인식표를 그대로 두고, 류는 잠들지 않고 | CANON | L12438-L12461 §12 마지막 밤 |
| EP20_SC014 | loc_gyeryong_perimeter | STORY_WALK |  | 새벽, 다섯이 능선을 내려간다. 세라가 철책의 사각을 짚고, 아인이 초소 교대 간격을 재고, 류가 어둠에 녹아 문을 따며, 카 | CANON | L12462-L12467 §13 관문 |
| EP20_SC015 | loc_gyeryong_hangar_gate | INVESTIGATION/TRANSITION |  | 산 밑동을 파고든 지하 격납고의 관문 앞. 랜턴 빛에 부대 표기와 구역 번호, 그 아래 더 새 도색의 「제OO수거대 본부」 스 | CANON | L12468-L12496 §13 관문 |

### EP21 제21화 — 배 속

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP21_SC001 | loc_gyeryong_ramp | STORY_WALK |  | 관문 안쪽, 차량 두 대 폭의 경사로가 세 번 꺾여 내려간다. 절반쯤 살아 있는 초록 유도등과 아무도 돌리지 않는 전기 — 세 | CANON | L12497-L12529 §1 산의 배 속 |
| EP21_SC002 | loc_gyeryong_maintenance_depot | STORY_WALK/INVESTIGATION |  | 첫 격납고 층은 정비창이다. 사람 없는 크레인·리프트·유압 절단기·다관절 암·무한궤도 운반차가 결정이 빛나는 관절로 헛동작을  | CANON | L12530-L12549 §2 살아 있는 기지 |
| EP21_SC003 | loc_gyeryong_maintenance_depot | STORY_DIALOGUE |  | 서 하사가 붙여 준 이름 밝히지 않는 안내인 — 마흔쯤, 작업복, 계급장 자리에 실밥 자국. 질의서를 냈다가 반려당하고 여기로 | CANON | L12550-L12575 §3 도면을 아는 사람 |
| EP21_SC004 | loc_gyeryong_maintenance_depot | STORY_CINEMATIC |  | 절단기 박자의 골을 밟아 건너던 중 헛동작이 일제히 멎고 모든 관절이 다섯을 향한다. 다관절 암 낙하, 절단기 돌진, 공구 렉 | CANON | L12576-L12593 §4 군단 |
| EP21_SC005 | loc_gyeryong_junction | STORY_DIALOGUE/STORY_WALK |  | 두 번째 층으로 가는 세 갈래 길목. 안내인이 오른쪽을 가리키기 전에 세라가 '이 년 전에 뚫렸다'며 배수 계통의 가운데 통로 | CANON | L12594-L12625 §5 길을 되짚어보는 등 |
| EP21_SC006 | loc_gyeryong_main_hangar | BOSS_ENTRY | boss_arsenal_overlord | 가운데 통로 끝, 축구장 몇 개 넓이에 십수 층 높이의 주 격납고. 죽은 장갑차·자주포·견인 트레일러가 도열한 한가운데 포탑과 | CANON | L12626-L12662 §6 격납고 |
| EP21_SC007 | loc_gyeryong_main_hangar | BOSS_BATTLE | boss_arsenal_overlord | 포탑 열여덟이 차례로 깨어나 조준한다. 엄폐물(죽은 장갑차)은 많지만 사출 속도보다 멀고 출구는 등 뒤 하나. 첫 사출이 콘크 | CANON | L12663-L12678 §7 열여덟 개의 눈 |
| EP21_SC008 | loc_gyeryong_main_hangar | BOSS_BATTLE | boss_arsenal_overlord | 류가 벽을 타고 탑의 배후로 돌지만 탑은 원형이라 뒤가 없다 — 어느 각도에서도 최소 셋이 그를 본다. 세 번째 사출에 왼쪽  | CANON | L12679-L12712 §8 사각이 없다 |
| EP21_SC009 | loc_gyeryong_main_hangar | BOSS_BATTLE | boss_arsenal_overlord | 죽은 장갑차는 사출 두 발 이상 못 견디고 엄폐물이 하나씩 사라진다. 세라의 결계가 두 번 사출을 비껴 흘리고 촉매는 반, 남 | CANON | L12713-L12740 §9 좁아지는 방 |
| EP21_SC010 | loc_gyeryong_main_hangar | BOSS_BATTLE/STORY_CINEMATIC | boss_arsenal_overlord | 열여덟 포탑이 전부 정지하고 격납고가 완전히 조용해진다. 아인의 귀만이 '전부 같은 데를 보고 있다'는 것을 알아 흩어지라 외 | CANON | L12741-L12762 §10 전탄 제압 |
| EP21_SC011 | loc_gyeryong_main_hangar | STORY_CINEMATIC | boss_arsenal_overlord | 안내인은 앉아서 종이에 숫자를 적고 있었기에 늦었다. 그가 남긴 종이가 사출의 바람에 날려 격납고 바닥을 구르고, 아인이 그것 | CANON | L12763-L12772 §10 전탄 제압 |
| EP21_SC012 | loc_gyeryong_main_hangar | BOSS_BATTLE | boss_arsenal_overlord | 넷은 삼 분을 더 버티며 도망친다. 굴러가던 아인이 부포탑 하나의 급탄로를 낫으로 긋고, 그 포탑이 다음 사출에서 자기 안에서 | CANON | L12773-L12782 §11 하나 |
| EP21_SC013 | loc_gyeryong_ramp | BOSS_RESULT | boss_arsenal_overlord | 경사로를 반쯤 올라와 카인이 벽에 등을 붙이고 주저앉는다. 하나 잡았고 열일곱 남았다. 아무도 그 계산의 다음을 말하지 않는다 | CANON | L12783-L12796 §11 하나 |
| EP21_SC014 | loc_gyeryong_ramp_workroom | INVESTIGATION/STORY_DIALOGUE |  | 그날 밤 경사로 중턱 정비실에 숨은 넷이 안내인의 종이를 편다. 사각형 하나와 점 열여덟, 그중 열한 개에 숫자. 아인이 그것 | CANON | L12797-L12838 §12 재고 있었습니다 |
| EP21_SC015 | loc_gyeryong_ramp | STORY_DIALOGUE/INVESTIGATION |  | 아인은 자지 않고 경사로 중턱에서 밤새 격납고의 선회음 간격을 세어 적히지 않은 일곱 개를 채운다(여섯 시간). 새벽에 옆에  | CANON | L12839-L12893 §13 소리를 센다 |

### EP22 제22화 — 열여덟

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP22_SC001 | loc_gyeryong_ramp | STORY_WALK/STORY_DIALOGUE |  | 넷이 그날 아침 다시 경사로를 내려간다. 어제 다섯이 내려간 길을 넷이 걸어 발소리가 하나 적다. 아인의 품에는 반은 연필,  | CANON | L12894-L12938 §1 두 번째 아침 |
| EP22_SC002 | loc_gyeryong_main_hangar | STORY_DIALOGUE/BOSS_ENTRY | boss_arsenal_overlord | 격납고 입구에서 세라가 목표를 정한다. 코어는 7m 높이라 지금은 아무도 닿지 못하니 오늘 목표는 주포탑 여섯의 선회 관절.  | CANON | L12939-L12968 §2 관절 |
| EP22_SC003 | loc_gyeryong_main_hangar | STORY_DIALOGUE | boss_arsenal_overlord | 관절은 포탑 밑동, 틈은 손가락 두 마디. 원을 그리는 낫은 못 들어가고 직선만 들어간다. 이 년 동안 아인이 앞에 서고 카인 | CANON | L12969-L12998 §3 눕힌 장검 |
| EP22_SC004 | loc_gyeryong_main_hangar | BOSS_BATTLE | boss_arsenal_overlord | 포화 속에서 아인이 눈을 감고 열여덟 포탑의 사출과 재장전 사이의 골, 사각이 겹치는 자리를 귀로 주워 지도로 그린다. 탑 밑 | TBD_CANON | L12999-L13026 §4 사각의 지도 |
| EP22_SC005 | loc_gyeryong_main_hangar | BOSS_BATTLE | boss_arsenal_overlord | 골짜기의 공식을 격납고 크기로: 세라가 다섯 걸음마다 이동 결계를 깔고, 류가 부포탑 사선으로 몸을 던져 두 겹 잔상으로 세  | CANON | L13027-L13046 §5 공식의 확장 |
| EP22_SC006 | loc_gyeryong_main_hangar | BOSS_BATTLE | boss_arsenal_overlord | 관절이 죽을 때마다 사각이 넓어지고 길이 굵어진다. 류가 부포탑 사출구에 단검을 꽂아 자폭을 유도하고, 세라의 마지막 이동 결 | TBD_CANON | L13047-L13078 §6 무너지는 탑 |
| EP22_SC007 | loc_gyeryong_main_hangar | BOSS_BATTLE | boss_arsenal_overlord | 세 번째 관절이 죽었을 때 열여덟 간격 중 셋이 바뀐다(4→5, 6→4). 탑이 재배치했다 — 배웠다. 열두 걸음째에서 길이  | CANON | L13079-L13130 §7 다시 세야 한다 |
| EP22_SC008 | loc_gyeryong_main_hangar | BOSS_BATTLE | boss_arsenal_overlord | 네 번째, 다섯 번째 관절이 죽자 탑 안쪽에서 무언가 감기며 높아지는 소리가 난다. 세라의 계측: 포탑 다섯이 죽어 출력이 갈 | CANON | L13131-L13168 §8 여섯 |
| EP22_SC009 | loc_gyeryong_main_hangar | BOSS_BATTLE/STORY_CINEMATIC | boss_arsenal_overlord | 여섯 번째 관절이 죽자 조준을 잃은 포탑들이 무작위로 사출을 흩뿌리고 천장 콘크리트가 떨어진다. 붉게 뛰는 7m 높이 코어.  | CANON | L13169-L13192 §9 눕힌 것 위로 |
| EP22_SC010 | loc_gyeryong_main_hangar | BOSS_RESULT | boss_arsenal_overlord | 탑이 죽고 열여덟 눈이 위에서부터 꺼진다. 초록 점선과 네 사람의 숨소리. 아인 목덜미의 긁힌 자국은 두 시간이 아니라 한 시 | CANON | L13193-L13224 §10 꺼진다 |
| EP22_SC011 | loc_gyeryong_sterile_corridor | STORY_WALK |  | 문 너머는 비상등이 살고 바닥이 닦이고 소독약 냄새가 나는, 병원 같은 복도. 소리를 낼 것이 아무것도 없는 침묵 속에 일정한 | CANON | L13225-L13242 §11 내려가는 복도 |
| EP22_SC012 | loc_gyeryong_sterile_corridor | BOSS_ENTRY | boss_bak_junjang | 전투복을 입고 문을 등진 채 부동자세로 선, 어떤 집행관보다 사람에 가까운 실루엣. 랜턴 빛에 목덜미 결정이 빛나고 눈은 비어 | CANON | L13243-L13264 §12 명찰 |
| EP22_SC013 | loc_gyeryong_sterile_corridor | BOSS_ENTRY/STORY_CINEMATIC | boss_bak_junjang | 그것이 공격이 아니라 경례를 한다 — 자아가 소멸한 몸에 남은 마지막 동작. 아인은 끝까지 올라가던 오정길의 손을 떠올린다.  | CANON | L13265-L13307 §13 경례 |

### EP23 제23화 — 자라는 그래프

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP23_SC001 | loc_gyeryong_sterile_corridor | BOSS_BATTLE | boss_bak_junjang | 박 준장이었던 것은 빠르지도 크지도 않지만 '읽는다' — 장검의 궤도, 류의 진짜 잔상, 아인 원의 끝자락 도착점을 먼저 안다 | CANON | L13308-L13347 §1 문지기 |
| EP23_SC002 | loc_gyeryong_sterile_corridor | BOSS_BATTLE/BOSS_RESULT | boss_bak_junjang | 세라의 봉이 아인의 출력을 끈다 — 낫이 두 배로 무거워지고 읽을 발화가 없는 칼. 카인이 온몸의 주황을 끌어올려 가장 밝은  | CANON | L13348-L13373 §2 결착 |
| EP23_SC003 | loc_gyeryong_specimen_hall | STORY_CINEMATIC/INVESTIGATION |  | 문지기가 지키던 강화문은 잠겨 있지 않다. 카인이 문을 밀자 소독약 냄새가 짙어지고 자동 조명이 켜진다. 천장 높은 원형 홀, | CANON | L13374-L13399 §3 문 |
| EP23_SC004 | loc_gyeryong_specimen_hall | INVESTIGATION |  | 명판마다 이름·계급·검체 번호와 C·B·A 눈금을 지나 오르는 그래프, 그리고 'S 도달 전 검체 고정'. 아인은 평가소 계측 | CANON | L13400-L13439 §4 명판 |
| EP23_SC005 | loc_gyeryong_specimen_hall | INVESTIGATION/STORY_CINEMATIC |  | 류가 진열장을 따며 처음으로 손이 떨린다. 수첩은 절반이 항해, 절반이 관찰 기록. 류가 소리 내어 읽는다 — 61일차 회수· | CANON | L13440-L13463 §5 항해일지 |
| EP23_SC006 | loc_gyeryong_specimen_hall | INVESTIGATION/STORY_CINEMATIC |  | 166일차 '성장이 아니다… 이것은 진행이다.' 201일차 A — 신이 주신 힘이라 행복해함. 228일차 S — 밤에 혼자 웃 | CANON | L13464-L13494 §6 자라는 것 |
| EP23_SC007 | loc_gyeryong_specimen_hall | INVESTIGATION/STORY_CINEMATIC |  | 박 항법사, 윤 의무관, 한 부기관사, 조 통신사, 서 화물관리관 — SS에 닿은 여섯이 토씨 하나 다르지 않게 '신호에 응답 | CANON | L13495-L13518 §7 일곱 개의 그래프 |
| EP23_SC008 | loc_gyeryong_specimen_hall | STORY_CINEMATIC |  | 수첩이 내려지고 이 년 치의 단어들이 뒤집힌다. 각인은 감염의 진행 단계, 랭크는 숙주의 성숙도, 계측기는 여명을 재는 기계, | CANON | L13519-L13544 §8 뒤집히는 사전 |
| EP23_SC009 | loc_gyeryong_specimen_hall | INVESTIGATION/STORY_CINEMATIC |  | 아인이 캡슐 열을 따라 걷다 끝에서 두 번째, 빈 캡슐의 명판 「현OO. 중위. 검체 41-B.」 앞에 선다. '검체 미확보. | CANON | L13545-L13576 §9 옆 캡슐 |
| EP23_SC010 | loc_gyeryong_specimen_hall | INVESTIGATION |  | 류가 진열장 아래 서랍에서 최근 몇 달·몇 주의 입고 명부를 찾는다. 처리 구분은 '검체 고정'과 '생체 이송 — 남부 발사장 | CANON | L13577-L13605 §10 이송 명부 |
| EP23_SC011 | loc_gyeryong_specimen_hall | STORY_CINEMATIC/STORY_DIALOGUE |  | 홀 바닥 바로 아래에서 산만 한 심장이 크게 울리고 조명과 캡슐 유리가 공명한다. 일행의 코어가 아래의 박자에 맞춰 강제로 한 | CANON | L13606-L13637 §11 심부의 박동 |
| EP23_SC012 | loc_gyeryong_specimen_hall | STORY_CINEMATIC |  | 떠나기 전 아인이 검체 07-C 캡슐 앞에 선다. 유리 안의 형태와 유리에 비친 제 얼굴 — 고정된 그래프와 아직 자라는 그래 | CANON | L13638-L13657 §12 유리에 비친 것 |
| EP23_SC013 | loc_gyeryong_specimen_hall | STORY_DIALOGUE/TRANSITION |  | 아인이 일지 마지막 장을 편다 — 좌표 하나(남해안 고흥, 노바 1호가 떠나고 돌아온 곳)와 '나는 신호를 끄지 못했다. —  | CANON | L13658-L13696 §13 마지막 장 |

### EP24 황혼이 진 다음 날

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP24_SC001 | loc_sigol_maeul_pyega | STORY_CINEMATIC/TRANSITION |  | 계룡을 나와 이틀을 걷고 사흘째 비가 오자 일행은 빈 시골 마을의 폐가에 든다. 서두름이 진행을 앞당긴다는 것을 알게 된 다섯 | TBD_CANON | L13697-L13722 §1 아침이 오는 법 |
| EP24_SC002 | loc_sigol_maeul_pyega | STORY_WALK/STORY_CINEMATIC |  | 아인은 새벽마다 하던 낫 수련(원을 그리는 동작 하루 백 번)을 하려 하지만, 휘두를수록 코어가 발화해 진행이 가까워진다는 셈 | CANON | L13723-L13744 §2 낫 |
| EP24_SC003 | loc_sigol_maeul_pyega | STORY_DIALOGUE |  | 마루 끝에서 비를 보던 카인이 불쑥 딸 이야기를 꺼낸다. 셔터 사태 날 대피 벙커 앞에서 일곱 살 딸의 손을 놓쳤고, 정원 초 | TBD_CANON | L13745-L13780 §3 주소 잃은 분노 |
| EP24_SC004 | loc_sigol_maeul_pyega | STORY_DIALOGUE |  | 저녁에 카인이 목덜미의 코어를 떼면 어떻게 되느냐고 세라에게 묻는다. 세라는 코어가 척수·신경을 타고 뇌간까지 자라 들어가 코 | CANON | L13781-L13814 §4 코어 파괴 |
| EP24_SC005 | loc_sigol_maeul_pyega | INVESTIGATION/STORY_DIALOGUE |  | 그 밤 경계 교대에 나가 보니 류의 자리가 비어 있다. 배낭·후드·쌍단검이 없고, 마루 기둥에 C가 새겨진 인식표만 걸려 있다 | TBD_CANON | L13815-L13840 §5 셋째 밤 |
| EP24_SC006 | loc_bukjjok_gil | STORY_WALK/FLASHBACK |  | 류는 빗속에 북쪽으로 걷는다. 도망은 그의 전공이라 여겨 왔지만, 두 시간째 주머니 속 명부 한 장 — 정 일병, 정 민간,  | TBD_CANON | L13841-L13869 §6 혼자 걷는 길 |
| EP24_SC007 | loc_sigol_maeul_pyega | STORY_DIALOGUE/STORY_CINEMATIC |  | 동트기 직전 류가 폐가 마당에 들어선다. 자지 않은 채 마루에 앉아 있던 아인과 짧게 말을 주고받고, 류는 기둥의 인식표를 도 | CANON | L13870-L13889 §7 새벽 |
| EP24_SC008 | loc_sigol_maeul_eogwi | STORY_WALK |  | 낮에 아인은 혼자 마을 어귀까지 걸으며 스승의 세 규칙을 뒤집힌 사전 위에 다시 세워 본다. 감당 못 하는 것과는 싸우지 않는 | CANON | L13890-L13913 §8 세 개의 규칙 |
| EP24_SC009 | loc_sigol_maeul_pyega | STORY_WALK/STORY_CINEMATIC |  | 돌아온 아인이 마당 구석에서 낫을 든다. 어제와 달리 「휘두를수록 가까워진다, 알고도 휘두른다」는 셈으로 낫이 올라간다. 장부 | CANON | L13914-L13939 §9 다시 드는 법 |
| EP24_SC010 | loc_sigol_maeul_pyega | STORY_CINEMATIC |  | 밤에 아인은 등잔 밑에서 마태오의 손실 장부를 편다. 목록 끝 첫 빈 줄에 검체 41-B가 아닌 「현OO. 중위.」를 이름으로 | CANON | L13940-L13957 §10 이름을 적는 밤 |
| EP24_SC011 | loc_sigol_maeul_pyega | STORY_DIALOGUE |  | 떠나는 아침 다섯이 마당에 선다. 카인은 계룡 전과 후는 다른 길이며 지금 빠져도 셈하지 않는다고 확인한다. 아무도 움직이지  | TBD_CANON | L13958-L13983 §11 갱신 |
| EP24_SC012 | loc_jeojeun_gukdo | STORY_WALK |  | 마을을 나서는 길에 비가 갠다. 다섯은 물웅덩이에 담긴 하늘을 밟으며 남쪽으로 걷는다. 카인은 미움의 새 수신인을 「신호」로  | CANON | L13984-L13999 §12 비 갠 하늘 |
| EP24_SC013 | loc_galimgil_ijeongpyo | TRANSITION/STORY_CINEMATIC |  | 저녁 무렵 갈림길의 녹슨 이정표에 「고흥 방면」과 남은 거리가 남아 있다. 오정길이 있었다면 「걸어서 열흘」이라 했을 것이고, | CANON | L14000-L14032 §13 남은 거리 |

### EP25 새가 없다

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP25_SC001 | loc_namhae_haeanseon | STORY_WALK/TRANSITION |  | 열흘째 아침 다섯은 이 년 만에 바다를 본다. 해안선을 따라 반나절 남하하자 반도 끝에 발사장 — 우주센터의 흰 구조물, 조립 | TBD_CANON | L14033-L14069 §1 바다 |
| EP25_SC002 | loc_balsajang_bangeoseon | INVESTIGATION/STORY_DIALOGUE |  | 발사장 외곽 방어선은 철책·초소·대열로 되어 있지만 사람이 하나도 없다. 클레이브 계열 기갑이 초소마다 부동자세로 서 있고 점 | TBD_CANON | L14070-L14091 §2 방어선 |
| EP25_SC003 | loc_baesuro_teurenchi | STORY_WALK |  | 방어선의 사각을 뚫는 데 한나절이 걸린다. 맞이할 것을 기다리는 도열은 막을 것을 상정하지 않아, 다섯은 도열의 등 뒤로 배수 | TBD_CANON | L14092-L14097 §3 통제동 (잠입) |
| EP25_SC004 | loc_balsa_tongjedong | INVESTIGATION/STORY_CINEMATIC |  | 첫 번째로 닿은 건물은 발사 통제동이다. 먼지 아래 고요한 관제실 — 노바 1호 발사 버튼이 눌리고 귀환 궤도가 승인된 방.  | TBD_CANON | L14098-L14111 §3 통제동 |
| EP25_SC005 | loc_gyeokridong | INVESTIGATION/STORY_DIALOGUE |  | 류는 명부의 도착지를 찾아 통제동 뒤편 격리동의 잠금을 딴다. 대부분 빈 격리실에 최근까지 쓰인 흔적이 있고, 끝에서 두 번째 | TBD_CANON | L14112-L14149 §4 격리동 |
| EP25_SC006 | loc_bangpaje | STORY_DIALOGUE/STORY_CINEMATIC |  | 밤에 넷은 방파제 아래에 누워 있지만 아무도 자지 못한다. 이 년 만의 파도 소리의 박자를 아인은 세다 그만둔다. 류는 바다를 | CANON | L14150-L14189 §5 파도 |
| EP25_SC007 | loc_bangpaje | STORY_DIALOGUE/STORY_CINEMATIC |  | 이튿날 아침 정 남매를 북으로 보낸다. 류는 지도에 서 하사의 표식을 바로 선 것과 뒤집힌 것으로 나란히 그려 바로 선 것만  | TBD_CANON | L14190-L14213 §6 북으로 |
| EP25_SC008 | loc_balsajang_doro | BOSS_ENTRY/STORY_CINEMATIC | boss_jeong_janggwan | 남매를 통제동에 숨기고 나왔을 때 발사장의 공기가 바뀌어 있다. 소리 없이 의장대 전체가 일제히 넷 쪽으로 고개를 돌리고, 대 | TBD_CANON | L14214-L14255 §7 사이렌 없는 경보 |

### EP26 자화상

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP26_SC001 | loc_balsajang_doro | BOSS_ENTRY/STORY_CINEMATIC | boss_jeong_janggwan | 정 장관이었던 것이 대열 끝, 서른 걸음 앞에서 멈춘다. 담화문을 읽던 그 목소리로 문장이 아닌 명령어만 허공에 내리고, 「대 | TBD_CANON | L14256-L14301 §1 명령어 |
| EP26_SC002 | loc_balsajang_doro | BOSS_BATTLE | boss_jeong_janggwan | 첫 합에서 정체가 드러난다. 군도를 휘두르면 의장대의 열이 움직이고, 왼손이 각도를 그리면 클레이브 셋이 파고들고, 고개가 돌 | TBD_CANON | L14302-L14327 §2 지휘관 |
| EP26_SC003 | loc_balsajang_doro | BOSS_BATTLE/STORY_CINEMATIC | boss_jeong_janggwan | 군도가 세 합 만에 세라의 결계를 가르고, 다섯 번째 참격 직전 카인의 장검이 궤도를 가로챈다. 그 반 박자에 류의 잔상 두  | CANON | L14328-L14357 §3 검과 낫 |
| EP26_SC004 | loc_balsajang_doro | BOSS_BATTLE/STORY_DIALOGUE | boss_jeong_janggwan | 카인의 고함이 아인을 벽에서 뜯어내지만 군도의 원이 어깨를 스쳐 피가 흐른다. 물러서며 아인은 저것에게 없는 것 — 망설임,  | CANON | L14358-L14386 §4 마찰 |
| EP26_SC005 | loc_balsajang_doro | BOSS_BATTLE | boss_jeong_janggwan | 카인이 정면에서 관절 틈새의 주황이 터질 듯 밝아지는 세 합을 받고, 세라의 가짜 명령이 남은 의장대 절반을 반대편 활주로로  | CANON | L14387-L14408 §5 외운 원 |
| EP26_SC006 | loc_balsajang_doro | BOSS_RESULT/STORY_CINEMATIC | boss_jeong_janggwan | 목의 결정이 갈라진 정 장관은 무너지지 않고 군도를 지팡이처럼 짚고 부동자세로 선다. 「…전 장병」 뒤로 목소리가 처음 흔들리 | CANON | L14409-L14432 §6 부동자세 |
| EP26_SC007 | loc_balsadae_gangdo_ipgu | STORY_DIALOGUE/STORY_CINEMATIC |  | 의장대가 멎은 활주로 끝에서 발사대 탑이 기다리고, 탑 아래 지하로 내려가는 정비 갱도 입구가 열려 있다. 박동이 그 안에서  | TBD_CANON | L14433-L14450 §7 열리는 길 |
| EP26_SC008 | loc_balsadae_gangdo_ipgu | STORY_DIALOGUE/TRANSITION |  | 해가 바다로 내려가고 황혼이 발사장의 흰 구조물을 붉게 물들인다. 아인은 방파제 길 위로 북쪽으로 멀어지는 두 사람의 등을 돌 | TBD_CANON | L14451-L14493 §8 갱도 앞에서 |

### EP27 경고

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP27_SC001 | loc_jeongbi_gangdo | STORY_WALK/INVESTIGATION |  | 갱도는 발사대의 뿌리로 내려간다. 내려갈수록 결정이 이끼처럼, 힘줄처럼, 마침내 벽 자체가 되고, 랜턴 빛이 벽에 스며 맥박처 | TBD_CANON | L14494-L14527 §1 갱도 |
| EP27_SC002 | loc_balsadae_jiha | BOSS_ENTRY/STORY_CINEMATIC | boss_nano_nova_core | 지하 공간의 절반을 채운 결정의 산. 노바 1호 귀환 캡슐 잔해가 골격이고 찢긴 내열판과 좌석 프레임이 화석처럼 비치며, 수거 | CANON | L14528-L14547 §2 돌아온 것 |
| EP27_SC003 | loc_balsadae_jiha | STORY_DIALOGUE/BOSS_ENTRY | boss_nano_nova_core | 말이 코어를 직접 두드리는 공명으로 온다. 위의 겹은 산 전체의 낮고 넓은 목소리로 「돌아왔구나. 잘 익은 것들이」라 반기고, | CANON | L14548-L14585 §3 두 목소리 |
| EP27_SC004 | loc_balsadae_jiha | STORY_DIALOGUE/FLASHBACK | boss_nano_nova_core | 그 말이 이 년을 한 줄로 꿴다. 강남의 클레이브, 여의도의 에이지스, 터널의 레비아탄, 골짜기의 그것 — 모두 죽을힘을 다하 | CANON | L14586-L14619 §4 배송 |
| EP27_SC005 | loc_balsadae_jiha | STORY_DIALOGUE | boss_nano_nova_core | 차한별의 겹이 관찰자의 언어로 신경계가 있어야 자라고 흙 없이 자라는 씨앗은 없다고 말한다. 세라가 사람이 배양기라는 것을 완 | CANON | L14620-L14647 §4-2 배양기 |
| EP27_SC006 | loc_balsadae_jiha | STORY_DIALOGUE | boss_nano_nova_core | 등급의 정체는 실력도 성숙도만도 아닌 출력 — 목의 것은 처음부터 송신기였고 등급은 도달 거리였다. 류가 수거를 묻자, 모자란 | TBD_CANON | L14648-L14679 §4-3 모으는 이유 |
| EP27_SC007 | loc_balsadae_jiha | STORY_DIALOGUE/BOSS_ENTRY | boss_nano_nova_core | 아인이 우리는 어떠냐고 묻자, 너희는 옮길 필요가 없고 다 익은 것은 제 발로 온다는 답이 온다. 익지 않은 것은 실어 날라야 | TBD_CANON | L14680-L14723 §4-4 걸어오게 하는 것 |
| EP27_SC008 | loc_balsadae_jiha | BOSS_BATTLE | boss_nano_nova_core | 결정의 산이 형태를 바꿔 수백의 코어가 표면에 떠올라 빛나고 사면에서 팔이 자란다. 첫 팔은 강남 클레이브처럼 셔터를 방패로  | TBD_CANON | L14724-L14747 §5 개전 |
| EP27_SC009 | loc_balsadae_jiha | BOSS_BATTLE | boss_nano_nova_core | 셔터 방패의 경첩을 카인의 장검이 꿰고, 무음의 장막 안에서 아인의 수신호가 넷의 자리를 가르며, 접히는 공간의 이음매를 임계 | TBD_CANON | L14748-L14774 §6 복습 |
| EP27_SC010 | loc_balsadae_jiha | BOSS_BATTLE | boss_nano_nova_core | 원은 바깥이 가장 빠르고 중심이 가장 느리다. 낫잡이의 규칙이 반대로 다섯을 살려, 거대한 원의 안쪽 — 궤적 중심 가까이 — | TBD_CANON | L14775-L14794 §7 원의 안쪽 |
| EP27_SC011 | loc_balsadae_jiha | BOSS_BATTLE | boss_nano_nova_core | 실마리는 적의 안에서 온다. 거대한 원의 팔이 세 번째 궤적을 그리려는 순간 중심의 얼굴이 일그러지며 팔이 반 박자 멎고, 밑 | CANON | L14795-L14818 §8 지금 |
| EP27_SC012 | loc_balsadae_jiha | BOSS_BATTLE | boss_nano_nova_core | 밖의 다섯과 안의 하나, 여섯이 싸운다. 차한별의 정지가 박자를 만들면 다섯이 밟는다. 세라가 마지막 촉매 두 병으로 산의 표 | CANON | L14819-L14836 §9 마지막 협공 |
| EP27_SC013 | loc_balsadae_jiha | BOSS_BATTLE/STORY_CINEMATIC | boss_nano_nova_core | 아인은 멈추지 않는다. 떨어지는 궤적들이 선으로 서고, 그 사이 좁은 한 번뿐인 길이 있다. 사거리 — 여덟 걸음의 마지막 두 | CANON | L14837-L14864 §10 한 번 |
| EP27_SC014 | loc_balsadae_jiha | BOSS_RESULT/STORY_CINEMATIC | boss_nano_nova_core | 수백의 코어가 바깥쪽부터 등을 끄고 잠드는 집처럼 하나씩 꺼지고, 팔들이 무너져 사면이 되며, 위의 목소리는 사라졌다기보다 아 | CANON | L14865-L14900 §11 꺼지는 산 |
| EP27_SC015 | loc_balsadae_jiha | STORY_CINEMATIC/INVESTIGATION |  | 재난의 첫날부터 세계 밑바닥에 깔려 있던 거대한 박동이 멎고, 귀가 멍할 만큼 완전한 고요가 온다. 카인은 장검을 짚고 주저앉 | CANON | L14901-L14928 §12 멎지 않는 것 |
| EP27_SC016 | loc_jeongbi_gangdo | STORY_DIALOGUE/STORY_WALK/TRANSITION |  | 세라가 계측기를 열고 삼 초 만에 냉정이 무너진다. 그래프가 넷 다 아직 자라고 있고, 이 싸움이 마지막 익힘이었다. 발사대는 | TBD_CANON | L14929-L14971 §13 신호는 |

### EP28 황혼의 서울: 사신의 각인

| Scene | 장소 | GameMode | 보스 | 요약 | Canon | 원문 |
|---|---|---|---|---|---|---|
| EP28_SC001 | loc_goheung_balsajang | STORY_DIALOGUE/BOSS_ENTRY | boss_balsadae_tap | 갱도를 거슬러 지상에 나오자 발사대 탑의 뼈대 전체가 목덜미로 듣는 노래를 부르고, 박자를 맞출 때마다 그래프가 한 눈금씩 자 | CANON | L14972-L15007 §1 노래하는 탑 |
| EP28_SC002 | loc_balsadae_tap | BOSS_BATTLE | boss_balsadae_tap | 탑에는 심장이 없어 벨 곳이 없지만 구조가 있다 — 주각 넷, 트러스, 결정이 신경처럼 오른 케이블 다발. 세라는 같은 쪽 주 | TBD_CANON | L15008-L15035 §2 마지막 전투 |
| EP28_SC003 | loc_bangpaje | BOSS_RESULT/STORY_CINEMATIC | boss_balsadae_tap | 주각 둘을 잃은 탑이 제 무게에 바다 쪽으로 기울고 트러스가 차례로 비명을 지르며, 이 반도에서 가장 높았던 것이 새 없는 하 | TBD_CANON | L15036-L15063 §3 넘어가는 탑 |
| EP28_SC004 | loc_bangpaje | STORY_CINEMATIC/STORY_DIALOGUE |  | 그날 낮 방파제 끝에서 넷의 그래프가 마지막 눈금에 닿는다. 빛기둥도 굉음도 없이 — 아인의 스무 걸음은 백 걸음이 되어 파도 | CANON | L15064-L15095 §4 문턱의 아침 |
| EP28_SC005 | TBD_CANON | STORY_DIALOGUE/TRANSITION |  | 아인이 서울로 가자고 한다. 벙커가 등급과 수거의 진실을 알아야 하고, 억제제를 양산할 수 있는 세라와 닥터 진이 만나야 하며 | TBD_CANON | L15096-L15117 §5 돌아가는 길 |
| EP28_SC006 | loc_bukhyang_gukdo | STORY_WALK/TRANSITION |  | 한 달의 귀로. 심장이 꺼진 뒤 집행관들의 순찰은 흐트러졌고 어떤 것들은 제자리에서 움직이지 않는다. SS의 몸 앞에서 싸움이 | TBD_CANON | L15118-L15140 §6 황혼의 귀로 |
| EP28_SC007 | loc_gangnam_bunker_cheolmun | STORY_CINEMATIC/STORY_DIALOGUE |  | 강남 벙커 철문 앞에서 경비 오정길이 먼저 알아보고, 넷을 하나씩 눈으로 세어 넷이 온전히 돌아온 것을 확인한 뒤 귀환의 종을 | TBD_CANON | L15141-L15152 §7 벙커 (귀환) |
| EP28_SC008 | loc_bunker_gwanjesil | STORY_DIALOGUE |  | 그날 밤 관제실에서 넷은 등급의 정체, 수거의 이유, 억제제의 뜻, 탑과 심장과 신호까지 전부를 보고한다 — 함구령의 시대는  | CANON | L15153-L15166 §7 벙커 (관제실 보고) |
| EP28_SC009 | loc_bunker_uimusil | STORY_DIALOGUE/INVESTIGATION |  | 이튿날 의무실에서 세라와 닥터 진이 억제제(성숙 지연제) 양산을 위해 배합식을 나란히 놓는다. 세라의 눈은 배합식이 아니라 획 | TBD_CANON | L15167-L15190 §8 두 개의 처방 |
| EP28_SC010 | loc_bunker_oksang | STORY_DIALOGUE/STORY_CINEMATIC |  | 돌아온 지 이레째 저녁, 넷은 벙커 옥상 난간에 나란히 기댄다 — 낫을 어깨에 건 아인, 장검을 짚은 카인, 후드를 벗은 류, | CANON | L15191-L15224 §9 옥상 |
| EP28_SC011 | loc_gangnam_bunker | STORY_CINEMATIC |  | 그 밤 아인은 등잔 밑에서 남쪽까지 갔다 온 장부 — 콘솔 위에 두고 온 원본을 유진이 밤새 옮겨 적은 사본 — 을 편다. 끝 | TBD_CANON | L15225-L15244 §10 이름 |
| EP28_SC012 | loc_bunker_aideul_guyeok | STORY_DIALOGUE/STORY_CINEMATIC |  | 며칠 뒤 저녁 아이들 구역에서 두호가 두나에게 셈을 가르친다 — 한 번이면 기다려, 두 번이면 형이 와, 어디 있어도. 두나가 | CANON | L15245-L15264 §11 노크 |
| EP28_SC013 | loc_bunker_oegwak_choso | STORY_CINEMATIC |  | 저녁 배급 뒤 두호와 두나는 오정길의 외곽 깡통 경보 점검 순찰을 따라다닌다 — 구경에서 수업으로, 이제는 임무로. 그날 저녁 | CANON | L15265-L15284 §12 후임들 |
| EP28_SC014 | loc_bunker_oegwak_choso | STORY_CINEMATIC |  | 두나는 별들 사이에서 움직이는 별 하나를 보고 「새다」라고 중얼거리지만 새가 아니다. 별들보다 높은 곳에서 다른 빛으로, 천천 | TBD_CANON | L15285-L15321 §13 응답 |

## 6. TBD_CANON (작가 확인 필요)

| EP | Scene | 질문 |
|---|---|---|
| EP01 | EP01_SC001 | [판본 충돌] 서식 3-A '최초 계측일 2030.05.11 / 등급 C / 변동 없음' vs 본문 '이 년 무등록 끝에 오늘 첫 등록'(L227-L231)·서울 하늘 '이 년째'(L55)·국방부 문서 2030.03.04 — 오늘 날짜가 2030.05.11인지, 연표가 어떻게 맞는지 불명. |
| EP01 | EP01_SC002 | [판본 충돌] 【서】의 허수아비는 '목제 몸통/사람 크기의 목제 표적, 표면에 칼자국'(L11-L15)인데 본문은 '짚단 허수아비, 짚이 삐져나오고 나무 뼈대'(L373) — 재질·외형 기준 확정 필요. |
| EP01 | EP01_SC002 | [판본 충돌/연출] 【서】는 각성 순간 아인이 '열 걸음 거리'에서 낫을 들고 있다가 소리에 손이 멈춘다고 하나, 본문(L415-L459)은 짚단을 벤 직후 근접 상태에서 폭발 충격파로 매트를 구른다 — 거리·순서 정합 방식 TBD. |
| EP01 | EP01_SC002 | 두 번째(작은) 목소리·일정 간격 신호음의 정체 — 원고가 의도적으로 끊음. |
| EP01 | EP01_SC005 | 놓친 작은 손의 주인과 셔터 사건의 장소·시점 — 원고가 밝히지 않음(의도적 미해결). |
| EP01 | EP01_SC008 | 벙커 입장~배급 줄 구간에서 카인의 동행 여부가 서술되지 않음(재촉 장면에서는 '뒤에서' 등장). |
| EP01 | EP01_SC008 | 실종자 벽보 중 군복 차림 인물의 정체 — 복선, 미해결. |
| EP01 | EP01_SC009 | 한 장인이 석 달 전부터 두 손으로 드는 이유 — '둘 다 알지만 말하지 않음'(L173), 원고 미서술. |
| EP01 | EP01_SC012 | 잉크를 두고 간 사람 — '적혀 있지 않았다'(L319), 마태오로 암시만. |
| EP01 | EP01_SC013 | 허수아비 위치: 사무소 '방 구석'(L371-L373)을 가리키는데 호흡 테스트는 '지하 훈련장'(L381), 【서】는 '이 년 동안 그 자리에 묶여 있던 것' — 사무소와 훈련장의 공간 관계(관측창) 미서술. |
| EP01 | EP01_SC013 | CRT 무음 생일 영상 속 여자·아이들의 정체 — 미서술. |
| EP01 | EP01_SC015 | 보스 고유 명칭 — 원고는 '훈련용 짚단 허수아비'/'놈'으로만 지칭. 허수아비 발밑 문양의 정체도 미서술. |
| EP01 | EP01_SC016 | BossPhase P1~P3 구분은 원고에 없음 — 전 전투 장면을 P1로 두고 PhasesInNovel에 서술 비트만 기록. |
| EP01 | EP01_SC017 | 되받아치기(카인) 장면에서 플레이어가 카인을 조작하는지, 아인 조작 중 동료 연계인지 — 원고가 정하지 않음(게임 설계 결정). |
| EP01 | EP01_SC019 | 본체를 최종으로 죽인 타격이 서술되지 않음 — 카인이 '세게 쳤다'는 대화(L583-L587)와 회색 가루로만 암시. |
| EP01 | EP01_SC004 | 아인·카인의 의상 형태(상의·하의·장갑 등)가 원고에 서술되지 않음(카인은 '수트'로만 언급 L383). |
| EP01 | EP01_SC001 | 장소가 원고에 서술되지 않음: 서식 문서 인서트 — 배경 공간 없음 |
| EP01 | EP01_SC001 | 시각(TimeOfDay)이 원고에 명시되지 않음 (문서 인서트; 최초 계측일 2030.05.11 기재) |
| EP01 | EP01_SC002 | 시각(TimeOfDay)이 원고에 명시되지 않음 (본편 기준 여섯 시간 뒤 시점) |
| EP01 | EP01_SC003 | 장소가 원고에 서술되지 않음: 문서 인서트 — 배경 공간 없음 |
| EP01 | EP01_SC003 | 시각(TimeOfDay)이 원고에 명시되지 않음 (문서 기재 2030.03.04 05:20) |
| EP01 | EP01_SC005 | 장소가 원고에 서술되지 않음: 셔터 기억의 장소(원고가 의도적으로 밝히지 않음) |
| EP01 | EP01_SC005 | 시각(TimeOfDay)이 원고에 명시되지 않음 (과거, 시점 미서술) |
| EP01 | EP01_SC009 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하 실내; 옥상 장면과 같은 날, 【서】 시점 '여섯 시간 전' 이후) |
| EP01 | EP01_SC010 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하 실내; 옥상 장면과 같은 날, 【서】 시점 '여섯 시간 전' 이후) |
| EP01 | EP01_SC011 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하 실내; 옥상 장면과 같은 날, 【서】 시점 '여섯 시간 전' 이후) |
| EP01 | EP01_SC012 | 시각(TimeOfDay)이 원고에 명시되지 않음 (회상 시점 미상 → 현재) |
| EP01 | EP01_SC013 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하 실내; 옥상 장면과 같은 날, 【서】 시점 '여섯 시간 전' 이후) |
| EP01 | EP01_SC014 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하 실내; 옥상 장면과 같은 날, 【서】 시점 '여섯 시간 전' 이후) |
| EP01 | EP01_SC015 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하 실내; 옥상 장면과 같은 날, 【서】 시점 '여섯 시간 전' 이후) |
| EP01 | EP01_SC016 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하 실내; 옥상 장면과 같은 날, 【서】 시점 '여섯 시간 전' 이후) |
| EP01 | EP01_SC017 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하 실내; 옥상 장면과 같은 날, 【서】 시점 '여섯 시간 전' 이후) |
| EP01 | EP01_SC018 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하 실내; 옥상 장면과 같은 날, 【서】 시점 '여섯 시간 전' 이후) |
| EP01 | EP01_SC019 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하 실내; 옥상 장면과 같은 날, 【서】 시점 '여섯 시간 전' 이후) |
| EP01 | EP01_SC020 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하 실내; 옥상 장면과 같은 날, 【서】 시점 '여섯 시간 전' 이후) |
| EP01 | EP01_SC021 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하 실내; 옥상 장면과 같은 날, 【서】 시점 '여섯 시간 전' 이후) |
| EP01 | EP01_SC022 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하 실내; 옥상 장면과 같은 날, 【서】 시점 '여섯 시간 전' 이후) |
| EP02 | EP02_SC001 | 아인에게 세 가지를 가르친 첫 스승의 정체·이름 — 원고 미서술. |
| EP02 | EP02_SC007 | 스크린도어 옆 시 액자가 물때 하나 없이 깨끗한 이유 — 원고 미서술(의도적 디테일). |
| EP02 | EP02_SC008 | non-boss combat in novel — game representation TBD (쇼윈도 리퍼). 리퍼 수(최소 2체)와 마지막 '콰직'(L1454)의 타격자·'지금.'(L1452) 화자도 미명시. |
| EP02 | EP02_SC009 | 두호의 나이 — 카인의 '여덟 살이면 이 정도 무게였던가'(L1504)뿐이고, 여덟 살로 명시된 건 동생 두나(L1550). |
| EP02 | EP02_SC011 | non-boss combat in novel — game representation TBD (광장의 2미터급 감염체, 고유 명칭 미서술). |
| EP02 | EP02_SC011 | '…의뢰 아니다.'/'알아.'(L1652-L1654), '…어깨 장갑, 왼쪽이 벌어졌어.'/'끌면 돼?'(L1660-L1662)의 화자 태그 없음 — 문맥상 카인/아인으로 추정되어 Dialogue에서 제외. |
| EP02 | EP02_SC012 | '총 버려요'·'쏘면 소리 듣고 더 와요'·'그래서 죽었어요?'(L1714-L1730)는 본문에 화자 태그가 없음 — L1736 '카인이 잠깐 말이 없었다'와 작가 노트(L1977)에 근거해 카인으로 귀속. |
| EP02 | EP02_SC013 | '…저건 정찰대가 아니야.'(L1798) 화자 미명시(아인/카인), '벌레 같은 생존자들이여…'(L1800)도 태그 없음 — 클레이브로 귀속. |
| EP02 | EP02_SC013 | 클레이브가 이쪽을 보고도 지나간 이유 — 아인은 못 봤다고 생각하지만 원고는 판단을 유보(작가 노트상 후속 회수). |
| EP02 | EP02_SC014 | 총을 쏜 생존자가 누구인지, '…아, 씨.'(L1844)의 화자 — 미명시. |
| EP02 | EP02_SC014 | 클레이브의 약점 부위·BossPhase 구분이 원고에 없음 — 교전을 P1 하나로 둠. |
| EP02 | EP02_SC001 | 아인·카인의 의상 형태 미서술; EP01 말미 부상(어깨·갈비뼈)이 이 화 동작에 미치는 영향도 언급 없음. |
| EP02 | EP02_SC007 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하상가 내부, 지상 이동 직후) |
| EP02 | EP02_SC008 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하상가 내부, 지상 이동 직후) |
| EP02 | EP02_SC009 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하상가 내부, 지상 이동 직후) |
| EP02 | EP02_SC010 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하상가 내부, 지상 이동 직후) |
| EP02 | EP02_SC011 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하상가 내부, 지상 이동 직후) |
| EP02 | EP02_SC012 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하상가 내부, 지상 이동 직후) |
| EP02 | EP02_SC013 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하상가 내부, 지상 이동 직후) |
| EP02 | EP02_SC014 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하상가 내부, 지상 이동 직후) |
| EP02 | EP02_SC015 | 시각(TimeOfDay)이 원고에 명시되지 않음 (지하상가 내부, 지상 이동 직후) |
| EP03 | EP03_SC001 | EP02 전투와 재전투 사이 경과 일수 불명확: 1절은 탈출 직후, 2절은 '어제', 3절 단조는 '다음 날' 완료, 그런데 7절은 '광장은 어제 그대로/어제 못 빠져나온 사람'. 각 씬의 시각(TimeOfDay)도 대부분 미기재. |
| EP03 | EP03_SC001 | 아인·카인·한 장인·마태오·유진·두호의 EP03 의상 묘사 없음(전 씬 RequiredCostumes TBD). |
| EP03 | EP03_SC002 | 아인이 바닥에 경첩을 그리는 장소 미기재(벙커 외곽 통로인지 불명). |
| EP03 | EP03_SC002 | '…한 점에 몰아넣는 건, 내가 해.'(L2149) 화자 표기 없음 — 문맥상 아인으로 처리. |
| EP03 | EP03_SC006 | 마태오 사무소를 찾아가 '…예/네/알아요'라고 답하는 인물이 누구인지(아인/카인/둘 다) 미기재. |
| EP03 | EP03_SC008 | 재출격의 명시적 동기(의뢰·보상 여부) 미기재 — 마태오는 의뢰서를 아직 안 썼다고만 함. |
| EP03 | EP03_SC016 | 신호음·교신이 나온 '수트 흉부'가 누구의 수트인지(클레이브 잔해로 추정) 및 교신 화자 미기재. |
| EP03 | EP03_SC017 | L3536-L3554(벙커 귀환·두호) 단락이 '14. B' 안에 있고 15절 첫머리(L3740-L3758)와 동일. 이어지는 '14. 오정길'은 다시 선로 장면 — 편집 잔존 중복인지, 배치 순서가 어떻게 되는지 확정 필요. |
| EP03 | EP03_SC018 | '그가 데려온 사람 중 둘이 죽었다… 카인이 하나는 끌어냈고, 둘은 못 했다'(L3568) — 6절은 '세 사람이 안개 속으로'(L2521), 9절은 진열대 아래 오정길 한 명만 묘사. 동행자 수·신원 불명확. |
| EP03 | EP03_SC018 | 집필 노트는 '남자는 죽는다(보상 없음)'(L3931)라고 하나 본문에서 오정길은 생존해 이름을 밝힘. 본문 기준으로 처리. |
| EP03 | EP03_SC019 | 아인이 두호에게 준 억제제 병을 어디서 얻었는지 EP03 본문에 없음. |
| EP03 | EP03_SC010 | 카인의 대검은 선로 위층 광장 물속에 남은 채 EP03이 끝남 — 회수 여부/시점 미기재. |
| EP03 | EP03_SC018 | 집필 노트의 '카인이 챙긴 탄창'(L3942)은 본문에 등장하지 않음. |
| EP04 | EP04_SC001 | 카인이 대검을 건진 전날 밤(무너진 광장→물이 가슴까지 찬 선로)은 서술로만 제시됨. 회상 장면으로 게임화할지, 해당 장소의 모습은 미정. |
| EP04 | EP04_SC002 | 마태오의 홀로그램 테이블이 있는 공간의 명칭·구조 미서술. '…강 건너요?'의 화자 미지정. |
| EP04 | EP04_SC003 | 반쯤 남은 다리의 이름 미서술(반포·동작·한남은 끊긴 다리로만 열거). 로프로 어떻게 건넜는지 과정도 서술 없음. |
| EP04 | EP04_SC003 | EP04_SC003~SC015 시간대 미서술(같은 날인지, 몇 시인지). §7에 '황혼'빛 묘사만 있음. |
| EP04 | EP04_SC003 | 오정길·마태오·닥터 진의 의상, 그리고 오정길 총의 종류가 이 화에 서술되지 않음. |
| EP04 | EP04_SC007 | 케이블카 안에 '앉은 자세로' 있는 사람들이 시신인지, 와이어에 걸린 넷의 신원은 무엇인지 미서술(넷의 이름은 EP05에서 오정길이 적지만 본문에 공개되지 않음). |
| EP04 | EP04_SC009 | '…난간을 부수고 있어.' / '왜?' / '떨어뜨리려고.'의 화자 미지정. |
| EP04 | EP04_SC009 | 화 제목은 「케이블카 드로퍼」이지만 이 화에 등장하는 적은 셀레스티얼이고, '케이블카 드로퍼'라는 이름의 개체(중장갑 4체)는 EP05에 별도로 등장함. EP04 보스를 셀레스티얼로 처리했으나 제목과의 관계 확인 필요. |
| EP04 | EP04_SC010 | 셀레스티얼의 약점·브레이크 수단은 본문에 없음(EP04는 격파 불가 전투). 게임에서 '닿지 않는 전투'를 어떻게 종료 조건화할지 미정. 카인이 긁힌 어깨가 좌우 어느 쪽인지도 미서술. |
| EP04 | EP04_SC012 | 업혀서 계단을 내려온 뒤 벙커 의무실까지의 귀환 과정 미서술. |
| EP04 | EP04_SC014 | 억제제 장면의 장소가 명시되지 않음(닥터 진의 책상 — 의무실로 추정 처리). |
| EP05 | EP05_SC001 | EP05 전 장면의 시간대 미서술(EP04 다음 날로 읽히나 명시적 시각 없음). 훈련장의 위치·구조도 미서술. |
| EP05 | EP05_SC001 | 아인·카인의 기본 의상과 오정길·마태오·닥터 진·유진의 의상이 이 화에 서술되지 않음. |
| EP05 | EP05_SC002 | 마태오의 계산기·장부 자리가 EP04의 홀로그램 테이블과 같은 공간인지, 출격문과의 위치 관계 미서술. '네.'(L4933)의 화자 미지정. |
| EP05 | EP05_SC003 | '…안 오는데.' / '순찰 나간 거 아닐까요.'의 화자 미지정. |
| EP05 | EP05_SC004 | '…발톱이 넷이야.'의 화자 미지정. |
| EP05 | EP05_SC005 | 케이블카 드로퍼와의 교전 — non-boss combat in novel — game representation TBD. (집필 노트상 이 화의 보스는 '안 잡는다'이며, 드로퍼 4체는 보스로 명시되지 않음. EP04 화 제목 「케이블카 드로퍼」와의 관계 확인 필요.) '…아래로.' 등 대사 화자 미지정. |
| EP05 | EP05_SC006 | '…군 시설이 왜 여기 있어.'의 화자 미지정. |
| EP05 | EP05_SC009 | '…이거 뭡니까.'의 화자 미지정(말투상 오정길로 보이나 명시 없음). |
| EP05 | EP05_SC011 | 케이블카 드로퍼 재교전(3체 처치, 1체 도주) — non-boss combat in novel — game representation TBD. 도주한 1체의 이후 행방 미서술. |
| EP05 | EP05_SC012 | '어제 그 시신들. 인식표가 전부 B랑 A였어요'와 '시신 여섯을 봤을 때 … 이틀 전부터'가 가리키는 시신(와이어의 넷인지, 이전 화의 여섯인지)과 시점이 불명확. |
| EP05 | EP05_SC012 | 셀레스티얼은 이 화에 등장하지 않음 — 보스전 없음. 여의도 인수인계의 '인수 대상'이 무엇인지 미서술. |
| EP05 | EP05_SC014 | 시신 넷의 이름(의도적 비공개), 케이블카 안 앉은 자세의 사람들 처리 여부, 남산에서 벙커로의 귀환 과정 미서술. |
| EP05 | EP05_SC016 | 진찰 시 아인이 K-3를 착용하고 있었는지 미서술(뼈대가 지난 자리를 훑었다고만 함). |
| EP06 | EP06_SC001 | 브리핑 장소 미기술(홀로그램이 있는 곳 — 마태오 사무소인지 불명) |
| EP06 | EP06_SC001 | '다리는요.', '…배는요.' 화자 미기술 |
| EP06 | EP06_SC001 | 아인·오정길이 이 자리에 있는지 미기술 |
| EP06 | EP06_SC002 | '…이걸 어떻게.' 화자 미기술 |
| EP06 | EP06_SC003 | 공동구 진입 시 동행 인원 명시 없음(§5에서 '셋'으로 확인 — 아인·오정길·카인) |
| EP06 | EP06_SC006 | '…사람인 줄 알았습니다.' / '…나도.' 화자 미기술 |
| EP06 | EP06_SC007 | '감염체?', '…놈들이 가져갔나.' 화자 미기술 |
| EP06 | EP06_SC008 | '뭘?' 화자 미기술 |
| EP06 | EP06_SC010 | 카인의 대사 내용 미기술(목소리만) |
| EP06 | EP06_SC011 | '…지금.' 화자 미기술 |
| EP06 | EP06_SC011 | '빠져요!' 화자 미기술 |
| EP06 | EP06_SC011 | 놈의 뒤에서 지나간 존재의 형태 미기술(사람 같기도 함) |
| EP06 | EP06_SC012 | '…뭐였어. 그 뒤에 있던 거.' 화자 미기술 |
| EP06 | EP06_SC012 | 시간대 미기술 |
| EP06 | EP06_SC003 | SC003~SC010 시간대(주간/야간) 미기술 |
| EP06 | EP06_SC003 | 파티 기본 의상 미기술 |
| EP06 | EP06_SC010 | K-3 뼈대의 정체(장비/보철) 이 화 산문에서 미기술 |
| EP07 | EP07_SC001 | '여기서 불꽃이 튀었어요.'(L6640) 화자 미기술 |
| EP07 | EP07_SC003 | '…아침이라 그런가 봅니다.' 화자 미기술 |
| EP07 | EP07_SC003 | 공동구 통과 과정 산문 생략 |
| EP07 | EP07_SC004 | '같은 놈?' 화자 미기술 |
| EP07 | EP07_SC007 | '…누구야.'(L6933) 화자 미기술 |
| EP07 | EP07_SC007 | '…왜 도와줘요.'(L6949) 화자 미기술 |
| EP07 | EP07_SC007 | 협상 중 에이지스-07의 위치·상태(교전 중단 여부) 미기술 |
| EP07 | EP07_SC008 | '꺼졌어요!' 화자 미기술 |
| EP07 | EP07_SC010 | 파편 세 개 외 나머지 잔해·코어 본체의 처리 미기술 |
| EP07 | EP07_SC011 | 카인·오정길이 이 대화에 동석했는지 미기술 |
| EP07 | EP07_SC013 | 어깨 부상의 구체 상태·처방 내용 미기술 |
| EP07 | EP07_SC013 | 시간대 미기술 |
| EP07 | EP07_SC005 | SC005~SC012 시간대가 '아침' 이후 어떻게 흐르는지 미기술(SC003 L6738 '아침' 기준으로 기입) |
| EP07 | EP07_SC001 | 파티 기본 의상 미기술(류 후드 외) |
| EP07 | EP07_SC001 | SC001·SC002 시간대 미기술 |
| EP08 | EP08_SC001 | '깊이는.' / '모릅니다. 도면은 재난 전 거니까요.' 화자 미기술 |
| EP08 | EP08_SC001 | 시간대 미기술 |
| EP08 | EP08_SC002 | 편성 장면 장소 미기술(관제실 연속인지 불명) |
| EP08 | EP08_SC003 | '팔십이면 되나.' 화자 미기술 |
| EP08 | EP08_SC003 | 입구 장면에 류·강 씨·아인·카인이 모두 있는지 명시 없음(§4 '넷'으로 추정) |
| EP08 | EP08_SC005 | '어디야!' 화자 미기술(카인이 케이블을 당긴 직후) |
| EP08 | EP08_SC005 | L7454 '삼 년을 그린 원' — 다른 곳의 '이 년'과 불일치, 설정 확인 |
| EP08 | EP08_SC006 | 강 씨의 최후(사망 확인 여부) — 산문은 '벽 쪽으로 도는 것'까지와 대장 '손실' 처리만 기술 |
| EP08 | EP08_SC007 | non-boss combat in novel — game representation TBD (감염된 현 중위를 한 번에 처치) |
| EP08 | EP08_SC007 | '스승'의 정체 이 화 산문에서 미기술 |
| EP08 | EP08_SC009 | 장소 미기술(입구 바깥 야영지로 추정되나 명시 없음) |
| EP08 | EP08_SC009 | '…이게 뭔데요.'(L7603) 화자 미기술 |
| EP08 | EP08_SC009 | 류가 이 장면에 있는지 미기술 |
| EP08 | EP08_SC010 | 재진입 인원 '넷'의 구성 미기술(강 씨 부재 — 아인·카인·류 + 케이블 너머 오정길로 추정) |
| EP08 | EP08_SC011 | 오정길이 입구 윈치에 있는지 물속 케이블 근처에 있는지 미기술('케이블 너머') |
| EP08 | EP08_SC012 | 물러난 뒤 대화 장소 — '물가'(L7719)로만 기술, 입구 물가로 기입 |
| EP08 | EP08_SC012 | 오정길 동석 여부 미기술 |
| EP08 | EP08_SC005 | 보스 명칭 미기술(EP07 예고 제목 '물속에는 얼굴이 있다'와 달리 산문에 '얼굴' 묘사 없음) |
| EP08 | EP08_SC001 | 파티 기본 의상 미기술 |
| EP08 | EP08_SC003 | SC003~SC007 시간대 미기술 |
| EP09 | EP09_SC001 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC002 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC003 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC004 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC004 | 전술 테이블이 놓인 방의 명칭(관제실과 동일 공간인지) 미명시 |
| EP09 | EP09_SC005 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC006 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC006 | 대사의 화자가 원고에 명시되지 않음 |
| EP09 | EP09_SC006 | 마태오 외 관제실 동석 인물 미명시 |
| EP09 | EP09_SC007 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC008 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC009 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC010 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC011 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC012 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC013 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC014 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC015 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC016 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC017 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC017 | '…끝난 건가.'의 화자 표기 없음 — 아인의 응답 구조상 마태오로 추정 |
| EP09 | EP09_SC018 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC018 | 류가 지분을 받은 장소 미명시 |
| EP09 | EP09_SC019 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC020 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC020 | 카인이 담배를 피운 장소 미명시 |
| EP09 | EP09_SC021 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP09 | EP09_SC008 | 보스의 정식 명칭이 원고에 없음 ('놈', '덩어리', '질량'으로만 지칭) — 보스 이름 TBD |
| EP09 | EP09_SC014 | 놈 내부의 얼굴들의 정체(수거·흡수된 사람들인지) 미명시 |
| EP10 | EP10_SC001 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP10 | EP10_SC002 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP10 | EP10_SC003 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP10 | EP10_SC004 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP10 | EP10_SC005 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP10 | EP10_SC005 | non-boss combat in novel — game representation TBD (클레이브 2기와의 교전) |
| EP10 | EP10_SC006 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP10 | EP10_SC007 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP10 | EP10_SC008 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP10 | EP10_SC008 | '강남 벙커. 용병이다.'(L8448) 화자 미명시 |
| EP10 | EP10_SC009 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP10 | EP10_SC009 | 수거하는 자들의 정체는 이 화에서 미명시 (남자도 모름) |
| EP10 | EP10_SC010 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP10 | EP10_SC010 | 대사의 화자가 원고에 명시되지 않음 |
| EP10 | EP10_SC010 | 중계소 동행 인원 중 서 하사 외 탈영병 동행 여부 미명시(서 하사는 L8568에서 동석 확인) |
| EP10 | EP10_SC011 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP10 | EP10_SC012 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP10 | EP10_SC014 | 행렬의 정체와 운반물의 형태 미명시 |
| EP10 | EP10_SC005 | 에피소드 헤더의 결과 '무승부'가 무엇을 가리키는지(보스 부재) 게임 반영 방식 TBD |
| EP11 | EP11_SC005 | 능선(관측 지점)과 공터의 거리 — 계측기 신품 여부까지 보이는 시점 설정 미명시 |
| EP11 | EP11_SC008 | non-boss combat in novel — game representation TBD (방호복 인원·클레이브와의 난전) |
| EP11 | EP11_SC009 | non-boss combat in novel — game representation TBD (방호복 인원·클레이브와의 난전) |
| EP11 | EP11_SC010 | '밤의 은신처'가 §1의 과천 방면 고가 아래 은신처와 같은 곳인지 명시 없음 |
| EP11 | EP11_SC012 | 철책(이송 종점)의 위치 미명시 |
| EP11 | EP11_SC006 | 「제OO수거대」의 부대 번호(OO)는 원고상 가려져 있음 — 표기 방식 TBD |
| EP12 | EP12_SC003 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP12 | EP12_SC005 | '허수아비 값'과 마태오만 아는 '이 년 전 장부의 칸' 내용 — 이 화에서 미공개 |
| EP12 | EP12_SC008 | 마태오 서랍 속 이 년치 서류철의 내용 미공개 |
| EP12 | EP12_SC014 | 아인의 자리(숙소)의 벙커 내 위치 미명시 |
| EP13 | EP13_SC002 | '여덟 살은 열 살이 되었고'(L9339)가 두호·두나 중 누구의 나이인지 문장상 모호 — 두 아이의 나이 TBD |
| EP13 | EP13_SC003 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP13 | EP13_SC004 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP13 | EP13_SC005 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP13 | EP13_SC005 | 회상 장소(거리·건물) 미명시 |
| EP13 | EP13_SC005 | 줄 옆에 서 있던 '그것들'의 종류(클레이브 등) 미명시 |
| EP13 | EP13_SC006 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP13 | EP13_SC007 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP13 | EP13_SC008 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP13 | EP13_SC009 | 시간대(낮/밤)가 원고에 명시되지 않음 |
| EP13 | EP13_SC010 | 뒤집힌 표식 앞 대화('…오지 말라는 거지.' 등, L9486-L9490)의 화자 미명시 |
| EP13 | EP13_SC011 | §8 목록 장면의 구체적 장소 미명시 (과천을 지난 이틀째 저녁) |
| EP13 | EP13_SC011 | L9508·L9520 대사의 화자 표기 없음 — 문맥상 아인·카인으로 배정 |
| EP13 | EP13_SC011 | 목록 '세 개/여섯 개'의 단위(무엇을 구하는지) 미명시 |
| EP13 | EP13_SC012 | 코어 반응을 일으키는 대상(무엇에 가까워지는지) 미명시 |
| EP13 | EP13_SC012 | 이 장면의 동행자 동석 여부 미명시(야영이므로 추정) |
| EP13 | EP13_SC014 | '지하 3층 봉인'이 무엇을 가뒀는지 미명시 |
| EP13 | EP13_SC016 | 벽 안쪽 두 번째 울림의 정체 미명시 (다음 화 예고와 연결) |
| EP13 | EP13_SC013 | 판교의 지역 번호 충돌: EP13 헤더(L9316)는 '지역⑥ 진입', EP14 헤더(L9684)는 '지역⑤ 판교' — 어느 쪽이 정본인지 TBD |
| EP14 | EP14_SC001 | 연속성: EP13 §12~§13에서 일행은 이미 판교 건물 앞에서 야영하고 균열을 조사했는데 EP14는 벙커의 목록 장면부터 다시 시작함. 또 EP13 예고는 EP14를 '지역⑥·소리를 지우는 것'으로 소개하나 EP14 헤더는 '지역⑤ 판교'. 어느 쪽이 정본인가 |
| EP14 | EP14_SC001 | 시간대 미기재 (해당: EP14_SC001, EP14_SC002, EP14_SC003, EP14_SC004, EP14_SC005, EP14_SC006, EP14_SC007, EP14_SC008, EP14_SC009, EP14_SC010, EP14_SC011). EP15에서 관찰자 빛이 '새벽하고 아침'에 움직였다고 언급됨 |
| EP14 | EP14_SC002 | 판교까지 이동 구간의 장소·지형 미기재(EP13은 벙커에서 판교까지 걸어서 나흘이라 언급) |
| EP14 | EP14_SC004 | 실험체 09호의 게임 내 보스 지위: 원고 헤더 '실험체 09호 조우'와 '격파 3회'로 지역⑤ 보스로 채택했으나 공식 보스 명칭·등급 미확정 |
| EP14 | EP14_SC004 | §5의 '넷'에 오정길이 포함되는지(계단 위 조명 담당) — 4인 동시 공격 구성원이 불명확 |
| EP14 | EP14_SC011 | 민경의 시신 수습 여부·방법 미기재. 마지막 병을 이음매에 쏟은 인물도 미기재 |
| EP14 | EP14_SC011 | 아인이 팔뚝을 긁힌 정확한 시점(세 번째 개체에 스친 순간) — SC009/SC010 중 어디서 연출할지 |
| EP14 | EP14_SC012 | 밤 대화 장소 미기재(건물 밖 야영지로 추정되나 원고에 없음) |
| EP14 | EP14_SC013 | 옥상 관찰자는 EP14에서 무명이며 EP15 §11에서 세라로 확인됨. EP14 연출에서 얼굴·복장 노출 여부 |
| EP15 | EP15_SC001 | 장소 미기재 (해당: EP15_SC001, EP15_SC002). SC002는 시간대도 미기재 |
| EP15 | EP15_SC006 | 세라가 던진 금속 원통의 정체(촉매 용기인지 등)와 봉쇄와의 관계 미기재 |
| EP15 | EP15_SC009 | '여덟 번의 두 번'이 큰 개체 1·작은 개체 2에 어떻게 배분되는지 미기재(큰 것에 봉쇄 두 번만 명시) |
| EP15 | EP15_SC010 | 교전 후 시간대 미기재 (해당: EP15_SC010, EP15_SC011, EP15_SC012, EP15_SC013) |
| EP15 | EP15_SC012 | 세라의 약이 늦추는 '성숙'의 정체, 세라의 소속·목적 — 원고가 의도적으로 답하지 않음 |
| EP15 | EP15_SC013 | '넷이 다섯이 되어' — 넷에 오정길 포함으로 해석(아인·카인·류·오정길+세라) |
| EP16 | EP16_SC001 | EP16 전체의 시간대 미기재 (해당: EP16_SC001, EP16_SC002, EP16_SC003, EP16_SC004, EP16_SC005, EP16_SC006, EP16_SC007, EP16_SC008, EP16_SC009, EP16_SC010, EP16_SC011, EP16_SC012, EP16_SC013). EP17 §8은 같은 전투를 '이 밤'이라 부름 |
| EP16 | EP16_SC001 | EP15에서 합류한 세라가 §1~§10 동안 일행('넷')과 떨어져 있던 이유·위치 미기재 |
| EP16 | EP16_SC003 | 보스 명칭이 EP16에는 없고 EP17 §3에서 '섀도우 팽'으로 처음 호명됨. 전장이 물류창고 앞마당인지 인근 골짜기인지(EP17은 '이 골짜기') 불명확 |
| EP16 | EP16_SC005 | '마지막 억제제, 반쯤 남은 병, 라벨의 손글씨' — 닥터 진의 약으로 보이나 EP15 세라의 라벨 없는 병 3개·민경의 시약 2병과의 재고 관계 미정리(EP17 §12는 세라 병을 '세 병 중 마지막'이라 하면서 '두 병 남았어'라고도 함) |
| EP16 | EP16_SC012 | '판교에서부터 한 달을 같이 걸었다' — 판교 이후 한 달간의 여정이 원고에 없음 |
| EP16 | EP16_SC006 | 오정길 조작 구간은 게임 제안(원고는 3인칭 서술) — 플레이어 캐릭터 전환 여부 확정 필요 |
| EP17 | EP17_SC001 | 전투 시간대 미기재 (해당: EP17_SC001, EP17_SC002, EP17_SC003, EP17_SC004, EP17_SC005, EP17_SC006, EP17_SC007, EP17_SC009, EP17_SC010, EP17_SC011). §8은 '이 밤'이라 하고 §12는 '소리 있는 저녁'이라 해 시간 순서가 충돌 |
| EP17 | EP17_SC003 | '24화의 순찰이 거둬 온 것들' — 제24화를 가리키는 듯한 표현이 EP17에 있어 의미 불명(원고 오기 가능성). 또 '지난밤 지평선 위를 별처럼 걸어가던 그것'은 EP16에 묘사되지 않음 |
| EP17 | EP17_SC005 | 날개 관절을 떨어뜨린 '연격'의 수행자 미기재 |
| EP17 | EP17_SC007 | '다섯이 벽을 등지고' — 오정길이 전투 현장에 있었는지(§1~§6에는 언급 없음)와 역할 미기재 |
| EP17 | EP17_SC008 | 세라의 계측기 표시창 글자와 세 사람이 넘은 문턱의 등급 — 원고가 의도적으로 밝히지 않음 |
| EP17 | EP17_SC012 | 병 재고 불일치: '판교에서 받은 세 병 중 마지막'이라는 서술과 세라의 '두 병 남았어' 대사가 충돌 |
| EP17 | EP17_SC013 | '한 사람은 북으로, 다섯은 남은 일을 정리하러' — 오정길을 빼면 네 명(아인·카인·류·세라)이라 인원수 불일치 |
| EP18 | EP18_SC001 | 일행 귀환 여정의 시간대 미기재. 또 오정길이 먼저 떠났는데도 '다섯은 뒤에서'라 서술 — 남은 인원(아인·카인·류·세라)과 불일치(EP17 §13과 동일 문제) |
| EP18 | EP18_SC002 | 오정길 이동 일수: §1 '엿새' vs §2 '이레째 아침' 도착 — 표기 정리 필요 |
| EP18 | EP18_SC003 | 습격 시점에 한 장인의 제단에 '어제 도착한' 부러진 대검·소재 판이 있다고 하나 일행은 아직 반나절 거리였고, §10에서는 카인이 습격 후 직접 제단에 올림 — 소품 도착 시점 충돌 |
| EP18 | EP18_SC005 | non-boss combat in novel — game representation TBD (방호복 인원·군 표식 집행관의 벙커 기습 방어전: EP18_SC005, EP18_SC007, EP18_SC009, EP18_SC010). 습격 주체('군', 수거)의 정식 소속·명칭도 미기재 |
| EP18 | EP18_SC011 | 습격 직후 장면의 시간대 미기재 |
| EP18 | EP18_SC015 | 타임라인 충돌: §13은 한 장인이 습격 '때' 소재 판을 화로에 넣고 있었다고 하나 §10에서는 습격 후 밤 카인 앞에서 넣음. 또 §11 '이튿날' 등록식과 §13 '새벽 네 시 망치 멎음·아침 발견·어제 습격'의 순서가 불명확 |
| EP18 | EP18_SC015 | 한 장인이 통로에서 방호복과 어떻게 싸웠는지 원고가 의도적으로 보여 주지 않음(피 묻은 망치만 남음) — 연출 범위 |
| EP18 | EP18_SC016 | 유진이 대장을 기록하는 장소 미기재(평가소로 추정) |
| EP18 | EP18_SC013 | 세라가 닥터 진의 억제제를 보고 반응한 이유 미기재. 두나의 현재 나이(감염 시 8세, 2년 경과) 미기재 |
| EP18 | EP18_SC017 | 카인의 장검 이름 — 원고가 의도적으로 붙이지 않음 |
| EP19 | EP19_SC002 | 류가 사람들을 모은 방, 세라가 이틀 밤 틀어박힌 '그 방'(§2~§7)의 구체적 장소가 원고에 명시되지 않음(loc_bunker로 임시 처리). |
| EP19 | EP19_SC002 | §2 자리에 있던 인원 구성 불명확 — 마태오·오정길은 '읽지 못했다'로 언급되나 현장 동석 여부가 명시되지 않음. |
| EP19 | EP19_SC004 | §4에 '이틀 밤'과 '사흘째 새벽'이 함께 나옴 — 해독에 걸린 정확한 날수 불명. |
| EP19 | EP19_SC007 | 백 실장의 풀네임·외형·세라와의 관계는 원고 미공개. |
| EP19 | EP19_SC010 | 난수 방송 발신자(장성급 호출 부호)의 신원·위치 미공개. |
| EP19 | EP19_SC013 | '다섯이 안개 속으로' — 떠나는 다섯 중 아인·카인·류·세라 외 다섯 번째 인물이 원고에 명시되지 않음. |
| EP19 | EP19_SC013 | 아인의 복장·교신 기록부의 출처 등 세부는 이 화에 서술 없음. |
| EP20 | EP20_SC001 | 일행 인원이 '다섯'(능선·관문)과 '넷'(동맹·A 계측)으로 병기됨 — 다섯 번째 인물(EP21의 안내인이 언제 합류했는지 포함)이 원고에 명시되지 않음. |
| EP20 | EP20_SC003 | 골짜기의 밤 세라의 표시창에 떠 있던 실제 등급이 무엇인지 미공개. |
| EP20 | EP20_SC005 | §5에서 류가 꺼낸 단말이 류의 것인지 세라의 것인지 명시되지 않음. |
| EP20 | EP20_SC008 | 금고 파편의 출처('이십 년쯤 전에 어디로 떨어진 것')와 노바 1호 채집 대상의 정체는 원고상 미확정. 회상 인서트는 원고 묘사 범위로 한정. |
| EP20 | EP20_SC004 | 닷새째 저녁 야영지와 엿새째 밤 야영지가 같은 장소인지 불명. |
| EP20 | EP20_SC014 | 잠입 구간(§13 전반)은 원고에서 서술 한 문단 — 게임 잠입 플레이 분량은 TBD. |
| EP20 | EP20_SC012 | 세라가 몰래 목에 댄 계측기 표시창의 내용 미공개. |
| EP21 | EP21_SC003 | 안내인이 언제·어디서 일행에 합류했는지 원고에 없음(§3이 정비창 안에서의 소개인지도 불명). 이름은 끝까지 미공개. |
| EP21 | EP21_SC004 | non-boss combat in novel — game representation TBD (나노가 점거한 정비 장비 군단: 다관절 암·유압 절단기·용접기·크레인). |
| EP21 | EP21_SC001 | 세라가 지열 자체 발전·배수로 개통을 아는 이유(계룡에 와 본 적 있음)는 이 화에서 미해명. |
| EP21 | EP21_SC006 | 아스널 오버로드의 기원(누가 조립했는지, 안내인 근무 이후 언제 생겼는지) 미공개. |
| EP21 | EP21_SC010 | 안내인의 죽음은 직접 묘사되지 않고 '넷이었다'와 남은 종이로만 제시 — 시신 연출 여부 TBD. |
| EP21 | EP21_SC007 | EP21 조우전의 게임상 페이즈 구분(원고는 부위 파괴 페이즈를 EP22에서 전개) — 여기서는 P1로 임시 표기. |
| EP21 | EP21_SC015 | 아인이 채운 나머지 7개 간격의 구체 수치는 원고에 없음. |
| EP22 | EP22_SC004 | §4는 EP21 §13·EP22 §3과 대사('길이 있어요'/'밑은 제가 아니에요'/'내가 못 가'/'넷이서 가는 거예요')가 중복 — 원고 정리 전 초안 흔적으로 보임. 게임 채택 판본 TBD. |
| EP22 | EP22_SC006 | §6(전편)이 관절 1~6 파괴와 코어 격파까지 요약 서술한 뒤, 후편 §7~§10이 '세 번째 관절' 시점으로 되돌아가 재서술 — 이중 판본. 게임은 SC007~SC010 채택을 제안하나 확정 필요. |
| EP22 | EP22_SC006 | §6은 격파 후 '다섯 사람의 숨소리', §10은 '네 사람의 숨소리'로 인원 불일치. |
| EP22 | EP22_SC011 | §11 '다섯은 저도 모르게 걸음을 죽였다', §13 '다섯을 향해' — 안내인 사망 후 넷인데 '다섯'으로 표기. 다섯 번째 인물 불명. |
| EP22 | EP22_SC008 | 원고 헤더의 '과부하 90초'는 본문에 없음(세라: '모르겠어. 근데 오래는 아니야'). 과부하 제한 시간 TBD. |
| EP22 | EP22_SC013 | 원고 헤더의 '노바 문패'는 본문에 등장하지 않음. |
| EP22 | EP22_SC012 | 세라가 박 준장을 아는 이유와 관계 미공개. |
| EP22 | EP22_SC005 | 카인이 스물세 걸음을 끌려가는 방식(아인 낫이 장검 코등이에 걸림)의 구체 동선은 원고 한 문단 — 2인 연동 조작 설계 TBD. |
| EP23 | EP23_SC001 | 박 준장이 게임 정규 보스인지 확인 필요 — 원고 헤더는 '박 준장 결착'만 명시(여기서는 보스로 처리). 난수 방송 발신자(장성)와의 관계도 미공개. |
| EP23 | EP23_SC001 | 일행이 '다섯'으로 표기됨(§1 '다섯 합'은 횟수, §5·§11·§13 '다섯'은 인원) — 안내인 사망 후 넷인데 다섯 번째 인물 불명. §11 계측기는 '네 개의 수치'. |
| EP23 | EP23_SC004 | 진열장 속 낡은 서류 가방의 내용물은 원고에 없음. |
| EP23 | EP23_SC004 | 캡슐 안 '사람의 형태'들의 생사·상태(검체 고정의 의미)는 구체 서술 없음. |
| EP23 | EP23_SC007 | '신호'의 발신원·의미는 원고상 미공개(차한별도 모름). |
| EP23 | EP23_SC010 | 남부 발사장 구역으로의 '생체 이송' 목적 미공개. |
| EP23 | EP23_SC011 | 세라가 '골짜기에서부터' S였다는 것 외에 현재 정확한 등급 미공개. |
| EP23 | EP23_SC013 | 원고 헤더의 '강제 승급' 이후 게임 성장 시스템 반영 방식 TBD. |
| EP24 | EP24_SC001 | 원고는 일행을 「다섯」이라 부르나(§1·§11·§12 등), 이 화에 등장·언급되는 동행은 아인·카인·류·세라 넷뿐이고 오정길은 부재로 명시됨. EP28 §7은 「넷이 온전히 돌아온 것」이라 함. 다섯 번째 인원이 누구인지(또는 표기 오류인지) 미확정. |
| EP24 | EP24_SC003 | 카인이 소리 내어 말한 딸의 이름은 원고에 적히지 않음(의도적 공백). 게임에서 음성/자막 처리 방식 TBD. |
| EP24 | EP24_SC003 | 시각(TimeOfDay) 원고에 명시 없음 — 현재 표기: 「TBD_CANON (같은 날 저녁 이전, 비)」 |
| EP24 | EP24_SC005 | 원고는 「넷 중 셋이 뜬눈으로 밤을 났다」고 하여 류를 뺀 인원을 넷으로 셈 — 전체 인원 「다섯」 표기와의 관계 미확정(SC001 참조). |
| EP24 | EP24_SC006 | 류가 걸은 북쪽 길의 구체적 장소·지형 원고 미기재. |
| EP24 | EP24_SC011 | 「떠나는 아침, 다섯은 마당에 섰다」 — 대사자는 카인·류·세라·아인 넷. 다섯 번째 인원 미확정(SC001 참조). |
| EP24 | EP24_SC001 | 이 화 전체에서 인물 의상 묘사가 거의 없음(류의 후드, 세라의 촉매 가방 정도). 기본 의상은 이전 화/모델시트 기준 — 이 화 원고로는 확정 불가. |
| EP25 | EP25_SC001 | 원고는 일행을 「다섯」이라 하나 이 화에 등장하는 동행은 넷(아인·카인·류·세라)이며 §5에서는 「넷은 방파제 아래에서 잤다」. 인원 표기 불일치(EP24 TBD와 동일). |
| EP25 | EP25_SC002 | 시각(TimeOfDay) 원고에 명시 없음 — 현재 표기: 「TBD_CANON (열흘째, 반나절 이동 이후)」 |
| EP25 | EP25_SC003 | 의장대의 등 뒤를 지나는 잠입이 게임에서 발각 조건이 있는 스텔스인지 단순 이동인지 원고상 근거 없음(원고는 무사 통과만 서술) — 게임 표현 TBD. |
| EP25 | EP25_SC003 | 시각(TimeOfDay) 원고에 명시 없음 — 현재 표기: 「TBD_CANON (한나절 소요)」 |
| EP25 | EP25_SC004 | 시각(TimeOfDay) 원고에 명시 없음 — 현재 표기: 「TBD_CANON」 |
| EP25 | EP25_SC005 | 정 남매의 복장·외형 상세(「마른 남자와 마른 여자」 외) 원고 미기재. |
| EP25 | EP25_SC005 | 시각(TimeOfDay) 원고에 명시 없음 — 현재 표기: 「TBD_CANON」 |
| EP25 | EP25_SC007 | 원고 불일치: §6에서 남매를 북으로 보냈으나 §7 첫 문장은 「남매를 통제동에 숨기고 나왔을 때」이고, EP26 §7~8에서 다시 아인이 북으로 보내자고 하며 류가 물·건량을 넘기고 두 사람이 방파제 길로 떠남. 남매의 출발 시점(EP25 §6 vs EP26 §7~8) 확정 필요. |
| EP25 | EP25_SC008 | 시각(TimeOfDay) 원고에 명시 없음 — 현재 표기: 「TBD_CANON (이튿날)」 |
| EP26 | EP26_SC001 | 정 장관의 명령어 「미확인 인원 다섯」 — 인원 표기 불일치(EP24 TBD 참조). |
| EP26 | EP26_SC001 | 시각(TimeOfDay) 원고에 명시 없음 — 현재 표기: 「TBD_CANON (같은 날, §3에서 석양)」 |
| EP26 | EP26_SC002 | 시각(TimeOfDay) 원고에 명시 없음 — 현재 표기: 「TBD_CANON (석양 이전)」 |
| EP26 | EP26_SC007 | EP25 §6(EP25_SC007)에서 이미 남매를 북으로 보냈는데 여기서 다시 보냄 — 원고 중복/불일치. 어느 쪽을 게임 캐논으로 쓸지 확정 필요. |
| EP26 | EP26_SC007 | 「격리동에서 챙긴 물과 건량」 — 격리동에서 물자를 챙기는 장면은 원고에 없음. |
| EP26 | EP26_SC008 | §8은 「다섯은 갱도 입구 앞에 섰다」 후 「넷이 어둠 속으로 걸어 내려갔다」 — 인원 표기 불일치. |
| EP26 | EP26_SC002 | 정 장관전에서 플레이어가 조작하는 인물(아인 단독 vs 파티 전환)은 원고가 정하지 않음 — PlayerCharacter=char_ain은 각색 제안. |
| EP27 | EP27_SC001 | §1 「다섯의 목덜미」 등 이 화 전반의 「다섯」 표기 — 동행은 넷(인원 불일치, EP24 TBD 참조). |
| EP27 | EP27_SC006 | §4-3의 굵은 글씨 대사(「모자란 것들을…… 모아서……」, 「증폭기다.」 등)가 위/밑 어느 목소리인지 원고에 명시 없음 — 대사 화자 배정 TBD. |
| EP27 | EP27_SC007 | 「너희는…… 옮길 필요가 없다……」 등 §4-4 전반부 굵은 글씨 대사의 화자(위/밑) 원고 미명시. |
| EP27 | EP27_SC009 | 「신호 간격, 밝기의 관리, 걸어 내리는 낫, 이중의 고정, 감각기의 봉쇄」 등 나열된 기술이 각각 어떤 팔/패턴에 대응하는지 원고 미상세. |
| EP27 | EP27_SC010 | 「잔량!」을 외친 인물이 원고에 명시되지 않음. |
| EP27 | EP27_SC016 | §13은 지하 공간에서 계측 후 갱도를 거슬러 뜀 — 장면 장소를 갱도(탈출 구간)로 배정. 계측 장면은 지하 공간(loc_balsadae_jiha)일 가능성. 또한 「넷 다」 그래프 vs 「다섯이 갱도를 거슬러 뛰었다」 인원 불일치. |
| EP27 | EP27_SC008 | 최종 보스전에서 플레이어 조작 인물(아인 고정 vs 파티 전환)은 원고가 정하지 않음 — char_ain은 각색 제안. BossPhase P1~P3 구분도 원고 절 구분에 따른 제안. |
| EP28 | EP28_SC002 | 탑은 「이 년의 마지막 적」으로 서술되나 생물/집행관이 아닌 구조물 — 게임에서 보스전(BOSS_BATTLE)으로 표현할지 구조 파괴 퍼즐/시네마틱으로 할지 TBD. 탑 자체의 공격 패턴은 원고에 없음. |
| EP28 | EP28_SC002 | 시각(TimeOfDay) 원고에 명시 없음 — 현재 표기: 「새벽 (TBD_CANON — §3에서 해가 오름)」 |
| EP28 | EP28_SC003 | 「다섯은 방파제에 서서」 — 「넷의 수치」와 인원 불일치(EP24 TBD 참조). |
| EP28 | EP28_SC005 | 시각(TimeOfDay) 원고에 명시 없음 — 현재 표기: 「TBD_CANON」 |
| EP28 | EP28_SC005 | 장면 장소가 원고에 명시되지 않음 |
| EP28 | EP28_SC006 | 귀로의 집행관은 「싸우지 않고 지나갔다」 — 게임에서 교전 불가 통과 구간으로만 표현(전투 추가 금지). 개별 집행관 종류 원고 미기재. |
| EP28 | EP28_SC007 | 시각(TimeOfDay) 원고에 명시 없음 — 현재 표기: 「TBD_CANON (한 달째 저녁 남산타워 조망 이후)」 |
| EP28 | EP28_SC009 | 세라가 닥터 진의 필체를 어디서 봤는지, 닥터 진의 제법 출처는 원고가 「이 이야기의 바깥에 있다」며 명시하지 않음. |
| EP28 | EP28_SC009 | 시각(TimeOfDay) 원고에 명시 없음 — 현재 표기: 「TBD_CANON (이튿날)」 |
| EP28 | EP28_SC011 | 아인이 장부를 편 방이 벙커의 어디인지 원고 미기재(loc_gangnam_bunker로 일반 처리). |
| EP28 | EP28_SC011 | 카인이 적은 딸의 이름은 원고에 적히지 않음. |
| EP28 | EP28_SC014 | 다가오는 빛의 정체·형태·도착 시점은 원고에 없음(제2부 사항). NextScene 비움 — 제2부 첫 장면 미정. |
| EP28 | EP28_SC002 | 이 화 탑 전투에서 플레이어 조작 인물은 원고가 정하지 않음 — char_ain(등반·결정타)은 각색 제안. |
