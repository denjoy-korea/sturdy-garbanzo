# 뽀꼬오목

가족과 1:1로 즐기는 온라인 뽀꼬오목 게임입니다.

## 기능

- 15x15 보드, 가로/세로/대각선 5목 승리
- 로비에서 진행중인 방 목록 실시간 표시 (대기 중 / 진행 중)
- 방 클릭으로 바로 입장 (코드 입력 불필요)
- 방 카드의 × 버튼으로 즉시 정리
- ✨ 찬스 (게임당 1회): AI 휴리스틱 추천 수 표시
- Supabase Realtime broadcast/presence 기반 (DB 테이블 미사용)
- 한국어 UI

## 로컬 실행

```bash
cp .env.local.example .env.local   # Supabase URL/키 입력
npm install
npm run dev
```

http://localhost:3000 으로 접속.

## 플레이 방법

1. 닉네임을 입력합니다.
2. "새 방 만들기"로 방을 만들거나, 진행중인 방 목록에서 클릭해 입장.
3. 먼저 들어온 사람이 흑(선공), 다음 사람이 백입니다.
4. 가로/세로/대각선으로 5개를 먼저 만들면 승리.

## 배포

Vercel에 배포할 수 있습니다. 환경 변수:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

(공개 publishable 키만 사용하므로 클라이언트 노출은 안전합니다.)
