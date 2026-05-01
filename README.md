# 📦 LightDB

**LightDB**는 별도의 백엔드 서버 없이 브라우저 간 직접 통신(P2P)을 통해 데이터를 실시간으로 동기화하는 **서버리스 실시간 데이터베이스**입니다.

WebRTC 기반으로 사용자 간 JSON 데이터를 교환하며, LocalStorage를 활용해 **데이터 지속성**까지 제공합니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat\&logo=typescript\&logoColor=white)

## ✨ 주요 특징

* **P2P 실시간 동기화**
  WebRTC 기반으로 방장(Chief)과 참여자 간 데이터가 즉시 동기화됩니다.

* **서버리스 아키텍처**
  시그널링 서버를 제외하면 별도의 데이터베이스 서버가 필요 없습니다.

* **직관적인 API**
  `update`, `remove`, `on` 등 Key-Value 기반의 단순한 인터페이스를 제공합니다.

* **데이터 지속성**
  LocalStorage를 활용해 새로고침 이후에도 상태를 유지합니다.

* **경량 설계**
  불필요한 의존성을 제거하고 핵심 기능에 집중했습니다.

## 🚀 시작하기

### 설치

LightDB는 `peerjs`를 기반으로 동작합니다.

```bash
npm install lightdb peerjs
# 또는
pnpm add lightdb peerjs
```

## 🧩 사용 방식

LightDB는 기본적으로 **싱글턴 인스턴스**를 제공합니다.  
별도의 인스턴스 생성 없이 바로 사용할 수 있습니다.

```javascript
import lightDB from '@wonbeanie/lightdb';

await lightDB.createRoom();
```

필요한 경우 `LightDB` 클래스를 직접 import하여
독립적인 인스턴스를 생성할 수도 있습니다.

```javascript
import { LightDB } from '@wonbeanie/lightdb';

const db1 = new LightDB();
const db2 = new LightDB();
```

### 방 생성 (Host)

```javascript
import lightDB from '@wonbeanie/lightdb';

// 1. 데이터 구독
lightDB.on('users', (data) => {
  console.log('사용자 데이터 변경:', data);
});

// 2. 방 생성 (Host 역할)
const roomId = await lightDB.createRoom({
  storageKey: 'my-app-db', // (선택) 저장소에서 사용할 키
  resetStorage: true       // (선택) 기존 로컬 데이터를 삭제하고 새로 시작
});
console.log(`Room ID: ${roomId}`);

// 3. 데이터 업데이트
await lightDB.update('users', {
  monster: { name: 'Mons', age: 500 }
});
```

### 방 참여 (Client)

```javascript
import lightDB from '@wonbeanie/lightdb';

// 방장이 공유한 ID로 접속
await lightDB.joinRoom('room-id', {
  resetStorage: false // (선택) 기존 로컬 데이터를 유지하며 참여 (기본값)
});

// 데이터 구독
lightDB.on('users', (data) => {
  console.log('동기화된 데이터:', data);
});
```

## 🛠 API

### Methods

| 메서드                       | 설명                         |
| :------------------------ | :------------------------- |
| `createRoom(config?)` | 새로운 방을 생성하고 Host가 됩니다.<br>• storageKey : 저장소에서 사용할 키<br>• resetStorage : 기존의 저장소를 초기화하여 시작할지 여부를 설정할 수 있습니다.     |
| `joinRoom(targetId, config?)`      | 기존 방에 참여합니다.<br>• resetStorage : 기존의 저장소를 초기화하여 시작할지 여부를 설정할 수 있습니다.        |
| `update(table, data)`     | 데이터를 업데이트하고 모든 피어에 동기화합니다.<br>• 특정 키의 값을 `null`로 설정하면 해당 데이터를 삭제할 수 있습니다. |
| `remove(table)`           | 특정 테이블 데이터를 삭제합니다.         |
| `clear()`                 | 전체 데이터를 초기화합니다.            |
| `on(table, handler)`      | 데이터 변경 구독                  |
| `off(table)`              | 구독 해제                      |
| `onPeer(event, handler)`  | WebRTC 이벤트 구독              |
| `offPeer(event)`          | WebRTC 이벤트 구독 해제           |
| `destroy()`               | 모든 연결 종료 및 인스턴스 제거         |

### Properties (Read-only)

| 속성                | 설명                 |
| :---------------- | :----------------- |
| `database`        | 현재 메모리에 로드된 전체 데이터 |
| `roomChief`       | Host 여부            |
| `roomId`          | 현재 방 ID            |
| `updateTimestamp` | 마지막 업데이트 시간        |

> ⚠️ **주의:**
> 속성 값을 직접 변경하면 동기화 오류가 발생할 수 있습니다.
> 반드시 `update`, `remove` 등의 메서드를 사용하세요.

## 📄 License

MIT License