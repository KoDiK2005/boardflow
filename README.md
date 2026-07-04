# BoardFlow

[![CI](https://github.com/KoDiK2005/boardflow/actions/workflows/ci.yml/badge.svg)](https://github.com/KoDiK2005/boardflow/actions/workflows/ci.yml)

Trello-подобный таск-менеджер: доски, списки, карточки, drag-and-drop.

## Стек

- **Backend**: Node.js, TypeScript, Express, Prisma ORM, PostgreSQL, JWT-аутентификация, Socket.IO
- **Frontend**: React, TypeScript, Vite, dnd-kit, socket.io-client
- **Инфраструктура**: Docker Compose (Postgres + backend + frontend), GitHub Actions CI

## Структура

```
backend/    Express API + Prisma
frontend/   React SPA
```

## Запуск (dev)

```bash
docker compose up --build
```

Backend: http://localhost:4000
Frontend: http://localhost:5173

## Тесты

```bash
cd backend && npm test
```

## Roadmap

- [x] Структура монорепо
- [x] Auth (регистрация/логин, JWT)
- [x] CRUD досок/списков/карточек
- [x] Drag-and-drop сортировка
- [x] Метки, дедлайны, комментарии
- [x] Тесты backend + CI
- [x] Realtime-обновления (WebSocket)
- [ ] Приглашение участников на доску
