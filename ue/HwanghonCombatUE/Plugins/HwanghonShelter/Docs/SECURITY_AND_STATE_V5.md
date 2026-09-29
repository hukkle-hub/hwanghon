# Ticket / state source of truth

## Client URL is not trusted

v5부터 서버는 아래 값을 URL에서 최종 신뢰하지 않는다.

- character
- party
- leader
- mission

최종 값은 one-time ticket consume 응답으로 설정한다.

## Ticket kinds

Shelter ticket:
- login
- dungeon return

Dungeon ticket:
- party dungeon entry

공통:
- target instance id locked
- expiration
- one-time consume
- reuse rejected
- wrong instance rejected

## Production replacement

개발용 `ClientAccountId`는 로컬 UUID이다.
상용에서는 로그인 서비스가 발급한 authenticated account / session identity로 교체해야 한다.
