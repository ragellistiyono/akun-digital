-- Runs once, when docker compose creates the PostgreSQL volume (see docker-compose.yml).
-- Development uses the database app; tests use app_test (see .env.ci).
CREATE DATABASE app_test;
