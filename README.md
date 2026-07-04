# BoardFlow

Trello-подобный таск-менеджер: доски, списки, карточки, drag-and-drop.

## Стек

- **Backend**: Node.js, TypeScript, Express, Prisma ORM, PostgreSQL, JWT-аутентификация
- **Frontend**: React, TypeScript, Vite, dnd-kit
- **Инфраструктура**: Docker Compose (Postgres + backend + frontend)

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

## Roadmap

- [x] Структура монорепо
- [ ] Auth (регистрация/логин, JWT)
- [ ] CRUD досок/списков/карточек
- [ ] Drag-and-drop сортировка
- [ ] Метки, дедлайны, комментарии
- [ ] Realtime-обновления (WebSocket)
- [ ] Приглашение участников на доску
