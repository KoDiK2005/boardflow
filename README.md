# BoardFlow

[![CI](https://github.com/KoDiK2005/boardflow/actions/workflows/ci.yml/badge.svg)](https://github.com/KoDiK2005/boardflow/actions/workflows/ci.yml)

Trello-подобный таск-менеджер: доски, списки, карточки, drag-and-drop, совместная работа в реальном времени.

## Стек

- **Backend**: Node.js, TypeScript, Express, Prisma ORM, PostgreSQL, JWT-аутентификация, Socket.IO, helmet, rate limiting
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
cd backend && npm test    # 46 тестов
cd frontend && npm test   # 18 тестов
```

## Функциональность

- Регистрация/логин (JWT)
- Доски, списки, карточки — полный CRUD
- Drag-and-drop карточек и списков
- Метки, дедлайны (с индикацией просрочки), комментарии
- @упоминания участников в комментариях с автодополнением
- Вложения к карточкам (загрузка/скачивание/удаление файлов)
- Поиск и фильтрация карточек по названию/меткам
- Realtime-синхронизация через WebSocket
- Приглашение участников на доску с ролями (ADMIN/EDITOR/VIEWER)
- Уведомления (приглашение на доску, смена роли, новый комментарий, упоминание, дедлайн) с доставкой в реальном времени
- Дедлайн-напоминания через cron (за 24ч и просрочка), без повторной рассылки
- Rate limiting и security-заголовки (helmet)

## Roadmap

- [x] Структура монорепо
- [x] Auth (регистрация/логин, JWT)
- [x] CRUD досок/списков/карточек
- [x] Drag-and-drop сортировка (карточки и списки)
- [x] Метки, дедлайны, комментарии
- [x] Тесты backend + frontend + CI
- [x] Realtime-обновления (WebSocket)
- [x] Приглашение участников на доску
- [x] Роли участников (ADMIN/EDITOR/VIEWER)
- [x] Поиск и фильтры по карточкам
- [x] Security hardening (helmet, rate limiting)
- [x] Вложения к карточкам
- [x] Уведомления
- [x] @упоминания в комментариях
- [x] Дедлайн-напоминания через cron
