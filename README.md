# 📦 LightDB

**LightDB**는 별도의 백엔드 서버 없이 브라우저 간 직접 통신(P2P)을 통해 데이터를 실시간으로 동기화하는 **서버리스 실시간 데이터베이스**입니다. WebRTC 기술을 활용하여 사용자 간에 JSON 데이터를 주고받으며, 로컬 저장소(LocalStorage)를 통해 데이터의 지속성을 보장합니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)

---

## ✨ 주요 특징

* **P2P 실시간 동기화**: WebRTC 기반으로 방장(Chief)과 참여자 간의 데이터를 즉시 동기화합니다.
* **서버리스**: 시그널링 서버를 제외한 별도의 데이터베이스 서버가 필요 없습니다.
* **간편한 API**: 익숙한 Key-Value 기반의 API(`update`, `remove`, `on`)를 제공합니다.
* **데이터 지속성**: 페이지를 새로고침해도 로컬 저장소를 통해 이전 상태를 유지합니다.
* **가벼운 설계**: 불필요한 의존성을 제거하고 핵심 로직에 집중하여 가볍습니다.

---

## 🚀 시작하기

### 설치

LightDB는 `peerjs`를 핵심 의존성으로 사용하므로 함께 설치해야 합니다.

```bash
npm install lightdb peerjs
# 또는
pnpm add lightdb peerjs
```

### 기본 사용법 (방 생성)

```javascript
import lightDB from 'lightdb';

// 1. 데이터 변경 감지 (구독)
lightDB.on('users', (data) => {
  console.log('사용자 데이터가 변경되었습니다:', data);
});

// 2. 방 생성하기 (방장이 됨)
const roomId = await lightDB.createRoom();
console.log(`방이 생성되었습니다. 아이디: ${roomId}`);

// 3. 데이터 업데이트
await lightDB.update('users', {
  monster: { name: 'Mons', age: 500 }
});
```

### 방 참여하기

```javascript
import lightDB from 'lightdb';

// 방장이 공유한 아이디로 접속
await lightDB.joinRoom('방장의-피어-아이디');

// 참여자도 동일하게 이벤트를 구독하고 데이터를 업데이트할 수 있습니다.
lightDB.on('users', (data) => {
  console.log('방장으로부터 동기화된 데이터:', data);
});
```

---

## 🛠 주요 API

### 1. Methods (메서드)

| 메서드 | 매개변수 | 설명 |
| :--- | :--- | :--- |
| **`createRoom`** | `storageKey?: string` | 새로운 방을 생성하고 방장이 됩니다. |
| **`joinRoom`** | `targetId: string` | 참여할 방장(Host)의 Peer ID를 입력하여 기존 방에 참여합니다. |
| **`update`** | `table: string, data: object` | 특정 테이블에 데이터를 업데이트하고 모든 피어에게 동기화합니다. |
| **`remove`** | `table: string` | 특정 테이블의 모든 데이터를 삭제합니다. |
| **`clear`** | - | 데이터베이스의 모든 데이터를 초기화합니다. |
| **`on`** | `table: string, handler: function` | 데이터 변경 시 실행할 콜백 함수를 등록합니다. |
| **`off`** | `table: string` | 특정 테이블의 데이터 변경 구독을 해제합니다. |
| **`onPeer`** | `event: string, handler: function` | WebRTC 핵심 이벤트를 처리합니다. |
| **`offPeer`** | `event: string` | 등록된 WebRTC 이벤트 구독을 해제합니다. |
| **`destroy`** | - | 모든 연결을 끊고 인스턴스를 파기합니다. |

### 2. Properties (속성 - Read-only 권장)

인스턴스에서 직접 접근하여 현재 상태를 확인할 수 있는 속성들입니다.

| 속성 | 타입 | 설명 |
| :--- | :--- | :--- |
| **`database`** | `Object` | 현재 메모리에 로드된 전체 데이터 객체입니다. |
| **`roomChief`** | `boolean` | 현재 사용자가 방장(Host)인지 여부를 나타냅니다. |
| **`roomId`** | `string` | 현재 접속 중인 방의 Peer ID입니다. |
| **`updateTimestamp`** | `string` | 마지막으로 데이터가 업데이트된 시간입니다. (`YYYY-MM-DD hh:mm:ss`) |

> ⚠️ **주의:** 속성값을 직접 변경하면 동기화 로직에 오류가 발생할 수 있습니다. 데이터 변경은 반드시 `update()`, `remove()` 등의 메서드를 이용해 주세요.

---

## 📄 라이선스

이 프로젝트는 **MIT 라이선스**를 따릅니다.