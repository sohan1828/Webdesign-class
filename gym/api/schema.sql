-- Fitness Club database. Run once: mysql -u USER -p DATABASE < schema.sql
-- Needs MySQL 5.7+ or MariaDB 10.2+. Everything is utf8mb4.

CREATE TABLE IF NOT EXISTS admin_users (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(40)  NOT NULL UNIQUE,
  pass_hash   VARCHAR(255) NOT NULL,
  role        VARCHAR(20)  NOT NULL DEFAULT 'owner',   -- owner or trainer
  trainer_id  VARCHAR(40)  NULL,                       -- which trainer record a trainer login belongs to
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Each record keeps its full JSON in `data` (the same shape the admin pages use) plus the few
-- columns we need to search, sort and protect (for example one member per phone number).
CREATE TABLE IF NOT EXISTS members (
  id      VARCHAR(40) PRIMARY KEY,
  phone   VARCHAR(15) NOT NULL,
  joined  BIGINT      NOT NULL,
  trainer_id VARCHAR(40) NULL,
  data    LONGTEXT    NOT NULL,
  UNIQUE KEY uq_members_phone (phone),
  KEY ix_members_trainer (trainer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sales (
  id         VARCHAR(40) PRIMARY KEY,
  ts         BIGINT      NOT NULL,
  type       VARCHAR(20) NOT NULL,
  amount     INT         NOT NULL,
  member_id  VARCHAR(40) NULL,
  data       LONGTEXT    NOT NULL,
  KEY ix_sales_ts (ts),
  KEY ix_sales_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS trainers (
  id    VARCHAR(40) PRIMARY KEY,
  data  LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS classes (
  id    VARCHAR(40) PRIMARY KEY,
  data  LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bookings (
  id         VARCHAR(40) PRIMARY KEY,
  class_id   VARCHAR(40) NOT NULL,
  date       CHAR(10)    NOT NULL,
  member_id  VARCHAR(40) NOT NULL,
  data       LONGTEXT    NOT NULL,
  UNIQUE KEY uq_booking (class_id, date, member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS checkins (
  id         VARCHAR(40) PRIMARY KEY,
  member_id  VARCHAR(40) NOT NULL,
  ts         BIGINT      NOT NULL,
  data       LONGTEXT    NOT NULL,
  KEY ix_checkins_member (member_id, ts),
  KEY ix_checkins_ts (ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Used to slow down password guessing and form spam.
CREATE TABLE IF NOT EXISTS rate_limits (
  k   VARCHAR(100) NOT NULL,
  ts  INT UNSIGNED NOT NULL,
  KEY ix_rate (k, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Member logins for the My account page. The member signs in with their phone number.
CREATE TABLE IF NOT EXISTS member_logins (
  member_id  VARCHAR(40)  PRIMARY KEY,
  pass_hash  VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
