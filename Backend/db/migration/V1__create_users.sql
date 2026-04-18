-- GotcherApp Auth: users
-- Core identity table. refresh_tokens and baby_profiles both FK here.

CREATE TABLE users (
    id                BIGSERIAL     PRIMARY KEY,
    email             VARCHAR(255)  NOT NULL UNIQUE,
    password_hash     VARCHAR(255)  NOT NULL,
    display_name      VARCHAR(100),
    avatar_url        VARCHAR(500),
    email_verified    BOOLEAN       NOT NULL DEFAULT FALSE,
    is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
    last_login_at     TIMESTAMPTZ,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
