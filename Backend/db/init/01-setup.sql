-- GotcherApp — PostgreSQL initial setup
-- Runs automatically on first container start via docker-entrypoint-initdb.d.
-- Creates the application user and database; grants schema-level privileges
-- so migrations can create and manage tables without the superuser account.

CREATE USER gotcherapp_app WITH PASSWORD 'changeme_local';

CREATE DATABASE gotcherapp OWNER gotcherapp_app;

\connect gotcherapp

GRANT ALL PRIVILEGES ON SCHEMA public TO gotcherapp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO gotcherapp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO gotcherapp_app;
