# 오목 (Omok) - 1:1 온라인 멀티플레이

친구와 1:1로 즐기는 온라인 오목 게임입니다.

## 기능

- 15x15 보드 위에서 가로/세로/대각선 5목 승리
- 방 코드(6자리)로 친구 초대
- Supabase Realtime broadcast 채널을 통한 실시간 수 동기화
- 한국어 UI

## 로컬 실행

```bash
cp .env.local.example .env.local   # Supabase URL/키 입력
npm install
npm run dev
```

http://localhost:3000 으로 접속.

## 플레이 방법

1. 닉네임을 입력하고 "새 방 만들기"를 누르면 방 코드가 생성됩니다.
2. 친구에게 방 코드를 공유합니다(상단 "방 XXXXXX" 버튼으로 복사).
3. 친구가 로비에서 같은 방 코드로 입장하면 게임이 시작됩니다.
4. 먼저 들어온 사람이 흑(선공), 다음 사람이 백입니다.
5. 가로/세로/대각선으로 5개를 먼저 만들면 승리.

## 배포

Vercel에 배포할 수 있습니다. 다음 환경 변수 필요:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

(공개 가능한 publishable 키만 사용하므로 클라이언트 노출은 안전합니다.)
